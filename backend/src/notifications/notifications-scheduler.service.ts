import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OVERDUE_NOTIFICATIONS_QUEUE } from './notifications.module';

const DAILY_OVERDUE_CHECK_JOB_ID = 'daily-overdue-check';

@Injectable()
export class NotificationsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(@InjectQueue(OVERDUE_NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'check-overdue',
      {},
      {
        repeat: { pattern: '0 9 * * *' },
        jobId: DAILY_OVERDUE_CHECK_JOB_ID,
      }
    );
    this.logger.log('Registered daily overdue-check repeatable job (9am)');
  }
}
