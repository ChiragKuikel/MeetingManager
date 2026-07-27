// src/services/videoProcessingService.ts
import { VideoModel } from '../models/videoModel';
import { SummaryModel } from '../models/summaryModel';
import { QueueModel } from '../models/queueModel';
import audioExtractionService from './audioExtractionService';
import groqService from './groqService';

interface ProcessingResult {
    success: boolean;
    videoId: number;
    error?: string;
}

export class VideoProcessingService {
    private isRunning: boolean = false;

    public async processVideo(videoId: number): Promise<ProcessingResult> {
        let audioPath: string | null = null;

        try {
            console.log(`🎬 Starting processing for video ${videoId}`);

            await QueueModel.updateStatus(videoId, 'processing');
            await VideoModel.updateStatus(videoId, 'processing');

            const video = await VideoModel.findById(videoId);
            if (!video?.file_path) {
                throw new Error('Video record missing file_path');
            }

            audioPath = await audioExtractionService.extractToTempWav(video.file_path);
            const transcript = await groqService.transcribeAudioFile(audioPath);
            const structured = await groqService.summarizeTranscriptToStructured(transcript);

            await SummaryModel.create({
                video_id: videoId,
                summary_text: structured.summary_text,
                key_points: JSON.stringify(structured.key_points),
                action_items: JSON.stringify(structured.action_items),
                speakers: JSON.stringify(structured.speakers),
                transcript
            });

            await VideoModel.updateStatus(videoId, 'completed');
            await QueueModel.updateStatus(videoId, 'completed');

            console.log(`✅ Processing completed for video ${videoId}`);
            return { success: true, videoId };
        } catch (error) {
            console.error(`❌ Processing failed for video ${videoId}:`, error);

            await VideoModel.updateStatus(videoId, 'failed');
            await QueueModel.updateStatus(videoId, 'failed', (error as Error).message);

            return { success: false, videoId, error: (error as Error).message };
        } finally {
            if (audioPath) {
                await audioExtractionService.safeUnlink(audioPath);
            }
        }
    }

    public startQueueWorker(): void {
        if (this.isRunning) {
            console.log('Queue worker already running');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Queue worker started');

        const workerInterval = setInterval(async () => {
            try {
                const nextJob = await QueueModel.getNextPending();

                if (nextJob) {
                    console.log(`📋 Found pending job for video ${nextJob.video_id}`);

                    await QueueModel.incrementAttempt(nextJob.video_id);

                    await this.processVideo(nextJob.video_id);
                }
            } catch (error) {
                console.error('Queue worker error:', error);
            }
        }, 5000);

        process.on('SIGTERM', () => {
            clearInterval(workerInterval);
            this.isRunning = false;
            console.log('Queue worker stopped');
        });
    }
}

export default new VideoProcessingService();
