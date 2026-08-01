import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { env } from '../config/environment';

export const VIDEO_PROCESSING_QUEUE = 'video-processing';

export interface VideoProcessingJob {
  videoId: number;
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
    }),
    BullModule.registerQueue({
      name: VIDEO_PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
