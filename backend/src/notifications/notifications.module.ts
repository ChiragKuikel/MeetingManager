import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const OVERDUE_NOTIFICATIONS_QUEUE = 'overdue-notifications';

@Module({
  imports: [
    BullModule.registerQueue({
      name: OVERDUE_NOTIFICATIONS_QUEUE,
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
export class NotificationsModule {}
