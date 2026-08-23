import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/environment';
import { OVERDUE_NOTIFICATIONS_QUEUE } from './notifications.module';

@Processor(OVERDUE_NOTIFICATIONS_QUEUE)
export class OverdueNotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(OverdueNotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const overdueItems = await this.prisma.actionItem.findMany({
      where: { status: 'open', dueDate: { lt: new Date() } },
      include: { video: { select: { title: true } } },
      orderBy: { dueDate: 'asc' },
    });

    if (overdueItems.length === 0) {
      this.logger.log('No overdue action items — skipping Slack digest');
      return;
    }

    if (!env.SLACK_WEBHOOK_URL) {
      this.logger.warn(
        `${overdueItems.length} overdue action item(s) found, but SLACK_WEBHOOK_URL is not set — skipping post`
      );
      return;
    }

    const text = this.buildDigestMessage(overdueItems);
    await this.postToSlack(text);
    this.logger.log(`Posted overdue digest for ${overdueItems.length} action item(s)`);
  }

  private buildDigestMessage(
    items: Array<{
      task: string;
      assignee: string | null;
      dueDate: Date | null;
      video: { title: string };
    }>
  ): string {
    const count = items.length;
    const header = `:rotating_light: ${count} overdue action item${count === 1 ? '' : 's'}`;
    const lines = items.map((item) => {
      const due = item.dueDate ? item.dueDate.toISOString().slice(0, 10) : 'unknown date';
      const assignee = item.assignee || 'Unassigned';
      return `• *${item.task}* — ${assignee}, due ${due}, from "${item.video.title}"`;
    });
    return [header, ...lines].join('\n');
  }

  private async postToSlack(text: string): Promise<void> {
    const res = await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Slack webhook post failed: ${res.status} ${body}`);
    }
  }
}
