# Phase 6 (core cut): Decisions/Action-Items/Open-Questions data model

## Context

This is Phase 6 of the meeting-summarizer migration (`migration-plan.md`): "Extend the data
model toward the real product goal" — turning "video summarizer" into "meeting accountability
system." The full phase as originally scoped bundles four fairly independent pieces: (1) the
core data model + LLM prompt extension, (2) owner-name resolution against `User` records, (3) a
scheduled job flagging overdue action items with Slack/email notification, (4) a frontend task
list view.

This spec covers only pieces (1) and (2) — the core relational model, the Groq LLM prompt/
service changes to populate it, and owner resolution. Pieces (3) and (4) are deferred to their
own specs once this lands, since (3) needs an external-integration decision (Slack vs email)
that's orthogonal to the data model, and (4) depends on this backend work existing first.

Currently `Summary.actionItems` is a JSON blob column populated from the LLM's raw output, with
no structure Prisma/Postgres can query, filter, or join on. This spec replaces it with real
`Decision`, `ActionItem`, and `OpenQuestion` tables linked to `Video`, so future phases (the
overdue-job, the frontend view, and eventually Phase 7's search) have queryable, indexed data
instead of an opaque JSON blob.

## Data model

Three new models, plus one column removal on `Summary`. All three new models follow this
project's `organizationId`-on-every-entity convention (see `CLAUDE.md`) and link directly to
`Video` (not `Summary`) since they're conceptually properties of the meeting, not of the
generated summary text — this avoids an awkward two-hop relation if `Summary` is ever
regenerated or deleted independently of the video.

```prisma
model Decision {
  id             Int      @id @default(autoincrement())
  organizationId Int      @map("organization_id")
  videoId        Int      @map("video_id")
  description    String
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  video        Video        @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@index([videoId])
  @@index([organizationId])
  @@map("decisions")
}

model OpenQuestion {
  id             Int      @id @default(autoincrement())
  organizationId Int      @map("organization_id")
  videoId        Int      @map("video_id")
  question       String
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  video        Video        @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@index([videoId])
  @@index([organizationId])
  @@map("open_questions")
}

enum ActionItemStatus {
  open
  done
}

model ActionItem {
  id             Int              @id @default(autoincrement())
  organizationId Int              @map("organization_id")
  videoId        Int              @map("video_id")
  task           String
  assignee       String?          // raw LLM-extracted name, kept regardless of match
  ownerId        Int?             @map("owner_id") // resolved User, null if no match
  dueDate        DateTime?        @map("due_date")
  priority       String?          // "high"/"medium"/"low", kept as-is from the LLM
  status         ActionItemStatus @default(open)
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  video        Video        @relation(fields: [videoId], references: [id], onDelete: Cascade)
  owner        User?        @relation(fields: [ownerId], references: [id], onDelete: SetNull)

  @@index([videoId])
  @@index([organizationId])
  @@index([ownerId])
  @@map("action_items")
}
```

`Video` gains three back-relations: `decisions Decision[]`, `openQuestions OpenQuestion[]`,
`actionItems ActionItem[]`. `User` gains `assignedActionItems ActionItem[]`.

`Summary.actionItems` (the JSON column) is dropped in the same migration. Existing rows lose
that data — acceptable, this project's DB only ever held test data (same precedent as the
Phase 1 MySQL→Postgres cutover, which didn't migrate old rows either).

**Status field:** `open`/`done` only, no `in_progress` — the migration plan only ever mentions
"status" for a future task-list view and an overdue-flagging job, neither of which need a third
state yet. Defaulting new rows to `open`.

**Owner resolution:** case-insensitive exact match against `User.name`, scoped to the video's
`organizationId`. No fuzzy matching, no email-local-part fallback — kept simple. If two `User`s
in the same org happen to share a name, the first match wins (a known, accepted limitation, not
solved here). Unmatched names keep the raw `assignee` string with `ownerId: null` — never
silently dropped.

**Due date:** stored as `DateTime?`. The LLM already outputs either an ISO `YYYY-MM-DD` string
or the literal `"TBD"` (existing prompt behavior, unchanged). Parsed via `new Date(due)`;
invalid dates and `"TBD"` both become `null`, since a later overdue-flagging job needs to
compare against `now()` and can't do that against a string.

## LLM prompt + `groqService.ts` changes

The system prompt in `summarizeTranscriptToStructured` gains two new required JSON keys,
alongside the four that already exist:
- `"decisions"`: array of short strings, one per distinct decision made in the meeting.
- `"open_questions"`: array of short strings, one per unresolved question raised.

`StructuredSummaryPayload` gains `decisions: string[]` and `open_questions: string[]`.

New `normalizeDecisions`/`normalizeOpenQuestions` private methods, mirroring the existing
`key_points` normalization pattern: filter the raw array to non-empty trimmed strings. Unlike
`key_points` and `summary_text`, these get **no fallback placeholder** — an empty array is a
valid, meaningful result (not every meeting has open questions), whereas `key_points`/
`summary_text` always expect *something* from a real transcript.

`ActionItem`'s parsing (`normalizeActionItems`) is unchanged — it still just validates
`task`/`assignee`/`due`/`priority` as raw strings. Owner-name resolution and due-date parsing
both require DB access, so they happen in the processor, not in `groqService` (which has no
DB dependency today and shouldn't gain one for this).

## `processing.processor.ts` changes

After the existing `transcribeAudioFile` → `summarizeTranscriptToStructured` call:

1. `Summary.upsert` drops the `actionItems` field (column no longer exists).
2. Fetch all `User` rows for `video.organizationId` once (`prisma.user.findMany({ where: {
   organizationId: video.organizationId } })`), build a case-insensitive
   `name.toLowerCase() → id` map in memory. Looping per-item DB lookups would be wasteful and
   unnecessary — org user lists are small.
3. For each structured action item: look up `ownerId` from that map (`undefined` → `null`);
   parse `due` via `new Date(due)`, treating both invalid dates and the literal `"TBD"` as
   `null`.
4. Persist everything in one `$transaction`: the `Summary.upsert` plus, for each of `Decision`/
   `ActionItem`/`OpenQuestion`, a `deleteMany({ where: { videoId } })` followed by
   `createMany(...)`. All in the same transaction so a partial failure can't leave the summary
   updated but the related rows stale (or vice versa). The delete-then-create step mirrors why
   `Summary` uses `upsert` instead of `create`: a video can be reprocessed (retry, or a future
   manual re-run), and without clearing old rows first, reprocessing would duplicate every
   decision/action-item/open-question instead of replacing them.

No new error-handling path: if the transaction throws, it propagates to the `process()` method's
existing `try/catch`, which already marks the video `failed` with the error message — the same
path every other failure in this job already takes.

## `summaries.service.ts` / API changes

`findByVideoId` adds an `include` for the new relations so `GET /api/summaries/video/:videoId`
returns them alongside the existing summary fields — no new endpoint. Response shape:

```jsonc
{
  "success": true,
  "data": {
    // ...existing summary fields (summaryText, keyPoints, speakers, transcript)...
    "decisions": [{ "id": 1, "description": "..." }],
    "openQuestions": [{ "id": 1, "question": "..." }],
    "actionItems": [
      { "id": 1, "task": "...", "assignee": "Default User", "ownerId": 1, "dueDate": "2026-01-01T00:00:00.000Z", "priority": "high", "status": "open" }
    ]
  }
}
```

## Verification

No automated test framework exists in this repo (established pattern — Phases 2-4 all verified
via manual curl e2e). Verification for this phase:

1. Upload a short video/audio whose transcript is deliberately crafted to contain: one clear
   decision, one clear open question, and one action item assigned to the seeded dev user's
   exact name (`Default User`) with a concrete due date.
2. Poll `/api/videos/:id/status` until `completed`.
3. `GET /api/summaries/video/:id` and confirm: `decisions`/`openQuestions` arrays are non-empty
   with the expected text; `actionItems[0].ownerId` resolves to the seeded user's id (proving
   the name-match path works end-to-end, not just in isolation); `dueDate` is a valid parsed
   date, not `null`.
4. Re-trigger processing for the same video (simulating a retry) and confirm row counts for
   `Decision`/`ActionItem`/`OpenQuestion` don't double — proving the `deleteMany`+`createMany`
   idempotency actually holds.
