# Phase 7: pgvector Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hybrid (full-text + semantic) search across a user's Decisions, Action Items, and
Open Questions, using free local embeddings.

**Architecture:** A new `SearchItem` table stores one row per Decision/ActionItem/OpenQuestion
with its embedded text (pgvector `vector(384)`) and a generated `tsvector` column. A new worker-only
BullMQ queue (`search-indexing`) is enqueued by the existing video-processing job right after it
commits Decision/ActionItem/OpenQuestion rows, and (re)builds that video's `SearchItem` rows using
a local embedding model. A new `GET /api/search` endpoint runs full-text and vector queries in
parallel and merges them with Reciprocal Rank Fusion. A new `/search` frontend page renders
results grouped by source video.

**Tech Stack:** NestJS, Prisma (raw SQL for the vector column), BullMQ, `@xenova/transformers`
(local `all-MiniLM-L6-v2` embedding model, runs in-process, no external API), Next.js/React.

**Spec:** `docs/superpowers/specs/2026-08-25-phase7-pgvector-search-design.md`

**Note on testing approach:** This project has no test framework installed (no Jest config, no
`.spec.ts` files under `backend/src`) — every prior phase (4, 5, 6) was verified live via curl/
Playwright against the running dev stack instead of automated tests, per `CLAUDE.md`'s documented
history. This plan follows that same established convention: each backend task is verified with
a small standalone `ts-node` script or curl command against the real dev database, not a unit
test suite. Do not introduce Jest as a side effect of this plan — that would be an unrelated,
undiscussed infrastructure change.

**Deviation from spec found during planning:** the spec's `SearchSourceType` enum values
(`DECISION`/`ACTION_ITEM`/`OPEN_QUESTION`) are uppercase, but every existing Prisma enum in this
schema (`VideoStatus`, `ActionItemStatus`) uses lowercase values. This plan uses lowercase
(`decision`/`action_item`/`open_question`) to match the established convention. Also, the spec
says "scoped to the caller's organization" — but every existing scoped endpoint
(`ActionItemsService.listForUser`, `VideosService.listByUser`) actually scopes by `userId`
through a `video: { userId }` relation filter, not `organizationId` directly (organizationId is
multi-tenancy prep, not yet the real access boundary — see `CLAUDE.md`). This plan scopes search
the same way, for consistency with every other endpoint.

---

### Task 1: Install the embedding library

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install `@xenova/transformers`**

Run: `npm install @xenova/transformers --save` (from `backend/`)

Expected: `package.json` dependencies gains `"@xenova/transformers": "^2.17.2"` (or newer patch),
`package-lock.json` updates.

`@xenova/transformers` ships as `"type": "module"` (ESM-only) — this project's `tsconfig.json`
compiles to CommonJS, so it **cannot** be imported with a static `import` statement at the top of
a file (that would throw `ERR_REQUIRE_ESM` at runtime). Every later task that uses this package
uses a dynamic `await import('@xenova/transformers')` inside a function body instead — keep that
pattern, do not "simplify" it to a static import.

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add @xenova/transformers for local embeddings"
```

---

### Task 2: Add the `SearchItem` model and `SearchSourceType` enum to the Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the enum**

Add near the other enums (after `ActionItemStatus`, around line 25):

```prisma
enum SearchSourceType {
  decision
  action_item
  open_question
}
```

- [ ] **Step 2: Add the back-relations to `Organization` and `Video`**

In `model Organization` (around line 27-40), add `searchItems SearchItem[]` alongside the
existing `decisions`/`openQuestions`/`actionItems` relation lines:

```prisma
  decisions     Decision[]
  openQuestions OpenQuestion[]
  actionItems   ActionItem[]
  searchItems   SearchItem[]
```

In `model Video` (around line 59-84), add the same relation line alongside `decisions`/
`openQuestions`:

```prisma
  decisions     Decision[]
  openQuestions OpenQuestion[]
  searchItems   SearchItem[]
```

(Match whatever the existing relation block looks like exactly — just add one line, don't
reorder the others.)

- [ ] **Step 3: Add the `SearchItem` model**

Add after the existing `ActionItem` model:

```prisma
model SearchItem {
  id             Int              @id @default(autoincrement())
  organizationId Int              @map("organization_id")
  videoId        Int              @map("video_id")
  sourceType     SearchSourceType @map("source_type")
  sourceId       Int              @map("source_id")
  text           String
  embedding      Unsupported("vector(384)")
  createdAt      DateTime         @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  video        Video        @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([videoId])
  @@map("search_items")
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(backend): add SearchItem model for Phase 7 search"
```

---

### Task 3: Create and hand-edit the migration

**Files:**
- Create: `backend/prisma/migrations/<timestamp>_phase7_search_items/migration.sql` (generated,
  then hand-edited)

- [ ] **Step 1: Generate the migration without applying it**

Run (from `backend/`): `npx prisma migrate dev --create-only --name phase7_search_items`

Expected: a new folder under `backend/prisma/migrations/` containing a `migration.sql` with a
`CREATE TYPE "SearchSourceType" AS ENUM (...)` and a `CREATE TABLE "search_items" (...)` (the
`embedding` column will appear as `"embedding" vector(384)` verbatim — Prisma emits `Unsupported()`
types as raw SQL even though its client can't query them), plus the two `@@index` lines as
`CREATE INDEX` statements.

- [ ] **Step 2: Hand-edit the generated `migration.sql` to add the full-text column and both indexes**

Append to the end of the generated file:

```sql
-- Generated full-text column, kept in sync automatically by Postgres on every insert/update.
ALTER TABLE "search_items" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED;

CREATE INDEX "search_items_search_vector_idx" ON "search_items" USING GIN ("search_vector");

-- ivfflat is fine at this data scale; revisit as HNSW later if the dataset grows (index-only change).
CREATE INDEX "search_items_embedding_idx" ON "search_items" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
```

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev` (from `backend/`, with the Docker Postgres container running —
`docker ps` should show `ai-meeting-summarizer-postgres-1` as healthy; start the stack with
`docker compose up -d` from the repo root first if it isn't)

Expected: `Applying migration ...phase7_search_items` then `Your database is now in sync with
your schema.` — this also regenerates the Prisma client under `backend/src/generated/prisma`.

- [ ] **Step 4: Verify the table and indexes exist**

Run: `docker exec -it ai-meeting-summarizer-postgres-1 psql -U postgres -d meeting_summarizer -c "\d search_items"`

Expected: output lists all columns including `embedding` as `vector(384)` and `search_vector` as
`tsvector`, plus indexes `search_items_pkey`, `search_items_organizationId_idx`,
`search_items_videoId_idx`, `search_items_search_vector_idx`, `search_items_embedding_idx`.
(Adjust the DB name/user/container name if your local `.env`/compose file differs — check
`backend/.env` for `DB_NAME`/`DB_USER` and `docker ps` for the actual container name.)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations
git commit -m "feat(backend): migrate SearchItem table with tsvector and pgvector indexes"
```

---

### Task 4: Shared `EmbeddingService`

**Files:**
- Create: `backend/src/embedding/embedding.module.ts`
- Create: `backend/src/embedding/embedding.service.ts`

- [ ] **Step 1: Write `embedding.service.ts`**

```typescript
// backend/src/embedding/embedding.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

type FeatureExtractionOutput = { data: Float32Array | number[] };
type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: 'mean'; normalize?: boolean }
) => Promise<FeatureExtractionOutput>;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: FeatureExtractionPipeline | null = null;

  async onModuleInit(): Promise<void> {
    // @xenova/transformers is ESM-only; this project compiles to CommonJS, so it must be
    // loaded via a dynamic import rather than a static one (see Task 1's note).
    const { pipeline } = await import('@xenova/transformers');
    this.extractor = (await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    )) as unknown as FeatureExtractionPipeline;
    this.logger.log('Embedding model loaded (Xenova/all-MiniLM-L6-v2)');
  }

  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new Error('EmbeddingService not initialized yet — model still loading');
    }
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }
}
```

- [ ] **Step 2: Write `embedding.module.ts`**

```typescript
// backend/src/embedding/embedding.module.ts
import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

@Global()
@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
```

`@Global()` matches `PrismaModule`'s pattern — import it once at the root (both `app.module.ts`
and `worker.module.ts` in later tasks) rather than in every feature module that needs it.

- [ ] **Step 3: Verify the model loads and produces a 384-dim vector**

Create a throwaway script, run it, then delete it (this is a manual smoke test, not part of the
codebase):

```typescript
// backend/scratch-embed-test.ts (temporary — delete after running)
import 'reflect-metadata';
import { EmbeddingService } from './src/embedding/embedding.service';

async function main() {
  const svc = new EmbeddingService();
  await svc.onModuleInit();
  const vec = await svc.embed('We decided to ship the search feature next sprint.');
  console.log('vector length:', vec.length);
  console.log('first 5 values:', vec.slice(0, 5));
}

main();
```

Run: `npx ts-node backend/scratch-embed-test.ts`

Expected: first run downloads the model (logs progress, ~90MB, one-time, cached under
`~/.cache` or similar afterward), then prints `vector length: 384` and 5 numbers between -1 and 1.

- [ ] **Step 4: Delete the scratch script**

Run: `rm backend/scratch-embed-test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/embedding
git commit -m "feat(backend): add local EmbeddingService using transformers.js"
```

---

### Task 5: `search-indexing` BullMQ queue module

**Files:**
- Create: `backend/src/search/search-indexing.module.ts`

- [ ] **Step 1: Write the module**

```typescript
// backend/src/search/search-indexing.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const SEARCH_INDEXING_QUEUE = 'search-indexing';

export interface SearchIndexingJob {
  videoId: number;
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: SEARCH_INDEXING_QUEUE,
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
export class SearchIndexingModule {}
```

This matches `notifications.module.ts`'s exact pattern (queue name const + job interface +
`registerQueue` + export `BullModule` so consumers elsewhere can `@InjectQueue`).

- [ ] **Step 2: Commit**

```bash
git add backend/src/search/search-indexing.module.ts
git commit -m "feat(backend): register search-indexing BullMQ queue"
```

---

### Task 6: `SearchIndexingProcessor` (worker)

**Files:**
- Create: `backend/src/search/search-indexing.processor.ts`

- [ ] **Step 1: Write the processor**

```typescript
// backend/src/search/search-indexing.processor.ts
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SEARCH_INDEXING_QUEUE, SearchIndexingJob } from './search-indexing.module';

interface TextRow {
  sourceType: 'decision' | 'action_item' | 'open_question';
  sourceId: number;
  text: string;
}

@Processor(SEARCH_INDEXING_QUEUE)
export class SearchIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService
  ) {
    super();
  }

  async process(job: Job<SearchIndexingJob>): Promise<void> {
    const { videoId } = job.data;
    const video = await this.prisma.video.findUniqueOrThrow({ where: { id: videoId } });

    await this.prisma.searchItem.deleteMany({ where: { videoId } });

    const rows = await this.buildTextRows(videoId);

    for (const row of rows) {
      const vector = await this.embedding.embed(row.text);
      const vectorLiteral = `[${vector.join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO search_items (organization_id, video_id, source_type, source_id, text, embedding)
        VALUES (${video.organizationId}, ${videoId}, ${row.sourceType}::"SearchSourceType", ${row.sourceId}, ${row.text}, ${vectorLiteral}::vector)
      `;
    }

    this.logger.log(`Indexed ${rows.length} search item(s) for video ${videoId}`);
  }

  private async buildTextRows(videoId: number): Promise<TextRow[]> {
    const [decisions, actionItems, openQuestions] = await Promise.all([
      this.prisma.decision.findMany({ where: { videoId } }),
      this.prisma.actionItem.findMany({ where: { videoId } }),
      this.prisma.openQuestion.findMany({ where: { videoId } }),
    ]);

    return [
      ...decisions.map((d) => ({
        sourceType: 'decision' as const,
        sourceId: d.id,
        text: d.description,
      })),
      ...actionItems.map((a) => ({
        sourceType: 'action_item' as const,
        sourceId: a.id,
        text: `${a.task} (assignee: ${a.assignee ?? 'unassigned'})`,
      })),
      ...openQuestions.map((q) => ({
        sourceType: 'open_question' as const,
        sourceId: q.id,
        text: q.question,
      })),
    ];
  }
}
```

`searchItem.deleteMany` works through the normal Prisma client even though the model has one
`Unsupported()` field — only `embedding` itself is excluded from client read/write, every other
field and standard query method works as normal. The insert needs raw SQL specifically because
`embedding` can't be set through the client.

- [ ] **Step 2: Commit**

```bash
git add backend/src/search/search-indexing.processor.ts
git commit -m "feat(backend): add SearchIndexingProcessor to build SearchItem rows"
```

---

### Task 7: Wire `search-indexing` into `worker.module.ts` and enqueue it from `ProcessingProcessor`

**Files:**
- Modify: `backend/src/worker.module.ts`
- Modify: `backend/src/processing/processing.processor.ts`

- [ ] **Step 1: Update `worker.module.ts`**

```typescript
// backend/src/worker.module.ts
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
```

- [ ] **Step 2: Update `processing.processor.ts` to inject the queue and enqueue after the transaction**

Add imports at the top (after the existing `VIDEO_PROCESSING_QUEUE` import line):

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SEARCH_INDEXING_QUEUE, SearchIndexingJob } from '../search/search-indexing.module';
```

Change the constructor from:

```typescript
  constructor(private readonly prisma: PrismaService) {
    super();
  }
```

to:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SEARCH_INDEXING_QUEUE) private readonly searchIndexingQueue: Queue<SearchIndexingJob>
  ) {
    super();
  }
```

Add the enqueue call immediately after the `$transaction([...])` call and before the
`video.update({ ... status: 'completed' ... })` call (so it only fires once
Decision/ActionItem/OpenQuestion rows have actually been committed):

```typescript
      await this.prisma.$transaction([
        // ...unchanged...
      ]);

      await this.searchIndexingQueue.add('index-search-items', { videoId });

      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'completed', errorMessage: null },
      });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (from `backend/`)

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/worker.module.ts backend/src/processing/processing.processor.ts
git commit -m "feat(backend): enqueue search-indexing job after video processing completes"
```

---

### Task 8: `GET /api/search` endpoint

**Files:**
- Create: `backend/src/search/search.service.ts`
- Create: `backend/src/search/search.controller.ts`
- Create: `backend/src/search/search.module.ts`

- [ ] **Step 1: Write `search.service.ts`**

```typescript
// backend/src/search/search.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';

interface SearchRow {
  id: number;
  source_type: 'decision' | 'action_item' | 'open_question';
  text: string;
  video_id: number;
  video_title: string;
}

export interface SearchResult {
  sourceType: 'decision' | 'action_item' | 'open_question';
  text: string;
  videoId: number;
  videoTitle: string;
  score: number;
}

const RRF_K = 60;
const RESULT_LIMIT = 20;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService
  ) {}

  async search(query: string, userId: number): Promise<SearchResult[]> {
    const queryVector = await this.embedding.embed(query);
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const [fullText, vector] = await Promise.all([
      this.prisma.$queryRaw<SearchRow[]>`
        SELECT si.id, si.source_type, si.text, si.video_id, v.title AS video_title
        FROM search_items si
        JOIN videos v ON v.id = si.video_id
        WHERE v.user_id = ${userId}
          AND si.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank(si.search_vector, plainto_tsquery('english', ${query})) DESC
        LIMIT ${RESULT_LIMIT}
      `,
      this.prisma.$queryRaw<SearchRow[]>`
        SELECT si.id, si.source_type, si.text, si.video_id, v.title AS video_title
        FROM search_items si
        JOIN videos v ON v.id = si.video_id
        WHERE v.user_id = ${userId}
        ORDER BY si.embedding <=> ${vectorLiteral}::vector
        LIMIT ${RESULT_LIMIT}
      `,
    ]);

    return this.mergeRRF(fullText, vector);
  }

  private mergeRRF(fullText: SearchRow[], vector: SearchRow[]): SearchResult[] {
    const scored = new Map<number, { row: SearchRow; score: number }>();

    const addRanked = (rows: SearchRow[]) => {
      rows.forEach((row, index) => {
        const rankScore = 1 / (RRF_K + index + 1);
        const existing = scored.get(row.id);
        scored.set(row.id, {
          row: existing?.row ?? row,
          score: (existing?.score ?? 0) + rankScore,
        });
      });
    };

    addRanked(fullText);
    addRanked(vector);

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT)
      .map(({ row, score }) => ({
        sourceType: row.source_type,
        text: row.text,
        videoId: row.video_id,
        videoTitle: row.video_title,
        score,
      }));
  }
}
```

- [ ] **Step 2: Write `search.controller.ts`**

```typescript
// backend/src/search/search.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async get(@Query('q') q: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!q || !q.trim()) {
      throw new BadRequestException('q query parameter is required');
    }

    const data = await this.search.search(q.trim(), user.id);
    return { success: true, data };
  }
}
```

- [ ] **Step 3: Write `search.module.ts`**

```typescript
// backend/src/search/search.module.ts
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
```

`PrismaModule` and `EmbeddingModule` don't need to be listed in `imports` — both are `@Global()`
and already imported once at the app root (this task wires that root import in the next step).

- [ ] **Step 4: Wire into `app.module.ts`**

Add imports:

```typescript
import { EmbeddingModule } from './embedding/embedding.module';
import { SearchModule } from './search/search.module';
```

Add both to the `imports` array (`EmbeddingModule` alongside `PrismaModule`/`QueueModule`,
`SearchModule` alongside `ActionItemsModule`):

```typescript
  imports: [
    PrismaModule,
    QueueModule,
    NotificationsModule,
    EmbeddingModule,
    BullBoardModule.forRoot({ ... }),
    // ...unchanged...
    ActionItemsModule,
    SearchModule,
    ProcessingModule,
    HealthModule,
  ],
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` (from `backend/`)

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/search backend/src/app.module.ts
git commit -m "feat(backend): add GET /api/search hybrid full-text + vector endpoint"
```

---

### Task 9: Live backend verification

**Files:** none (manual verification only)

- [ ] **Step 1: Start the full stack**

From repo root: confirm `docker ps` shows Postgres+Redis healthy (start with
`docker compose up -d` if not). Then, in three separate terminals from `backend/`:
`npm run dev` (API), `npm run dev:worker` (worker). From `frontend/`: `npm run dev` isn't needed
for this task yet (covered in Task 11).

- [ ] **Step 2: Upload a real video/audio file and wait for processing**

Use the existing `/video` upload flow (or a direct curl to the upload endpoint with a valid JWT
from `dev@example.com`/`devpassword123`, same as prior phases' verification). Watch the worker
log for `Processing completed for video <id>` followed by
`Indexed <N> search item(s) for video <id>` — the second line confirms the new
`search-indexing` job ran automatically.

- [ ] **Step 3: Confirm `SearchItem` rows landed correctly**

Run: `docker exec -it ai-meeting-summarizer-postgres-1 psql -U postgres -d meeting_summarizer -c "SELECT source_type, text FROM search_items WHERE video_id = <id>;"`

Expected: one row per Decision/ActionItem/OpenQuestion extracted from that video.

- [ ] **Step 4: Query with a keyword that should full-text match**

Run: `curl -s "http://localhost:3001/api/search?q=<a word taken verbatim from one of the decisions>" -H "Authorization: Bearer <token>"`

Expected: `{"success":true,"data":[...]}` with that decision's text among the top results.

- [ ] **Step 5: Query with a rephrased term that should only semantically match**

Pick a decision/action item and think of a query using different words but the same meaning
(e.g. if a decision says "adopt PostgreSQL for the database", query `"switch database engine"`).

Run: `curl -s "http://localhost:3001/api/search?q=<rephrased query>" -H "Authorization: Bearer <token>"`

Expected: the semantically related item still appears in results (via the vector leg of the RRF
merge), even without shared keywords.

- [ ] **Step 6: Confirm reprocessing doesn't duplicate rows**

Re-trigger processing for the same video (e.g. via the existing reprocess/retry path), then
re-run the query from Step 3. Row count per video should stay the same, not double.

- [ ] **Step 7: Confirm org/user scoping**

Log in as a second user (or use `AUTH_DISABLED` + a manually-crafted second-user token if no
second seeded user exists) and confirm their `/api/search` never returns the first user's items.

- [ ] **Step 8: No commit needed** — this task is verification only, not a code change.

---

### Task 10: `/search` frontend page

**Files:**
- Create: `frontend/app/search/page.tsx`
- Create: `frontend/components/SearchResults.tsx`

- [ ] **Step 1: Write `SearchResults.tsx`**

```tsx
// components/SearchResults.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { HiOutlineExclamationCircle, HiOutlineMagnifyingGlass } from 'react-icons/hi2';

interface SearchResult {
  sourceType: 'decision' | 'action_item' | 'open_question';
  text: string;
  videoId: number;
  videoTitle: string;
  score: number;
}

const TYPE_LABELS: Record<SearchResult['sourceType'], string> = {
  decision: 'Decision',
  action_item: 'Action Item',
  open_question: 'Open Question',
};

const SearchResults = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      setError(null);
      setSearched(true);
      const response = await apiFetch(
        `http://localhost:3001/api/search?q=${encodeURIComponent(trimmed)}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || `Request failed (${response.status})`);
        return;
      }

      setResults(data.data);
    } catch (err) {
      console.error('Error searching:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const grouped = results.reduce<Record<number, { title: string; items: SearchResult[] }>>(
    (acc, result) => {
      if (!acc[result.videoId]) {
        acc[result.videoId] = { title: result.videoTitle, items: [] };
      }
      acc[result.videoId].items.push(result);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#35b3c9' }}>Search</h2>

      <form onSubmit={runSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search decisions, action items, open questions..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#35b3c9]"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[#35b3c9] text-white flex items-center gap-2"
        >
          <HiOutlineMagnifyingGlass className="w-5 h-5" />
          Search
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#35b3c9] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && searched && Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No results found</p>
        </div>
      )}

      {!loading && !error && Object.keys(grouped).length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([videoId, group]) => (
            <div key={videoId} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <h3
                className="font-semibold text-gray-800 mb-3 cursor-pointer hover:text-[#35b3c9]"
                onClick={() => router.push(`/summary/${videoId}`)}
              >
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 text-xs px-2 py-1 rounded-full text-gray-600 bg-gray-100">
                      {TYPE_LABELS[item.sourceType]}
                    </span>
                    <span className="text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
```

- [ ] **Step 2: Write `app/search/page.tsx`**

```tsx
// app/search/page.tsx
'use client';

import React from 'react';
import SearchResults from '@/components/SearchResults';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function SearchPage() {
  useRequireAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <SearchResults />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (from `frontend/`)

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/search frontend/components/SearchResults.tsx
git commit -m "feat(frontend): add /search page for hybrid search results"
```

---

### Task 11: Add "Search" to the navbar

**Files:**
- Modify: `frontend/components/navbar.tsx`

- [ ] **Step 1: Add to `navLinks`**

Change:

```typescript
  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Summarize", href: "/video" },
    { name: "Tasks", href: "/tasks" },
    { name: "Contact", href: "/contact" },
  ];
```

to:

```typescript
  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Summarize", href: "/video" },
    { name: "Tasks", href: "/tasks" },
    { name: "Search", href: "/search" },
    { name: "Contact", href: "/contact" },
  ];
```

- [ ] **Step 2: Add "Search" to both hardcoded rendered-name arrays**

There are two identical arrays in this file (desktop menu and mobile menu) that filter
`navLinks` down to what's actually rendered — `"Home"` is rendered separately, so these two
arrays list everything else:

```typescript
{["About", "Summarize", "Tasks", "Contact"].map((name, index) => {
```

Change **both** occurrences (one in the desktop menu block, one in the mobile menu block) to:

```typescript
{["About", "Summarize", "Tasks", "Search", "Contact"].map((name, index) => {
```

- [ ] **Step 3: Manually verify in the browser**

With `npm run dev` running in `frontend/`, load the app, confirm "Search" appears in both the
desktop nav and the mobile hamburger menu, and clicking it navigates to `/search` (redirecting to
`/login` first if not authenticated, same as "Tasks").

- [ ] **Step 4: Commit**

```bash
git add frontend/components/navbar.tsx
git commit -m "feat(frontend): add Search link to navbar"
```

---

### Task 12: Full end-to-end live verification

**Files:** none (manual verification only)

- [ ] **Step 1: With API, worker, and frontend dev servers all running**, log in as
  `dev@example.com` in the browser.

- [ ] **Step 2:** Upload a video/audio file via `/video`, wait for processing to complete
  (poll or watch worker logs as in Task 9).

- [ ] **Step 3:** Navigate to `/search`, enter a keyword from one of that video's decisions,
  submit, confirm results render grouped under the correct video title with the correct type
  badge.

- [ ] **Step 4:** Click a result group's video title, confirm it navigates to
  `/summary/<videoId>` and shows that video's summary.

- [ ] **Step 5:** Try a query with no matches (e.g. gibberish), confirm the "No results found"
  state renders instead of an error.

- [ ] **Step 6:** Log out, navigate directly to `/search`, confirm it redirects to `/login`
  (matching `/tasks`'s existing behavior).

- [ ] **Step 7:** Update `CLAUDE.md`'s "Current state" section — check the Phase 7 checkbox and
  add a summary entry following the same style as the existing Phase 4-6 entries (what was
  built, what was verified, any deferred/known-gap items found along the way). Do this as its
  own commit:

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 7 pgvector search complete"
```
