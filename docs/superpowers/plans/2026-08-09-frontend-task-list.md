# Frontend Task-List View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/tasks` page listing `ActionItem`s across all of the current user's
videos (owner/task/due/status), and fix `VideoSummary.tsx`'s Action Items tab plus surface
`Decision`/`OpenQuestion` data that Phase 6 already returns but the frontend currently discards.

**Architecture:** New backend `action-items` module (`GET /api/action-items?status=`) scoped
to the caller's own videos via `@CurrentUser()`, following the existing `summaries` module's
controller/service split. New frontend `/tasks` route + `TaskList` component fetching that
endpoint. `VideoSummary.tsx` updated to read the real relational shape
(`summary.decisions`/`openQuestions`/`actionItems`) instead of parsing a JSON blob that Phase 6
already removed.

**Tech Stack:** NestJS, Prisma 7, Postgres, Next.js 16 (App Router), React 19, `react-icons`.

No automated test framework exists in this repo (established pattern across Phases 2-6) —
verification is `npx tsc --noEmit` (backend) / `npx tsc --noEmit` (frontend) plus manual
curl and browser checks, per this project's established convention.

Per spec (`docs/superpowers/specs/2026-08-09-frontend-task-list-design.md`): read-only, no
status-mutation endpoint, no auth-header wiring fix (existing frontend components already call
the API without an `Authorization` header — this is a pre-existing gap outside this plan's
scope, so new code matches that existing pattern for consistency rather than fixing it here).

---

### Task 1: Backend — `action-items` module

**Files:**
- Create: `backend/src/action-items/action-items.service.ts`
- Create: `backend/src/action-items/action-items.controller.ts`
- Create: `backend/src/action-items/action-items.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create the service**

`backend/src/action-items/action-items.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionItemStatus } from '../generated/prisma/enums';

@Injectable()
export class ActionItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: number, status?: ActionItemStatus) {
    return this.prisma.actionItem.findMany({
      where: {
        video: { userId },
        ...(status && { status }),
      },
      include: { video: { select: { id: true, title: true } } },
      orderBy: [{ dueDate: 'asc' }],
    });
  }
}
```

- [ ] **Step 2: Create the controller**

`backend/src/action-items/action-items.controller.ts`:

```ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ActionItemStatus } from '../generated/prisma/enums';

@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly actionItems: ActionItemsService) {}

  @Get()
  async list(@Query('status') status: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    let parsedStatus: ActionItemStatus | undefined;
    if (status !== undefined) {
      if (status !== 'open' && status !== 'done') {
        throw new BadRequestException('status must be "open" or "done"');
      }
      parsedStatus = status;
    }

    const data = await this.actionItems.listForUser(user.id, parsedStatus);
    return { success: true, data };
  }
}
```

- [ ] **Step 3: Create the module**

`backend/src/action-items/action-items.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ActionItemsController } from './action-items.controller';
import { ActionItemsService } from './action-items.service';

@Module({
  controllers: [ActionItemsController],
  providers: [ActionItemsService],
})
export class ActionItemsModule {}
```

- [ ] **Step 4: Register the module in `AppModule`**

In `backend/src/app.module.ts`, add the import:

```ts
import { ActionItemsModule } from './action-items/action-items.module';
```

and add `ActionItemsModule` to the `imports` array, after `SummariesModule`:

```ts
    VideosModule,
    SummariesModule,
    ActionItemsModule,
    ProcessingModule,
```

- [ ] **Step 5: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/action-items backend/src/app.module.ts
git commit -m "feat(backend): expose GET /api/action-items scoped to caller's videos"
```

---

### Task 2: Backend — manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the API and worker per existing dev workflow, then log in**

Use the seeded dev user documented in `.env.example` (`dev@example.com` / `devpassword123`)
against `POST /api/auth/login` to get a token, same as prior phases' curl verification.

- [ ] **Step 2: Verify the endpoint returns only the caller's action items**

```bash
curl -s http://localhost:3001/api/action-items -H "Authorization: Bearer <token>" | jq
```

Expected: `{"success": true, "data": [...]}` where every item's nested `video.id` belongs to a
video owned by the logged-in user. If a second user account exists, confirm their token returns
a disjoint set (no cross-user leakage).

- [ ] **Step 3: Verify the `status` filter**

```bash
curl -s "http://localhost:3001/api/action-items?status=open" -H "Authorization: Bearer <token>" | jq
curl -s "http://localhost:3001/api/action-items?status=done" -H "Authorization: Bearer <token>" | jq
curl -s "http://localhost:3001/api/action-items?status=bogus" -H "Authorization: Bearer <token>" | jq
```

Expected: first two return only matching-status items; the third returns HTTP 400 with
`"status must be \"open\" or \"done\""`.

- [ ] **Step 4: Verify null-`dueDate` sort order**

If any returned item has `dueDate: null`, confirm it appears after all items with a non-null
`dueDate` in the unfiltered list (Prisma's default `asc` ordering sorts nulls last).

---

### Task 3: Frontend — `/tasks` page and `TaskList` component

**Files:**
- Create: `frontend/app/tasks/page.tsx`
- Create: `frontend/components/TaskList.tsx`

- [ ] **Step 1: Create the `TaskList` component**

`frontend/components/TaskList.tsx`:

```tsx
// components/TaskList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineUser,
  HiOutlineCalendar,
} from 'react-icons/hi2';

interface TaskItem {
  id: number;
  task: string;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  status: 'open' | 'done';
  video: { id: number; title: string };
}

type FilterTab = 'all' | 'open' | 'done';

const TaskList = () => {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    fetchTasks(filter);
  }, [filter]);

  const fetchTasks = async (tab: FilterTab) => {
    try {
      setLoading(true);
      setError(null);
      const qs = tab === 'all' ? '' : `?status=${tab}`;
      const response = await fetch(`http://localhost:3001/api/action-items${qs}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `Request failed (${response.status})`);
        return;
      }

      setTasks(data.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (task: TaskItem) =>
    task.status === 'open' && task.dueDate !== null && new Date(task.dueDate) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#35b3c9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Tasks</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#35b3c9' }}>Tasks</h2>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['all', 'open', 'done'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors relative ${
              filter === tab ? 'text-[#35b3c9]' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
            {filter === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#35b3c9]"></div>
            )}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/summary/${task.video.id}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-800">{task.task}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    task.status === 'done' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
                  }`}
                >
                  {task.status.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {task.assignee && (
                  <div className="flex items-center gap-1">
                    <HiOutlineUser className="w-4 h-4" />
                    <span>{task.assignee}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-medium' : ''}`}>
                    <HiOutlineCalendar className="w-4 h-4" />
                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-gray-400">
                  <HiOutlineCheckCircle className="w-4 h-4" />
                  <span>{task.video.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskList;
```

- [ ] **Step 2: Create the page**

`frontend/app/tasks/page.tsx`:

```tsx
// app/tasks/page.tsx
'use client';

import React from 'react';
import TaskList from '@/components/TaskList';

export default function TasksPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <TaskList />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/tasks frontend/components/TaskList.tsx
git commit -m "feat(frontend): add /tasks page listing action items across videos"
```

---

### Task 4: Frontend — add "Tasks" nav link

**Files:**
- Modify: `frontend/components/navbar.tsx:41-46` (`navLinks` array)
- Modify: `frontend/components/navbar.tsx:120` (desktop link-name list)
- Modify: `frontend/components/navbar.tsx:219` (mobile link-name list)

- [ ] **Step 1: Add the route to `navLinks`**

In `frontend/components/navbar.tsx`, change:

```tsx
  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Summarize", href: "/video" },
    { name: "Contact", href: "/contact" },
  ];
```

to:

```tsx
  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Summarize", href: "/video" },
    { name: "Tasks", href: "/tasks" },
    { name: "Contact", href: "/contact" },
  ];
```

- [ ] **Step 2: Add "Tasks" to the desktop menu's rendered name list**

In `frontend/components/navbar.tsx`, change:

```tsx
            {["About", "Summarize","Contact"].map((name, index) => {
```

(the first occurrence, inside the "Desktop Menu" block) to:

```tsx
            {["About", "Summarize", "Tasks", "Contact"].map((name, index) => {
```

- [ ] **Step 3: Add "Tasks" to the mobile menu's rendered name list**

In `frontend/components/navbar.tsx`, change the second occurrence of the same line (inside the
"Mobile Menu" block) the same way:

```tsx
                {["About", "Summarize", "Tasks", "Contact"].map((name, index) => {
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/navbar.tsx
git commit -m "feat(frontend): add Tasks link to navbar"
```

---

### Task 5: Frontend — fix `VideoSummary.tsx` to use the real API shape

**Files:**
- Modify: `frontend/components/VideoSummary.tsx`

- [ ] **Step 1: Replace the `SummaryData`/`ActionItem` interfaces and drop the dead JSON-blob parsing**

In `frontend/components/VideoSummary.tsx`, replace lines 20-58 (the `Speaker`, `ActionItem`,
`SummaryData`, `VideoData` interfaces) with:

```tsx
interface Speaker {
  name: string;
  speaking_time: string;
  word_count: number;
  role?: string;
}

interface ActionItem {
  id: number;
  task: string;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  status: 'open' | 'done';
}

interface Decision {
  id: number;
  description: string;
}

interface OpenQuestion {
  id: number;
  question: string;
}

interface SummaryData {
  videoId: number;
  summaryText: string | null;
  keyPoints: string[] | null;
  speakers: Speaker[] | null;
  transcript: string | null;
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  actionItems: ActionItem[];
}

interface VideoData {
  id: number;
  title: string;
  filename: string;
  file_size: number;
  duration: number | null;
  status: string;
  created_at: string;
}
```

- [ ] **Step 2: Fetch the summary from `/api/summaries/video/:id` instead of parsing JSON off `/api/videos/:id`**

Replace the `fetchVideoData` function (originally lines 76-111) with:

```tsx
  const fetchVideoData = async () => {
    try {
      setLoading(true);
      setError(null);

      const videoRes = await fetch(`http://localhost:3001/api/videos/${videoId}`);
      const videoJson = await videoRes.json();
      if (!videoRes.ok || !videoJson.success || !videoJson.data) {
        setError(videoJson.error || `Request failed (${videoRes.status})`);
        return;
      }
      setVideo(videoJson.data);

      const summaryRes = await fetch(`http://localhost:3001/api/summaries/video/${videoId}`);
      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok || !summaryJson.success || !summaryJson.data) {
        setError(summaryJson.error || `Request failed (${summaryRes.status})`);
        return;
      }
      setSummary(summaryJson.data);
    } catch (err) {
      console.error('Error fetching video:', err);
      setError('Failed to load video summary');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Update `summary_text`/`key_points` references to the new field names**

In the "Summary Tab" JSX block, change:

```tsx
              <p className="text-gray-700 leading-relaxed">{summary.summary_text}</p>
```

to:

```tsx
              <p className="text-gray-700 leading-relaxed">{summary.summaryText}</p>
```

and change:

```tsx
            {summary.key_points && summary.key_points.length > 0 && (
```

to:

```tsx
            {summary.keyPoints && summary.keyPoints.length > 0 && (
```

and update the `.map` right below it from `summary.key_points.map` to `summary.keyPoints.map`.

- [ ] **Step 4: Add Decisions and Open Questions sections to the Summary tab**

In the "Summary Tab" JSX block, immediately after the closing `)}` of the Speakers section
(originally ending at line 314, right before the closing `</>`  of the summary-tab fragment),
add:

```tsx
            {/* Decisions */}
            {summary.decisions && summary.decisions.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4" style={{ color: '#35b3c9' }}>
                  Decisions
                </h2>
                <ul className="space-y-3">
                  {summary.decisions.map((decision) => (
                    <li key={decision.id} className="flex items-start gap-3">
                      <HiOutlineCheckCircle className="w-5 h-5 text-[#35b3c9] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{decision.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Open Questions */}
            {summary.openQuestions && summary.openQuestions.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4" style={{ color: '#b524c5' }}>
                  Open Questions
                </h2>
                <ul className="space-y-3">
                  {summary.openQuestions.map((q) => (
                    <li key={q.id} className="flex items-start gap-3">
                      <HiOutlineExclamationCircle className="w-5 h-5 text-[#b524c5] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{q.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
```

- [ ] **Step 5: Update the transcript tab reference**

Change:

```tsx
              <p className="text-gray-700 whitespace-pre-line">{summary.transcript}</p>
```

No field-name change needed here (`transcript` is unchanged) — leave as-is, just confirm it
still compiles after the interface change.

- [ ] **Step 6: Rewrite the Action Items tab body**

Replace the "Action Items Tab" JSX block (originally lines 331-366) with:

```tsx
        {/* Action Items Tab */}
        {activeTab === 'actions' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#fec650' }}>
              <HiOutlineCheckCircle className="w-5 h-5" />
              Action Items
            </h2>

            {summary.actionItems && summary.actionItems.length > 0 ? (
              <div className="space-y-4">
                {summary.actionItems.map((item) => (
                  <div key={item.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-800">{item.task}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          item.status === 'done' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {item.assignee && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <HiOutlineUser className="w-4 h-4" />
                          <span>{item.assignee}</span>
                        </div>
                      )}
                      {item.dueDate && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <HiOutlineCalendar className="w-4 h-4" />
                          <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No action items found</p>
            )}
          </div>
        )}
```

- [ ] **Step 7: Remove the now-unused `getPriorityColor` helper**

`getPriorityColor` (originally lines 129-136) is no longer referenced now that the badge logic
uses `status` instead of `priority`. Delete the function.

- [ ] **Step 8: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors, no unused-variable warnings for `getPriorityColor`.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/VideoSummary.tsx
git commit -m "fix(frontend): read real Decision/ActionItem/OpenQuestion API shape in VideoSummary"
```

---

### Task 6: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start frontend and backend dev servers**

- [ ] **Step 2: Verify `/tasks`**

Navigate to `http://localhost:3000/tasks`. Confirm: page loads without console errors, tasks
render with task/assignee/due date/status/source-video-title, filter tabs (All/Open/Done)
switch the list correctly, an overdue open item's due date renders in red, clicking a task
navigates to `/summary/:videoId`, "Tasks" appears in both desktop and mobile nav and highlights
as active when on `/tasks`.

- [ ] **Step 3: Verify empty state**

If the logged-in user has no action items yet, confirm `/tasks` shows "No tasks found" instead
of a blank page or error.

- [ ] **Step 4: Verify `/summary/:id`**

Navigate to a completed video's summary page. Confirm: Summary tab shows Decisions and Open
Questions sections when the video's summary has any (upload/process a video with a rich
transcript if none exist yet), Action Items tab shows real `assignee`/`dueDate`/`status` instead
of blank/broken fields, no console errors from the removed `JSON.parse` calls.
