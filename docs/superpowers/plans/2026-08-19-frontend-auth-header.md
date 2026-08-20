# Frontend Auth-Header Gap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every frontend request to the backend carries a JWT `Authorization` header, protected pages redirect unauthenticated users to a new `/login` page, and a 401 anywhere clears the stale token and bounces back to `/login`.

**Architecture:** A single `frontend/lib/auth.ts` module owns token storage (`localStorage`) and exposes `apiFetch`, a drop-in `fetch` replacement that attaches the header and handles 401 centrally. A `useRequireAuth` hook guards protected pages client-side. All existing `fetch(` call sites to `localhost:3001` switch to `apiFetch(`; the one `XMLHttpRequest`-based upload call gets the header attached manually via `setRequestHeader`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, existing backend `POST /api/auth/login` (returns `{ success: true, data: { accessToken } }`, `@Public()` — no guard).

**No test framework exists in `frontend/`** (`package.json` has no `test` script, no jest/vitest/playwright). Verification here is `npx tsc --noEmit` after each code change plus a manual browser walkthrough as the final task — consistent with how prior phases in this repo were verified (see `CLAUDE.md` "Current state").

---

### Task 1: Auth storage + apiFetch helper

**Files:**
- Create: `frontend/lib/auth.ts`

- [ ] **Step 1: Write the module**

```typescript
// frontend/lib/auth.ts

const TOKEN_KEY = 'token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return response;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `lib/auth.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/auth.ts
git commit -m "feat(frontend): add token storage and apiFetch helper"
```

---

### Task 2: useRequireAuth hook

**Files:**
- Create: `frontend/hooks/useRequireAuth.ts`

- [ ] **Step 1: Write the hook**

```typescript
// frontend/hooks/useRequireAuth.ts
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export function useRequireAuth(): void {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
    }
  }, [router]);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `hooks/useRequireAuth.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useRequireAuth.ts
git commit -m "feat(frontend): add useRequireAuth route-guard hook"
```

---

### Task 3: Login page

**Files:**
- Create: `frontend/app/login/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/auth';

interface LoginResponse {
  success: boolean;
  data?: { accessToken: string };
  error?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: LoginResponse = await response.json();

      if (!response.ok || !data.success || !data.data) {
        setError(data.error || 'Invalid email or password');
        return;
      }

      setToken(data.data.accessToken);
      router.push('/video');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center" style={{ color: '#35b3c9' }}>
          Log in
        </h1>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#35b3c9]"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#35b3c9]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#35b3c9' }}
        >
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `app/login/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/app/login/page.tsx
git commit -m "feat(frontend): add login page"
```

---

### Task 4: Route existing fetch calls through apiFetch

**Files:**
- Modify: `frontend/components/VideoList.tsx:35` and `frontend/components/VideoList.tsx:51`
- Modify: `frontend/components/VideoSummary.tsx:88` and `frontend/components/VideoSummary.tsx:96`
- Modify: `frontend/components/TaskList.tsx:41`

- [ ] **Step 1: Update `VideoList.tsx`**

Add the import:

```typescript
import { apiFetch } from '@/lib/auth';
```

Replace line 35:

```typescript
      const response = await apiFetch('http://localhost:3001/api/videos');
```

Replace line 51:

```typescript
      const response = await apiFetch(`http://localhost:3001/api/videos/${id}`, {
        method: 'DELETE'
      });
```

- [ ] **Step 2: Update `VideoSummary.tsx`**

Add the import:

```typescript
import { apiFetch } from '@/lib/auth';
```

Replace line 88:

```typescript
      const videoRes = await apiFetch(`http://localhost:3001/api/videos/${videoId}`);
```

Replace line 96:

```typescript
      const summaryRes = await apiFetch(`http://localhost:3001/api/summaries/video/${videoId}`);
```

- [ ] **Step 3: Update `TaskList.tsx`**

Add the import:

```typescript
import { apiFetch } from '@/lib/auth';
```

Replace line 41:

```typescript
      const response = await apiFetch(`http://localhost:3001/api/action-items${qs}`);
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors in the three modified files

- [ ] **Step 5: Commit**

```bash
git add frontend/components/VideoList.tsx frontend/components/VideoSummary.tsx frontend/components/TaskList.tsx
git commit -m "feat(frontend): route video/summary/task fetches through apiFetch"
```

---

### Task 5: Auth header on the upload page (XHR upload + status poll)

**Files:**
- Modify: `frontend/app/video/page.tsx`

This file's upload uses `XMLHttpRequest` directly (not `fetch`), so it needs the header
attached via `setRequestHeader`. The status-poll call already uses `fetch` and switches
to `apiFetch`.

- [ ] **Step 1: Add imports**

At the top of `frontend/app/video/page.tsx`, add:

```typescript
import { apiFetch, getToken } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
```

- [ ] **Step 2: Call the guard hook**

Inside the `VideoUpload` component body, as the first line:

```typescript
const VideoUpload = () => {
  useRequireAuth();
  const router = useRouter();
```

- [ ] **Step 3: Attach the header to the XHR upload**

In `uploadFile`, right after `xhr.open('POST', 'http://localhost:3001/api/videos/upload');`
and before `xhr.send(formData);`, add:

```typescript
      xhr.open('POST', 'http://localhost:3001/api/videos/upload');
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
```

- [ ] **Step 4: Switch the status-poll fetch to apiFetch**

Replace:

```typescript
        const response = await fetch(`http://localhost:3001/api/videos/${videoId}/status`);
```

with:

```typescript
        const response = await apiFetch(`http://localhost:3001/api/videos/${videoId}/status`);
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `app/video/page.tsx`

- [ ] **Step 6: Commit**

```bash
git add frontend/app/video/page.tsx
git commit -m "feat(frontend): guard upload page and auth-header the upload/status calls"
```

---

### Task 6: Guard the remaining protected pages

**Files:**
- Modify: `frontend/app/tasks/page.tsx`
- Modify: `frontend/app/summary/[id]/page.tsx`

- [ ] **Step 1: Guard `/tasks`**

```typescript
// app/tasks/page.tsx
'use client';

import React from 'react';
import TaskList from '@/components/TaskList';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function TasksPage() {
  useRequireAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <TaskList />
    </div>
  );
}
```

- [ ] **Step 2: Guard `/summary/[id]`**

```typescript
// app/summary/[id]/page.tsx
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import VideoSummary from '@/components/VideoSummary';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function SummaryPage() {
  useRequireAuth();
  const params = useParams();
  const videoId = parseInt(params.id as string);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <VideoSummary videoId={videoId} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors in either file

- [ ] **Step 4: Commit**

```bash
git add frontend/app/tasks/page.tsx "frontend/app/summary/[id]/page.tsx"
git commit -m "feat(frontend): redirect unauthenticated visits to /login on tasks and summary pages"
```

---

### Task 7: Navbar login/logout affordance

**Files:**
- Modify: `frontend/components/navbar.tsx`

- [ ] **Step 1: Add imports and auth state**

Add near the top imports:

```typescript
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "@/lib/auth";
```

Inside the `Navbar` component, alongside the existing `useState` calls:

```typescript
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    router.push('/login');
  };
```

- [ ] **Step 2: Render the affordance in the desktop menu**

Immediately after the closing `</div>` of the desktop nav-links `.map(...)` block
(right before the `{/* Mobile Menu Button */}` comment), add:

```typescript
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="text-text hover:text-primary transition-colors text-md px-3 py-2"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="text-text hover:text-primary transition-colors text-md px-3 py-2"
                >
                  Log in
                </Link>
              )}
            </motion.div>
```

- [ ] **Step 3: Render the affordance in the mobile menu**

Immediately after the mobile links `.map(...)` block closes (inside the same
`<div className="py-4 space-y-1">`), add:

```typescript
                <motion.div>
                  {isLoggedIn ? (
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-lg text-text hover:bg-gray-100 hover:text-primary transition-all"
                    >
                      Log out
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="block px-4 py-3 text-lg text-text hover:bg-gray-100 hover:text-primary transition-all"
                      onClick={() => setIsOpen(false)}
                    >
                      Log in
                    </Link>
                  )}
                </motion.div>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `components/navbar.tsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/components/navbar.tsx
git commit -m "feat(frontend): add login/logout affordance to navbar"
```

---

### Task 8: Manual browser verification

**Prerequisites:** Postgres+Redis running (`docker compose up`), backend API (`npm run start:dev`
or equivalent in `backend/`) and worker running, frontend dev server running
(`npm run dev` in `frontend/`), `AUTH_DISABLED` unset or `false` in `backend/.env`.

- [ ] **Step 1: Confirm unauthenticated redirect**

Visit `http://localhost:3000/video` with no token in `localStorage` (clear it via
devtools if needed). Expected: redirected to `/login`.

- [ ] **Step 2: Log in**

At `/login`, enter `dev@example.com` / `devpassword123`. Expected: redirected to
`/video`, `localStorage.getItem('token')` is a JWT string in devtools.

- [ ] **Step 3: Confirm protected pages load real data**

Visit `/tasks` and `/summary/:id` (an existing processed video's id). Expected: data
loads (no 401 in Network tab), `Authorization: Bearer ...` header present on each
`/api/...` request.

- [ ] **Step 4: Confirm upload still works**

Upload a small video file from `/video`. Expected: upload succeeds, status polling
completes, `Authorization` header present on both the upload POST and the status GETs
in the Network tab.

- [ ] **Step 5: Confirm logout**

Click "Log out" in the navbar. Expected: redirected to `/login`, `localStorage` token
cleared, revisiting `/tasks` redirects back to `/login`.

- [ ] **Step 6: Confirm expired/invalid token handling**

Log in again, then in devtools overwrite `localStorage.token` with a garbage string
(e.g. `'invalid'`). Visit `/tasks`. Expected: the `apiFetch` call gets a 401, token is
cleared, and the page redirects to `/login` (may require a manual refresh depending on
timing of the redirect vs. React state — note actual behavior here).

- [ ] **Step 7: Update CLAUDE.md**

Mark this item done in the "Current state" section of `CLAUDE.md` (gitignored,
local-only) with the verification results from steps 1-6.
