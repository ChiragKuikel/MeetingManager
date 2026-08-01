import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';
import { SummariesModule } from './summaries/summaries.module';
import { ProcessingModule } from './processing/processing.module';
import { HealthModule } from './health/health.module';
import { QueueModule, VIDEO_PROCESSING_QUEUE } from './queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    BullBoardModule.forRoot({ route: '/admin/queues', adapter: ExpressAdapter }),
    BullBoardModule.forFeature({ name: VIDEO_PROCESSING_QUEUE, adapter: BullMQAdapter }),
    VideosModule,
    SummariesModule,
    ProcessingModule,
    HealthModule,
  ],
})
export class AppModule {}
