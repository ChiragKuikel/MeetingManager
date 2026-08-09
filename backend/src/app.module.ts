import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';
import { SummariesModule } from './summaries/summaries.module';
import { ActionItemsModule } from './action-items/action-items.module';
import { ProcessingModule } from './processing/processing.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { bullBoardAuthMiddleware } from './auth/bull-board-auth.middleware';
import { QueueModule, VIDEO_PROCESSING_QUEUE } from './queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      middleware: bullBoardAuthMiddleware,
    }),
    BullBoardModule.forFeature({ name: VIDEO_PROCESSING_QUEUE, adapter: BullMQAdapter }),
    AuthModule,
    VideosModule,
    SummariesModule,
    ActionItemsModule,
    ProcessingModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
