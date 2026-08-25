import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { ProcessingProcessor } from './processing/processing.processor';
import { NotificationsModule } from './notifications/notifications.module';
import { OverdueNotificationsProcessor } from './notifications/overdue-notifications.processor';
import { NotificationsSchedulerService } from './notifications/notifications-scheduler.service';
import { EmbeddingModule } from './embedding/embedding.module';
import { SearchIndexingModule } from './search/search-indexing.module';
import { SearchIndexingProcessor } from './search/search-indexing.processor';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    NotificationsModule,
    EmbeddingModule,
    SearchIndexingModule,
  ],
  providers: [
    ProcessingProcessor,
    OverdueNotificationsProcessor,
    NotificationsSchedulerService,
    SearchIndexingProcessor,
  ],
})
export class WorkerModule {}
