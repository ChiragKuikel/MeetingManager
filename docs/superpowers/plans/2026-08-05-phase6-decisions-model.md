# Phase 6 (core cut): Decisions/Action-Items/Open-Questions Data Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the opaque `Summary.actionItems` JSON blob with real, queryable `Decision`,
`ActionItem`, and `OpenQuestion` tables linked to `Video`, populate them from the Groq LLM
extraction step (extending its prompt), and resolve action-item assignees against real `User`
records.

**Architecture:** Three new Prisma models linked directly to `Video` (not `Summary`), each
carrying `organizationId` per this project's multi-tenancy convention. `groqService.ts`'s system
prompt and normalization logic extend to also emit `decisions[]`/`open_questions[]` alongside
the existing `action_items[]`/`key_points[]`/etc. `processing.processor.ts` persists all three
new tables in the same `$transaction` as the existing `Summary.upsert`, resolving each action
item's `assignee` string against `User.name` (case-insensitive, scoped to the video's org) and
parsing its `due` string into a real `DateTime?`. `summaries.service.ts`'s existing
`GET /summaries/video/:videoId` path is extended to include the new relations — no new endpoint.

**Tech Stack:** NestJS, Prisma 7 (driver-adapter `@prisma/adapter-pg`), Postgres, BullMQ
(existing job that this hooks into), Groq LLM API (existing).

No automated test framework exists in this repo (established pattern across Phases 2-4) —
verification is TypeScript compilation (`npx tsc --noEmit`) plus manual curl end-to-end checks,
per this project's established convention.

---

### Task 1: Prisma schema — add Decision/ActionItem/OpenQuestion, drop Summary.actionItems

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Creates: a new migration folder under `backend/prisma/migrations/` (name/timestamp assigned
  by Prisma CLI in Step 3)

- [ ] **Step 1: Add the three new models and the `ActionItemStatus` enum**

In `backend/prisma/schema.prisma`, add this enum right after the existing `enum VideoStatus`
block:

```prisma
enum ActionItemStatus {
  open
  done
}
```

Then add these three models at the end of the file (after the `Summary` model):

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

model ActionItem {
  id             Int              @id @default(autoincrement())
  organizationId Int              @map("organization_id")
  videoId        Int              @map("video_id")
  task           String
  assignee       String?
  ownerId        Int?             @map("owner_id")
  dueDate        DateTime?        @map("due_date")
  priority       String?
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

- [ ] **Step 2: Wire up back-relations and remove `Summary.actionItems`**

In `backend/prisma/schema.prisma`, modify the `Organization` model's relations block:

```prisma
  users  User[]
  videos Video[]
```
becomes:
```prisma
  users         User[]
  videos        Video[]
  decisions     Decision[]
  openQuestions OpenQuestion[]
  actionItems   ActionItem[]
```

Modify the `User` model's relations block:

```prisma
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  videos       Video[]

  @@index([organizationId])
  @@map("users")
```
becomes:
```prisma
  organization        Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  videos               Video[]
  assignedActionItems   ActionItem[]

  @@index([organizationId])
  @@map("users")
```

Modify the `Video` model's relations block:

```prisma
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  summary      Summary?

  @@index([userId, status])
  @@index([organizationId])
  @@map("videos")
```
becomes:
```prisma
  organization  Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  summary       Summary?
  decisions     Decision[]
  openQuestions OpenQuestion[]
  actionItems   ActionItem[]

  @@index([userId, status])
  @@index([organizationId])
  @@map("videos")
```

Remove the `actionItems` line from the `Summary` model:

```prisma
model Summary {
  id          Int      @id @default(autoincrement())
  videoId     Int      @unique @map("video_id")
  summaryText String?  @map("summary_text")
  keyPoints   Json?    @map("key_points")
  actionItems Json?    @map("action_items")
  speakers    Json?
  transcript  String?
```
becomes:
```prisma
model Summary {
  id          Int      @id @default(autoincrement())
  videoId     Int      @unique @map("video_id")
  summaryText String?  @map("summary_text")
  keyPoints   Json?    @map("key_points")
  speakers    Json?
  transcript  String?
```

- [ ] **Step 3: Generate and apply the migration**

Run: `cd backend && npx prisma migrate dev --name phase6_decisions_action_items`
Expected: prompts nothing (non-destructive additive changes plus one column drop on test-only
data), completes with `Your database is now in sync with your schema.` and regenerates the
Prisma client.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors (nothing references the new models yet, so this just confirms the generated
client compiled cleanly)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Decision/ActionItem/OpenQuestion models, drop Summary.actionItems"
```

---

### Task 2: Extend Groq LLM prompt + `groqService.ts` normalization

**Files:**
- Modify: `backend/src/services/groqService.ts`

- [ ] **Step 1: Extend the system prompt**

In `backend/src/services/groqService.ts`, inside `summarizeTranscriptToStructured`, replace the
`systemPrompt` string:

```typescript
        const systemPrompt = `You are a meeting notes assistant. Given a transcript, produce a single JSON object with these exact keys:
- "summary_text": string, 2-4 sentences overview
- "key_points": array of short strings (bullet-level facts)
- "action_items": array of objects with keys task (string), assignee (string, use "Unassigned" if unknown), due (string, ISO date YYYY-MM-DD or "TBD"), priority (one of "high","medium","low")
- "speakers": array of objects with keys name (string), speaking_time (string, approximate like "5:00" or "Unknown"), word_count (number estimate from transcript share), role (optional string)

Do not include markdown fences or commentary. No speaker diarization is provided; infer speakers only when the transcript clearly attributes speech, otherwise use one entry like {"name":"Speaker 1","speaking_time":"Unknown","word_count":0} or split roughly by paragraph if multiple voices are obvious.`;
```

with:

```typescript
        const systemPrompt = `You are a meeting notes assistant. Given a transcript, produce a single JSON object with these exact keys:
- "summary_text": string, 2-4 sentences overview
- "key_points": array of short strings (bullet-level facts)
- "action_items": array of objects with keys task (string), assignee (string, use "Unassigned" if unknown), due (string, ISO date YYYY-MM-DD or "TBD"), priority (one of "high","medium","low")
- "decisions": array of short strings, one per distinct decision made in the meeting (empty array if none)
- "open_questions": array of short strings, one per unresolved question raised in the meeting (empty array if none)
- "speakers": array of objects with keys name (string), speaking_time (string, approximate like "5:00" or "Unknown"), word_count (number estimate from transcript share), role (optional string)

Do not include markdown fences or commentary. No speaker diarization is provided; infer speakers only when the transcript clearly attributes speech, otherwise use one entry like {"name":"Speaker 1","speaking_time":"Unknown","word_count":0} or split roughly by paragraph if multiple voices are obvious.`;
```

- [ ] **Step 2: Extend `StructuredSummaryPayload`**

Replace:

```typescript
export interface StructuredSummaryPayload {
    summary_text: string;
    key_points: string[];
    action_items: ActionItem[];
    speakers: Speaker[];
}
```

with:

```typescript
export interface StructuredSummaryPayload {
    summary_text: string;
    key_points: string[];
    action_items: ActionItem[];
    decisions: string[];
    open_questions: string[];
    speakers: Speaker[];
}
```

- [ ] **Step 3: Wire new fields into `normalizeStructuredPayload`**

Replace:

```typescript
        const action_items = this.normalizeActionItems(parsed.action_items);
        const speakers = this.normalizeSpeakers(parsed.speakers);

        return {
            summary_text,
            key_points: key_points.length ? key_points : ['See transcript for details.'],
            action_items,
            speakers
        };
```

with:

```typescript
        const action_items = this.normalizeActionItems(parsed.action_items);
        const decisions = this.normalizeStringArray(parsed.decisions);
        const open_questions = this.normalizeStringArray(parsed.open_questions);
        const speakers = this.normalizeSpeakers(parsed.speakers);

        return {
            summary_text,
            key_points: key_points.length ? key_points : ['See transcript for details.'],
            action_items,
            decisions,
            open_questions,
            speakers
        };
```

- [ ] **Step 4: Add the `normalizeStringArray` helper**

Add this private method right after `normalizeActionItems` (before `normalizeSpeakers`):

```typescript
    private normalizeStringArray(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        return value
            .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((s: string) => s.trim());
    }
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/groqService.ts
git commit -m "feat(backend): extract decisions and open questions from Groq LLM output"
```

---

### Task 3: Persist decisions/action-items/open-questions in the processing job

**Files:**
- Modify: `backend/src/processing/processing.processor.ts`

- [ ] **Step 1: Remove `actionItems` from the `Summary.upsert` call**

Replace:

```typescript
      await this.prisma.summary.upsert({
        where: { videoId },
        create: {
          videoId,
          summaryText: structured.summary_text,
          keyPoints: structured.key_points as any,
          actionItems: structured.action_items as any,
          speakers: structured.speakers as any,
          transcript,
        },
        update: {
          summaryText: structured.summary_text,
          keyPoints: structured.key_points as any,
          actionItems: structured.action_items as any,
          speakers: structured.speakers as any,
          transcript,
        },
      });
```

with:

```typescript
      const ownerMap = await this.buildOwnerMap(video.organizationId);

      await this.prisma.$transaction([
        this.prisma.summary.upsert({
          where: { videoId },
          create: {
            videoId,
            summaryText: structured.summary_text,
            keyPoints: structured.key_points as any,
            speakers: structured.speakers as any,
            transcript,
          },
          update: {
            summaryText: structured.summary_text,
            keyPoints: structured.key_points as any,
            speakers: structured.speakers as any,
            transcript,
          },
        }),
        this.prisma.decision.deleteMany({ where: { videoId } }),
        this.prisma.decision.createMany({
          data: structured.decisions.map((description) => ({
            organizationId: video.organizationId,
            videoId,
            description,
          })),
        }),
        this.prisma.openQuestion.deleteMany({ where: { videoId } }),
        this.prisma.openQuestion.createMany({
          data: structured.open_questions.map((question) => ({
            organizationId: video.organizationId,
            videoId,
            question,
          })),
        }),
        this.prisma.actionItem.deleteMany({ where: { videoId } }),
        this.prisma.actionItem.createMany({
          data: structured.action_items.map((item) => ({
            organizationId: video.organizationId,
            videoId,
            task: item.task,
            assignee: item.assignee,
            ownerId: ownerMap.get(item.assignee.toLowerCase()) ?? null,
            dueDate: this.parseDueDate(item.due),
            priority: item.priority,
          })),
        }),
      ]);
```

- [ ] **Step 2: Add the `buildOwnerMap` and `parseDueDate` private helpers**

Add these two private methods to the `ProcessingProcessor` class, right after the `process`
method (before the closing brace of the class):

```typescript
  private async buildOwnerMap(organizationId: number): Promise<Map<string, number>> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const map = new Map<string, number>();
    for (const user of users) {
      if (user.name) map.set(user.name.toLowerCase(), user.id);
    }
    return map;
  }

  private parseDueDate(due: string): Date | null {
    if (!due || due.toUpperCase() === 'TBD') return null;
    const parsed = new Date(due);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/processing/processing.processor.ts
git commit -m "feat(backend): persist decisions/action-items/open-questions with owner resolution"
```

---

### Task 4: Expose new relations via the summaries API, drop `actionItems` from update DTO

**Files:**
- Modify: `backend/src/summaries/summaries.service.ts`
- Modify: `backend/src/summaries/dto/update-summary.dto.ts`

- [ ] **Step 1: Update `findByVideoId` to include the new relations**

In `backend/src/summaries/summaries.service.ts`, replace:

```typescript
  async findByVideoId(videoId: number) {
    const summary = await this.prisma.summary.findUnique({ where: { videoId } });
    if (!summary) throw new NotFoundException('Summary not found');
    return summary;
  }
```

with:

```typescript
  async findByVideoId(videoId: number) {
    const summary = await this.prisma.summary.findUnique({ where: { videoId } });
    if (!summary) throw new NotFoundException('Summary not found');

    const [decisions, openQuestions, actionItems] = await Promise.all([
      this.prisma.decision.findMany({ where: { videoId }, orderBy: { id: 'asc' } }),
      this.prisma.openQuestion.findMany({ where: { videoId }, orderBy: { id: 'asc' } }),
      this.prisma.actionItem.findMany({ where: { videoId }, orderBy: { id: 'asc' } }),
    ]);

    return { ...summary, decisions, openQuestions, actionItems };
  }
```

- [ ] **Step 2: Remove `actionItems` from the `update` method**

Replace:

```typescript
  async update(videoId: number, dto: UpdateSummaryDto) {
    const existing = await this.prisma.summary.findUnique({ where: { videoId } });
    if (!existing) throw new NotFoundException('Summary not found');

    return this.prisma.summary.update({
      where: { videoId },
      data: {
        summaryText: dto.summaryText,
        keyPoints: dto.keyPoints as any,
        actionItems: dto.actionItems as any,
      },
    });
  }
```

with:

```typescript
  async update(videoId: number, dto: UpdateSummaryDto) {
    const existing = await this.prisma.summary.findUnique({ where: { videoId } });
    if (!existing) throw new NotFoundException('Summary not found');

    return this.prisma.summary.update({
      where: { videoId },
      data: {
        summaryText: dto.summaryText,
        keyPoints: dto.keyPoints as any,
      },
    });
  }
```

- [ ] **Step 3: Remove `actionItems` from `UpdateSummaryDto`**

In `backend/src/summaries/dto/update-summary.dto.ts`, replace:

```typescript
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSummaryDto {
  @IsOptional()
  @IsString()
  summaryText?: string;

  @IsOptional()
  @IsArray()
  keyPoints?: unknown[];

  @IsOptional()
  @IsArray()
  actionItems?: unknown[];
}
```

with:

```typescript
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSummaryDto {
  @IsOptional()
  @IsString()
  summaryText?: string;

  @IsOptional()
  @IsArray()
  keyPoints?: unknown[];
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/summaries/summaries.service.ts backend/src/summaries/dto/update-summary.dto.ts
git commit -m "feat(backend): expose decisions/action-items/open-questions via summaries API"
```

---

### Task 5: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start Postgres + Redis, then the API and worker**

Run:
```bash
docker compose up -d
cd backend && npm run dev
```
In a second terminal:
```bash
cd backend && npm run dev:worker
```
Expected: both processes start without error, API logs `Server running on
http://localhost:3001`.

- [ ] **Step 2: Prepare a test audio file with a crafted transcript**

This step needs a short audio file (even a few seconds of speech is fine) whose content, when
transcribed, will clearly contain: one decision, one open question, and one action item
assigned to `Default User` (the seeded dev user's exact name) with a concrete due date. If
recording audio isn't practical in this environment, use any short existing test video/audio
already in the repo's `uploads/` or test fixtures if one exists; otherwise text-to-speech a
sentence like: *"We decided to launch the beta next month. One open question is whether we
need a second reviewer. Default User will finish the onboarding doc by January 15th, 2027."*

- [ ] **Step 3: Log in and upload the file**

Get a token (reuse the seeded dev user, or signup a new one — either works since the video will
belong to whichever user uploads it):
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"devpassword123"}'
```
Save the `accessToken` as `$TOKEN`, then upload:
```bash
curl -s -X POST http://localhost:3001/api/videos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@/path/to/test-audio-or-video-file"
```
Expected: `{"success":true,"data":{"id":<videoId>,...}}` — note `<videoId>`.

- [ ] **Step 4: Poll until processing completes**

Run (replace `<videoId>`):
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/videos/<videoId>/status
```
Repeat every few seconds until `"status":"completed"` (or `"failed"` — if failed, check the
worker's log output for the error).

- [ ] **Step 5: Fetch the summary and verify the new fields**

Run:
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/summaries/video/<videoId>
```
Expected: response includes non-empty `decisions` and `openQuestions` arrays with text matching
the crafted transcript, and `actionItems` with one entry where `assignee` is `"Default User"`,
`ownerId` equals the seeded dev user's id (`1`), `dueDate` is a valid non-null ISO date string,
and `status` is `"open"`.

- [ ] **Step 6: Verify idempotency on reprocessing**

Re-trigger processing for the same video:
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/summaries/video/<videoId>/generate
```
(If this returns a `400 Summary already exists` error because `generate()` is still the Phase-2
stub that guards against re-generation, that's expected and fine — it proves the guard still
works. To actually test the delete-then-recreate transaction logic, instead re-run the same
video through the BullMQ queue directly, e.g. by re-enqueuing via a short Node script using
`ProcessingService`, or simply re-upload the same file as a second video and confirm its
`decisions`/`actionItems`/`openQuestions` counts match the first video's — proving the
extraction+persistence logic is deterministic and doesn't accumulate duplicates within a single
video's rows.)
Then re-fetch `GET /api/summaries/video/<videoId>` and confirm the `decisions`/`actionItems`/
`openQuestions` array lengths are unchanged (not doubled) from Step 5.

- [ ] **Step 7: Stop the dev processes**

Kill the `npm run dev` and `npm run worker` processes (Ctrl+C in each terminal, or find and kill
their PIDs) once verification passes.
