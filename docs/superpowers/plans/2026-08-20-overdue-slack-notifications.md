# Overdue Action-Item Slack Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A BullMQ repeatable job runs daily at 9am, queries all open+overdue `ActionItem` rows, and posts one Slack digest message via a raw `fetch` to a webhook URL — skipping the post when there's nothing overdue or the webhook isn't configured.

**Architecture:** New `backend/src/notifications/` module registers its own BullMQ queue (`overdue-notifications`), mirroring the existing `queue.module.ts` pattern from Phase 3. A worker-only processor consumes it; a small `OnModuleInit` scheduler service registers the repeatable job once at worker boot using a fixed `jobId` so restarts don't duplicate the schedule. The queue is also wired into the API process's existing Bull Board dashboard (`/api/admin/queues`) so a job can be manually triggered there for live verification without a throwaway script.

**Tech Stack:** NestJS, `@nestjs/bullmq` (BullMQ), Prisma, raw `fetch` (Slack incoming webhook) — no new dependencies.

---

### Task 1: `SLACK_WEBHOOK_URL` env var

**Files:**
- Modify: `backend/src/config/environment.ts`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add the field to the `Environment` interface**

In `backend/src/config/environment.ts`, find the `Environment` interface (it currently
ends with `GROQ_CHAT_MODEL: string;` right before the closing `}`). Add a new field
right after `GROQ_CHAT_MODEL: string;`:

```typescript
    GROQ_CHAT_MODEL: string;
    SLACK_WEBHOOK_URL: string;
}
```

- [ ] **Step 2: Add the value to the exported `env` object**

Find the `export const env: Environment = { ... }` object, which currently ends with
`GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'` right before its
closing `};`. Add a new line after it:

```typescript
    GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || ''
};
```

(Note the trailing comma added to the `GROQ_CHAT_MODEL` line since it's no longer the
last property.)

- [ ] **Step 3: Document the var in `.env.example`**

In `backend/.env.example`, after the existing block:

```
# Optional overrides (defaults work for most cases)
# GROQ_TRANSCRIBE_MODEL=whisper-large-v3-turbo
# GROQ_CHAT_MODEL=llama-3.1-8b-instant
```

add:

```

# Optional: Slack incoming webhook URL for the daily overdue action-item digest
# (worker process only). If unset, the job still runs on schedule but skips
# posting — see worker logs. Create one at https://api.slack.com/messaging/webhooks
SLACK_WEBHOOK_URL=
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/environment.ts backend/.env.example
git commit -m "feat(backend): add SLACK_WEBHOOK_URL env var for overdue notifications"
```

---

### Task 2: Notifications queue module + Bull Board wiring

**Files:**
- Create: `backend/src/notifications/notifications.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write the queue module**

This mirrors `backend/src/queue/queue.module.ts` (registers its own queue with the same
`defaultJobOptions` as `video-processing`) but does NOT call `BullModule.forRoot` again
— that's already registered once by `QueueModule`, and NestJS's BullMQ integration
only needs `forRoot` called once per application.

```typescript
// backend/src/notifications/notifications.module.ts
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
```

- [ ] **Step 2: Wire it into the API process for Bull Board visibility**

In `backend/src/app.module.ts`, add the import:

```typescript
import { NotificationsModule, OVERDUE_NOTIFICATIONS_QUEUE } from './notifications/notifications.module';
```

Add `NotificationsModule` to the `imports` array (right after `QueueModule,`), and add
a second `BullBoardModule.forFeature` call right after the existing one:

```typescript
    PrismaModule,
    QueueModule,
    NotificationsModule,
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      middleware: bullBoardAuthMiddleware,
    }),
    BullBoardModule.forFeature({ name: VIDEO_PROCESSING_QUEUE, adapter: BullMQAdapter }),
    BullBoardModule.forFeature({ name: OVERDUE_NOTIFICATIONS_QUEUE, adapter: BullMQAdapter }),
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/notifications/notifications.module.ts backend/src/app.module.ts
git commit -m "feat(backend): register overdue-notifications BullMQ queue"
```

---

### Task 3: Overdue notifications processor (query + Slack post)

**Files:**
- Create: `backend/src/notifications/overdue-notifications.processor.ts`

- [ ] **Step 1: Write the processor**

```typescript
// backend/src/notifications/overdue-notifications.processor.ts
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
      this.logger.error(`Slack webhook post failed: ${res.status} ${body}`);
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/notifications/overdue-notifications.processor.ts
git commit -m "feat(backend): add overdue action-item Slack digest processor"
```

---

### Task 4: Repeatable job scheduler + wire into worker

**Files:**
- Create: `backend/src/notifications/notifications-scheduler.service.ts`
- Modify: `backend/src/worker.module.ts`

- [ ] **Step 1: Write the scheduler service**

```typescript
// backend/src/notifications/notifications-scheduler.service.ts
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
```

Using a fixed `jobId` makes this idempotent — BullMQ recognizes the repeatable job
already exists on subsequent worker restarts rather than creating a duplicate schedule.

- [ ] **Step 2: Wire into `worker.module.ts`**

Replace the full contents of `backend/src/worker.module.ts`:

```typescript
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
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/notifications/notifications-scheduler.service.ts backend/src/worker.module.ts
git commit -m "feat(backend): schedule daily overdue-check repeatable job on worker boot"
```

---

### Task 5: Manual live verification

**Prerequisites:** Postgres+Redis running (`docker compose up -d` from the repo root),
a real Slack incoming webhook URL (create one at
https://api.slack.com/messaging/webhooks pointing at a test channel), backend API
(`npm run dev` in `backend/`) and worker (`npm run dev:worker` in `backend/`) both
running, `SLACK_WEBHOOK_URL` set in `backend/.env` to the real webhook URL, an
authenticated session (see the frontend auth-header fix — log in via `/login` first,
or use a `curl` request with a JWT from `POST /api/auth/login`).

- [ ] **Step 1: Confirm the repeatable job registered**

Check the worker's log output for `Registered daily overdue-check repeatable job (9am)`
on startup. Open Bull Board at `http://localhost:3001/api/admin/queues` (with a valid
JWT — same auth as the rest of the API) and confirm an `overdue-notifications` queue
tab exists with the repeatable job listed.

- [ ] **Step 2: Seed an overdue action item**

Using `psql` against the Postgres container (`docker exec -it
ai-meeting-summarizer-postgres-1 psql -U postgres -d meeting_summarizer`) or Prisma
Studio (`npx prisma studio` in `backend/`), find an existing `ActionItem` row (from a
previously-processed video) and set its `due_date` to a past date and `status` to
`'open'`. If none exist, process a test video first (per existing upload flow) to
generate one, then edit it.

- [ ] **Step 3: Manually trigger the job via Bull Board**

In the Bull Board UI, find the `overdue-notifications` queue, and use its UI to add a
job / trigger the repeatable job immediately (Bull Board supports manually queuing a
job with the same job name, `check-overdue`, with an empty `{}` payload). Confirm in
the worker log: `Posted overdue digest for N action item(s)`.

- [ ] **Step 4: Confirm the Slack message**

Check the Slack channel the webhook posts to. Expected: one message, header line with
the count, one bullet per overdue item showing task/assignee/due date/video title.

- [ ] **Step 5: Confirm the zero-overdue and unset-webhook cases**

Mark the test item's `status` back to `'done'` (or delete it), re-trigger the job via
Bull Board, confirm the worker log shows `No overdue action items — skipping Slack
digest` and no new Slack message appears. Then temporarily unset `SLACK_WEBHOOK_URL` in
`backend/.env`, restart the worker, seed an overdue item again, trigger the job, confirm
the worker log shows the "... but SLACK_WEBHOOK_URL is not set — skipping post" warning
and the worker doesn't crash. Restore `SLACK_WEBHOOK_URL` afterward.

- [ ] **Step 6: Update CLAUDE.md**

Mark this item done in the "Current state" section of `CLAUDE.md` (gitignored,
local-only) with the verification results from steps 1-5, and update the Phase 6 entry
to note the notification piece is no longer deferred.
