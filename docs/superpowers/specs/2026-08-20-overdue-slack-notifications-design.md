# Overdue action-item Slack notifications — design spec

Date: 2026-08-20

## Problem

Phase 6's core cut (see `CLAUDE.md`'s "Current state" section) built the `ActionItem`
model with `status`/`dueDate` but deliberately deferred the notification piece: nothing
currently alerts anyone when an action item is overdue. This is the last deferred piece
of Phase 6.

## Scope

- One daily Slack message (a "digest") listing every currently-overdue, still-open
  action item across the organization.
- Single global Slack incoming webhook (env var `SLACK_WEBHOOK_URL`), matching this
  project being single-org today. No per-user Slack mapping, no Slack OAuth.
- "Overdue" = `ActionItem.status = 'open' AND dueDate < now()`. Purely a live query —
  no new DB column, no "already notified" tracking. An item stays in the digest every
  day until it's marked done or its due date is updated. This matches "keep nagging
  until resolved," which needs zero new state and can't drift out of sync with reality.
- Scheduled via a BullMQ repeatable job (daily 9am server time), registered once at
  worker startup — reuses the existing queue/worker infra from Phase 3 (see
  `CLAUDE.md`) rather than adding a new scheduling dependency.
- If there are zero overdue items on a given run, skip posting (no empty/noise message).
- If `SLACK_WEBHOOK_URL` is unset, the job still runs (so it doesn't silently disappear
  from the schedule) but logs a warning and skips the POST — doesn't crash the worker.

Explicitly out of scope: email, per-user notification preferences, "notify once" /
notification history, Slack OAuth/interactive messages, configurable schedule/timezone.

## Components

**`backend/prisma/schema.prisma`** — no changes.

**`backend/.env.example`** — document the new `SLACK_WEBHOOK_URL` var (optional).

**`backend/src/config/environment.ts`** — add `SLACK_WEBHOOK_URL: string` to the
`Environment` interface, defaulting to `''` when unset (not a hard failure like
`JWT_SECRET`, since this feature can no-op without it).

**`backend/src/notifications/notifications.module.ts`** (new)
Registers a new BullMQ queue, `overdue-notifications`, alongside the existing
`video-processing` queue registration pattern in `queue.module.ts`. Exports the queue
so both the API/worker bootstrap (to schedule the repeatable job) and the processor (to
consume it) can use it.

**`backend/src/notifications/overdue-notifications.processor.ts`** (new)
`@Processor('overdue-notifications')`, worker-only (registered in `worker.module.ts`
alongside `ProcessingProcessor`, not in the API's `app.module.ts`). On each job run:
1. Query all `ActionItem` rows where `status = 'open'` and `dueDate < now()`, including
   `video` (for title) and `owner`/`assignee`.
2. If the result is empty, log and return (no Slack post).
3. If `SLACK_WEBHOOK_URL` is empty, log a warning and return.
4. Build a single Slack message (`{ text: "..." }`) — a header line with the count,
   then one bullet per item: task, assignee (or "Unassigned"), due date, video title.
5. POST it to `SLACK_WEBHOOK_URL` via raw `fetch` (matches the existing `groqService`
   convention of raw `fetch`, no SDK). Log success/failure; a failed POST doesn't retry
   beyond BullMQ's existing default job-attempt behavior — this queue reuses the same
   `attempts: 3` / exponential backoff `defaultJobOptions` as `video-processing`.

**`backend/src/worker.module.ts`** (modify)
Add `NotificationsModule` to `imports`, add `OverdueNotificationsProcessor` to
`providers`. Add an `OnModuleInit` (small `NotificationsSchedulerService` or inline in
`WorkerModule`) that calls
`queue.add('check-overdue', {}, { repeat: { pattern: '0 9 * * *' }, jobId: 'daily-overdue-check' })`
once at boot. Using a fixed `jobId` on a repeatable job makes registration idempotent —
restarting the worker doesn't create duplicate schedules.

## Data flow

Worker boots → registers the repeatable job (no-op if already registered) → BullMQ
fires it daily at 9am → `OverdueNotificationsProcessor` queries overdue items → builds
and posts one Slack message (or skips if nothing overdue / webhook unset) → logs the
outcome.

## Testing

No test framework exists in `backend/` beyond what Phase 3/4/5/6 already established
(manual/live verification is this project's convention — see `CLAUDE.md`). Verification
plan: seed or create an `ActionItem` with a past `dueDate` and `status: 'open'`, manually
trigger the job (either wait for the schedule or add a one-off job with the same job
name for testing), confirm the Slack message arrives in a test channel with correct
content, confirm a run with zero overdue items posts nothing, confirm an unset
`SLACK_WEBHOOK_URL` logs a warning and doesn't crash the worker.
