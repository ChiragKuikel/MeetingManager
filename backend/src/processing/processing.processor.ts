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

      const ownerMap = await this.buildOwnerMap(video.organizationId);

      await this.prisma.$transaction([
        this.prisma.summary.upsert({
          where: { videoId },
          create: {
            videoId,
            summaryText: structured.summary_text,
            keyPoints: structured.key_points as any,
            speakers: structured.speakers as any,
            transcript,
          },
          update: {
            summaryText: structured.summary_text,
            keyPoints: structured.key_points as any,
            speakers: structured.speakers as any,
            transcript,
          },
        }),
        this.prisma.decision.deleteMany({ where: { videoId } }),
        this.prisma.decision.createMany({
          data: structured.decisions.map((description) => ({
            organizationId: video.organizationId,
            videoId,
            description,
          })),
        }),
        this.prisma.openQuestion.deleteMany({ where: { videoId } }),
        this.prisma.openQuestion.createMany({
          data: structured.open_questions.map((question) => ({
            organizationId: video.organizationId,
            videoId,
            question,
          })),
        }),
        this.prisma.actionItem.deleteMany({ where: { videoId } }),
        this.prisma.actionItem.createMany({
          data: structured.action_items.map((item) => ({
            organizationId: video.organizationId,
            videoId,
            task: item.task,
            assignee: item.assignee,
            ownerId: ownerMap.get(item.assignee.toLowerCase()) ?? null,
            dueDate: this.parseDueDate(item.due),
            priority: item.priority,
          })),
        }),
      ]);

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

  private async buildOwnerMap(organizationId: number): Promise<Map<string, number>> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const map = new Map<string, number>();
    for (const user of users) {
      if (user.name) map.set(user.name.toLowerCase(), user.id);
    }
    return map;
  }

  private parseDueDate(due: string): Date | null {
    if (!due || due.toUpperCase() === 'TBD') return null;
    const parsed = new Date(due);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
