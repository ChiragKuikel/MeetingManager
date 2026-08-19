# Frontend auth-header gap fix — design spec

Date: 2026-08-19

## Problem

Phase 4 added a global JWT guard (`JwtAuthGuard` via `APP_GUARD`) on the NestJS backend.
No frontend component ever sends an `Authorization: Bearer <token>` header, and there is
no login page or token storage anywhere in `frontend/`. Every guarded page (`/video`,
`/tasks`, `/summary/:id`) 401s in a real browser unless `AUTH_DISABLED=true` is set on
the backend. This predates Phase 6 and was only caught because Phase 6's frontend work
had no browser to verify against. See `auth-header-gap-discovered` memory.

## Scope

- Login page (email/password), no signup UI (seeded user `dev@example.com` /
  `devpassword123` already exists; signup stays curl/API-only for now).
- Token stored in `localStorage`.
- Every existing frontend `fetch()` call to the backend routed through a shared
  `apiFetch` helper that attaches the Authorization header and handles 401 centrally.
- Client-side route protection: protected pages redirect to `/login` if no token present.
- Logout affordance in the navbar.

Explicitly deferred (not in this pass): signup page, refresh tokens, remember-me,
httpOnly cookie storage, Next.js middleware-based (server-side) route protection.

## Components

**`frontend/lib/auth.ts`**
Plain functions, no framework dependency:
- `getToken(): string | null` — reads `localStorage.getItem('token')`
- `setToken(token: string): void`
- `clearToken(): void`
- `apiFetch(input: string, init?: RequestInit): Promise<Response>` — wraps `fetch`,
  merges `Authorization: Bearer <token>` into headers when a token exists, and on a
  `401` response calls `clearToken()` then `window.location.href = '/login'` before
  returning the response to the caller (caller's existing error handling still fires,
  but the redirect happens regardless).

**`frontend/app/login/page.tsx`**
Email/password form. `POST http://localhost:3001/api/auth/login`. On success, stores
the returned token via `setToken` and redirects to `/video`. On 401, shows an inline
error ("invalid email or password"). No new backend work needed — `AuthService.login`
already exists from Phase 4.

**`frontend/hooks/useRequireAuth.ts`**
`useEffect` that checks `getToken()` on mount; if missing, `router.push('/login')`.
Called at the top of each protected page component (`/video`, `/tasks`,
`/summary/[id]`).

**Existing fetch call sites updated to use `apiFetch`:**
- `frontend/components/VideoList.tsx` (2 calls)
- `frontend/components/VideoSummary.tsx` (2 calls)
- `frontend/components/TaskList.tsx` (1 call)
- `frontend/app/video/page.tsx` (1 call — status polling)

**`frontend/components/navbar.tsx`**
Add a logout button when a token is present (calls `clearToken()`, redirects
`/login`); show a "Login" link when it isn't.

## Flow

1. User visits a protected page.
2. `useRequireAuth()` finds no token → redirect to `/login`.
3. User submits credentials → backend returns JWT → `setToken` → redirect to `/video`.
4. All subsequent data fetches go through `apiFetch`, which attaches the header.
5. If a token expires/becomes invalid, any `apiFetch` call gets a 401 → token cleared,
   user bounced back to `/login` automatically.

## Testing

Browser verification required (this is exactly the gap curl/tsc couldn't catch):
login with seeded dev user → protected pages load real data → logout → protected
pages redirect to `/login` → expired/garbage token → auto-redirect on next fetch.
