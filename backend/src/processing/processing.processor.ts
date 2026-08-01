import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import audioExtractionService from '../services/audioExtractionService';
import groqService from '../services/groqService';
import { VIDEO_PROCESSING_QUEUE, VideoProcessingJob } from '../queue/queue.module';

@Processor(VIDEO_PROCESSING_QUEUE, { concurrency: 2 })
export class ProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<VideoProcessingJob>): Promise<void> {
    const { videoId } = job.data;
    let audioPath: string | null = null;

    try {
      this.logger.log(`Starting processing for video ${videoId}`);
      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'processing', attempts: { increment: 1 } },
      });

      const video = await this.prisma.video.findUniqueOrThrow({ where: { id: videoId } });

      audioPath = await audioExtractionService.extractToTempWav(video.filePath);
      const transcript = await groqService.transcribeAudioFile(audioPath);
      const structured = await groqService.summarizeTranscriptToStructured(transcript);

      await this.prisma.summary.upsert({
        where: { videoId },
        create: {
          videoId,
          summaryText: structured.summary_text,
          keyPoints: structured.key_points as any,
          actionItems: structured.action_items as any,
          speakers: structured.speakers as any,
          transcript,
        },
        update: {
          summaryText: structured.summary_text,
          keyPoints: structured.key_points as any,
          actionItems: structured.action_items as any,
          speakers: structured.speakers as any,
          transcript,
        },
      });

      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'completed', errorMessage: null },
      });

      this.logger.log(`Processing completed for video ${videoId}`);
    } catch (error) {
      this.logger.error(`Processing failed for video ${videoId}: ${(error as Error).message}`);
      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'failed', errorMessage: (error as Error).message },
      });
      throw error;
    } finally {
      if (audioPath) await audioExtractionService.safeUnlink(audioPath);
    }
  }
}
