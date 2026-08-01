import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcessingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Queue a video for processing. Mirrors old QueueModel.add. Real BullMQ enqueue = Phase 3. */
  async enqueue(videoId: number, priority: number = 0) {
    return this.prisma.processingQueue.create({
      data: { videoId, priority },
    });
  }
}
