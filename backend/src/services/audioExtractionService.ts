// src/services/audioExtractionService.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class AudioExtractionService {
    /**
     * Extract mono 16kHz WAV for speech APIs. Caller must delete the returned path when done.
     */
    public extractToTempWav(videoPath: string): Promise<string> {
        if (!fs.existsSync(videoPath)) {
            return Promise.reject(new Error(`Video file not found: ${videoPath}`));
        }

        const outPath = path.join(
            os.tmpdir(),
            `meeting-sum-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`
        );

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .noVideo()
                .audioCodec('pcm_s16le')
                .audioFrequency(16000)
                .audioChannels(1)
                .format('wav')
                .on('end', () => resolve(outPath))
                .on('error', (err: Error) => reject(new Error(`FFmpeg audio extraction failed: ${err.message}`)))
                .save(outPath);
        });
    }

    public async safeUnlink(filePath: string): Promise<void> {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        } catch {
            /* ignore */
        }
    }
}

export default new AudioExtractionService();
