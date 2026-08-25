# Phase 7: pgvector search (company memory)

## Context

This is Phase 7 of the meeting-summarizer migration (`migration-plan.md`): "Company memory" —
search past meetings by topic and see every decision, task, and its status. Phase 6 gave us
structured, queryable `Decision`/`ActionItem`/`OpenQuestion` rows per video, but the only way to
find them today is browsing one video's summary at a time. This phase adds a search endpoint
that finds relevant decisions/action items/open questions across all of a user's meetings,
combining exact keyword matching with semantic (meaning-based) matching.

Full original phase scope (migration-plan.md) covers embeddings, a hybrid search endpoint, and a
frontend search bar — all three are in scope for this single spec, since they're tightly coupled
(no independent value in shipping just one piece).

## Embedding source

Groq (this project's only current LLM provider) has no embeddings API. Rather than adding a new
paid vendor (OpenAI, Voyage, Gemini) for a project still in testing, embeddings are generated
locally via `@xenova/transformers` (transformers.js) running the `all-MiniLM-L6-v2` model
in-process inside the Node worker. This is free, has no external API key or network dependency,
and is light enough to run alongside the existing ffmpeg/Groq work in the same worker process
(~25-90MB model file downloaded once and cached, single-digit-to-~20ms per embed on CPU, no GPU
needed). Model produces 384-dimensional vectors. Loaded once at worker boot and reused across
jobs, not reloaded per job.

If quality ever becomes a problem at scale, swapping to a hosted embeddings API later is a
contained change (one service function), not a schema change — `vector(384)` would need to
change dimension to match a different model, which is the one thing that would require a new
migration.

## Data model

One new unified table, `SearchItem`, rather than a vector column on each of `Decision`/
`ActionItem`/`OpenQuestion`. A unified table means one query (not three unioned queries) can
search across all three source types, and keeps the search-specific concerns (embedding,
tsvector, reprocessing/cleanup) out of the core Phase 6 models.

```prisma
enum SearchSourceType {
  DECISION
  ACTION_ITEM
  OPEN_QUESTION
}

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

`sourceId` points at the originating `Decision`/`ActionItem`/`OpenQuestion` row (no FK — the
target table depends on `sourceType`, which Prisma relations can't express polymorphically).
Since `Unsupported(...)` fields can't be created via Prisma's migration engine directly, the
migration's raw SQL also adds:

- a full-text search column: `search_vector tsvector generated always as (to_tsvector('english', text)) stored`
- a GIN index on `search_vector`
- an ivfflat index on `embedding` (cosine ops) — acceptable at this data scale; can move to
  HNSW later if needed, that's an index-only change

`CREATE EXTENSION IF NOT EXISTS vector` already exists from Phase 1, no change needed there.

## Embedding pipeline

New BullMQ queue, `search-indexing`, worker-only (same pattern as `overdue-notifications`).

`ProcessingProcessor` (existing video-processing job), after its `$transaction` that writes
`Decision`/`ActionItem`/`OpenQuestion` rows commits successfully, enqueues one
`search-indexing` job with `{ videoId }`. Kept as a separate queue/job (not inline in the same
transaction) so a slow or failed embedding run never blocks or fails video processing itself —
the two are correctness-independent: a video can be "done" without its search index being
up to date yet.

`SearchIndexingProcessor`:
1. Deletes existing `SearchItem` rows for that `videoId` (idempotent on reprocessing, matching
   the existing Phase 6 `deleteMany`+`createMany` pattern).
2. Loads that video's `Decision`/`ActionItem`/`OpenQuestion` rows.
3. Builds one plain-text string per row (e.g. a `Decision`'s `description` as-is; an
   `ActionItem` as `"${task} (assignee: ${assignee ?? 'unassigned'})"`).
4. Embeds each string via the local model.
5. Bulk-inserts resulting `SearchItem` rows (embedding stored via raw SQL insert, since
   Prisma's client can't bind a `vector` value directly — same `Unsupported()` limitation as
   the column type).

## Search endpoint

`GET /api/search?q=<query>`, scoped to the caller's organization via `@CurrentUser()` (existing
auth pattern — every other list endpoint filters this way).

Two queries run against `search_items`, both scoped to `organization_id = caller's org`:

- **Full-text**: `to_tsvector('english', text) @@ plainto_tsquery('english', $q)`, ordered by
  `ts_rank(search_vector, plainto_tsquery(...))` descending, top 20.
- **Vector**: embed `$q` via the same local model at request time, order by
  `embedding <=> $queryVector` (cosine distance) ascending, top 20.

Results merged via Reciprocal Rank Fusion: each `SearchItem.id`'s score is
`1/(60 + rank_fulltext) + 1/(60 + rank_vector)` (missing from one list contributes 0 for that
term), re-sorted descending, top 20 returned. RRF is used instead of a weighted score blend
because full-text rank and cosine distance are on incomparable scales — RRF only needs each
list's rank order, no score normalization/tuning.

Response shape:
```json
{
  "success": true,
  "data": [
    {
      "sourceType": "DECISION",
      "text": "...",
      "videoId": 12,
      "videoTitle": "...",
      "score": 0.031
    }
  ]
}
```

## Frontend

New `/search` page (navbar link added, same pattern as the existing `/tasks` link). A query
input triggers `GET /api/search` via the existing `apiFetch` helper. Results render grouped by
`videoId` (each group: video title as a heading/link to `/summary/[videoId]`, matched items
underneath with a type badge — Decision/Action Item/Open Question — and the matched text).
Empty query shows nothing (no default "recent searches" or browse-all view — out of scope).
Loading and empty-results states follow the existing `TaskList`/`VideoList` component
conventions already in the codebase.

## Testing

Verify live end-to-end, same standard as prior phases: upload a video, confirm a
`search-indexing` job runs after processing and `SearchItem` rows land correctly; run a query
that should keyword-match, one that should only semantically match (different wording, same
meaning), confirm both surface expected results; confirm reprocessing a video doesn't duplicate
`SearchItem` rows; confirm search results are scoped to the caller's org (a second org's data
never appears); confirm the frontend `/search` page renders results grouped correctly and links
to the right video.

## Explicitly out of scope for this spec

- Embedding/searching full transcript text (only Decision/ActionItem/OpenQuestion text).
- Re-embedding on edit (none of these rows are editable yet).
- Pagination beyond the top-20 cutoff per query type.
- Per-field or per-source-type score weighting.
- Swapping to a hosted embeddings API (noted above as a future, contained change if needed).
