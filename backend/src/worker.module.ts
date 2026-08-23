import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { ProcessingProcessor } from './processing/processing.processor';
import { NotificationsModule } from './notifications/notifications.module';
import { OverdueNotificationsProcessor } from './notifications/overdue-notifications.processor';
import { NotificationsSchedulerService } from './notifications/notifications-scheduler.service';

@Module({
  imports: [PrismaModule, QueueModule, NotificationsModule],
  providers: [ProcessingProcessor, OverdueNotificationsProcessor, NotificationsSchedulerService],
})
export class WorkerModule {}
