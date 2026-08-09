# Frontend task-list view

## Context

This is the "frontend task-list view" piece deferred out of Phase 6 (see
`2026-08-05-phase6-decisions-model-design.md`, item 4). The backend already exposes
`Decision`/`ActionItem`/`OpenQuestion` per-video via `GET /api/summaries/video/:videoId`
(`summaries.service.ts`), but no frontend surface reads them — `VideoSummary.tsx`'s Action
Items tab still parses the old `Summary.actionItems` JSON-blob shape that was removed in
Phase 6, so it silently renders nothing useful today.

Scope: a new aggregate `/tasks` page listing `ActionItem`s across all of the current user's
videos (owner/task/due date/status), read-only (no status mutation — that's a future spec),
plus fixing `VideoSummary.tsx`'s per-video Action Items tab to read the real API shape and
surface `decisions`/`openQuestions` (currently fetched by nothing, shown nowhere).

Deferred pieces still not in scope: the daily overdue-flagging job + Slack/email notification
(needs a channel decision, punted separately), and any write/status-toggle capability.

## Backend: new `action-items` module

New Nest module `backend/src/action-items/`, following the existing `summaries` module's
shape (controller + service, DTOs only if needed):

- `GET /api/action-items?status=open|done` — auth-guarded (global `JwtAuthGuard` applies by
  default, no `@Public()`), scoped to the current user's own videos via `@CurrentUser()`,
  matching the ownership pattern already used in `videos.service.ts` (`userId` scoping, not
  org-wide — a user should only see their own tasks, not the whole org's).
- `ActionItemsService.listForUser(userId, status?)`:
  ```ts
  this.prisma.actionItem.findMany({
    where: { video: { userId }, ...(status && { status }) },
    include: { video: { select: { id: true, title: true } } },
    orderBy: [{ dueDate: 'asc' }],
  });
  ```
  Prisma's default `asc` ordering already sorts `null` `dueDate` last, so items with no due
  date land at the bottom without extra handling.
- Response uses the existing `{success, data}` envelope convention (no custom exception
  filter, matches every other controller).
- No mutation route — read-only per this spec's scope.

## Frontend

**New route:** `frontend/app/tasks/page.tsx` (`'use client'`), fetches
`GET /api/action-items` (with auth header, matching how `VideoSummary.tsx`/`VideoList.tsx`
currently call the API) on mount, passes to a new `TaskList` component.

**New component:** `frontend/components/TaskList.tsx`:
- Table/list rendering: task, owner (`assignee` string — `ownerId`/`owner` isn't included in
  the list query above, so display the free-text `assignee` field as-is, consistent with what
  `ActionItem` actually stores), due date, status badge (`open`/`done`), priority (nullable —
  hide the badge if absent), and the source video's title linking to `/summary/:videoId`.
- Overdue highlighting: `status === 'open' && dueDate < now` renders due date in red.
- Filter tabs: All / Open / Done, driving the `?status=` query param.
- Empty state matching existing empty-state style (`VideoList.tsx`'s "No videos uploaded yet"
  pattern).
- Loading/error states matching `VideoSummary.tsx`'s existing spinner/error-card patterns for
  visual consistency.

**Nav:** add `{ name: "Tasks", href: "/tasks" }` to `navbar.tsx`'s `navLinks` array, and add
`"Tasks"` to both the desktop and mobile link-name lists (`["About", "Summarize", "Contact"]`
→ `["About", "Summarize", "Tasks", "Contact"]`) so it renders in both menus the same way
existing links do.

**Fix `VideoSummary.tsx`'s Action Items tab (and add Decisions/Open Questions):**
- Remove the dead `JSON.parse` handling for `key_points`/`action_items`/`speakers` on the
  `video.*` string fields (`fetchVideoData`) — Phase 6 already returns these as real arrays/
  objects on the `summary` object (`summaryText`, `keyPoints`, `decisions`, `openQuestions`,
  `actionItems`), not JSON strings on `video`.
- Update the `ActionItem` interface to match the real shape: `{ task, assignee, dueDate,
  status, priority }` (drop the assumption that `priority` and `due` are always present —
  `priority` is nullable, `due` is now `dueDate: string | null`).
- Add two new sections (reusing the existing card style) for `decisions` (list of
  `description` strings) and `openQuestions` (list of `question` strings), shown in the
  existing "summary" tab alongside Key Points/Speakers, since this data is already returned
  by the endpoint but currently discarded.

## Error handling

- `/tasks` page: network/auth failure shows the same error-card pattern as
  `VideoSummary.tsx` (icon + message + retry), not a silent blank page.
- Backend: no video match / empty result returns `{success: true, data: []}`, not a 404 —
  an empty task list is a valid state, not an error.

## Testing

- Backend: manual curl verification (matches this project's existing verification style,
  no test suite exists yet per `CLAUDE.md`'s `Run tests: TODO`) — confirm `/api/action-items`
  scopes to the calling user only (second user's items don't leak), `?status=` filters
  correctly, null-`dueDate` items sort last.
- Frontend: manual browser check — `/tasks` renders real data, overdue items highlighted,
  filter tabs work, nav link present desktop+mobile, `/summary/:id` Action Items tab renders
  real `assignee`/`dueDate`/`status` instead of blank/broken data, Decisions/Open Questions
  sections appear when present.
