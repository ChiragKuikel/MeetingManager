import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OVERDUE_NOTIFICATIONS_QUEUE } from './notifications.module';

const DAILY_OVERDUE_CHECK_KEY = 'daily-overdue-check';

@Injectable()
export class NotificationsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(@InjectQueue(OVERDUE_NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // BullMQ dedupes repeatable jobs by this `repeat.key`, not by a top-level jobId —
    // giving it a stable, explicit key (rather than relying on the pattern staying
    // byte-identical) means changing the schedule later replaces this entry instead
    // of registering a second, parallel one.
    await this.queue.add(
      'check-overdue',
      {},
      {
        repeat: { pattern: '0 9 * * *', key: DAILY_OVERDUE_CHECK_KEY },
      }
    );
    this.logger.log('Registered daily overdue-check repeatable job (9am)');
  }
}
