# Phase 4 — Real JWT Auth (design)

Date: 2026-08-01
Status: approved

## Goal
Replace hardcoded `VIEWER_ID = 1` with real JWT-based auth: signup, login, guarded
routes, `AUTH_DISABLED` dev bypass — per `migration-plan.md` Phase 4 and CLAUDE.md's
"real JWT auth (no hardcoded user IDs, no auth bypass except behind explicit
AUTH_DISABLED=true env flag)".

## Scope decisions
- Signup creates a User joining the existing single Organization (`id: 1`). No
  multi-org signup — deferred, single-tenant reality unchanged for now.
- HS256 (shared secret `JWT_SECRET` env var), not RS256 — only this backend issues
  and verifies tokens, no external verifiers exist yet.
- Access token only, 7-day expiry, no refresh token / refresh endpoint. Re-login on
  expiry. Simplest option adequate at current scale.
- `AUTH_DISABLED=true` bypass: guard short-circuits to a fixed viewer
  (`{ id: 1, organizationId: 1 }`) without validating any token. Matches the
  CLAUDE.md-mandated escape hatch exactly, no more no less.

## Architecture

New `src/auth/` module:
- `AuthModule` — imports `JwtModule.register({ secret, signOptions: { expiresIn: '7d' } })`,
  `PassportModule`.
- `AuthService` — `signup(email, password, name)`: bcrypt-hash password, create User
  with `organizationId: 1`, sign+return JWT. `login(email, password)`: find User by
  email, `bcrypt.compare`, sign+return JWT on match else throw `UnauthorizedException`.
- `AuthController` — `POST /api/auth/signup`, `POST /api/auth/login`. Both `@Public()`.
- `JwtStrategy` (extends `PassportStrategy(Strategy)` from `passport-jwt`) — extracts
  bearer token, verifies against `JWT_SECRET`, returns
  `{ id: payload.sub, organizationId: payload.organizationId, email: payload.email }`
  as `request.user`.
- `JwtAuthGuard` (extends `AuthGuard('jwt')`) — `canActivate()`: if
  `process.env.AUTH_DISABLED === 'true'`, set `request.user = { id: 1, organizationId: 1 }`
  and return true; else delegate to passport-jwt via `super.canActivate()`.
- `@Public()` decorator (`SetMetadata('isPublic', true)`) + guard checks it via
  `Reflector` before running any auth logic, to exempt `/auth/signup`, `/auth/login`,
  `/health`.

JWT payload shape: `{ sub: userId, organizationId, email }`.

## Global wiring
`JwtAuthGuard` registered as `APP_GUARD` in `app.module.ts` — every route protected
by default unless marked `@Public()`. Matches CLAUDE.md: "Auth guards are mounted on
routes by default."

## Controller changes
`videos.controller.ts`, `summaries.controller.ts`: remove `const VIEWER_ID = 1`.
Add a `@CurrentUser()` param decorator (reads `request.user`) and replace every
`VIEWER_ID` usage with `user.id`.

## Data model
No migration needed — `User.passwordHash` already exists in `schema.prisma`
(Phase 1). `prisma/seed.ts` updated to set a real bcrypt hash for the seeded dev
user (dev password documented in `.env.example`), replacing whatever placeholder
value is there now.

## Error handling
- Bad login credentials → `UnauthorizedException` (401), Nest's default shape, no
  custom filter (continues the Phase 2 decision).
- Signup duplicate email → catch Prisma P2002 in `AuthService.signup`, rethrow as
  `ConflictException` (409). This is the first Prisma-error-mapping case flagged in
  Phase 2 memory ("add ONE small Prisma-only filter in Phase 4/5 if needed") — scoped
  to just this one case, not a general exception filter.

## Testing plan (manual e2e, matches existing project pattern — no test suite yet)
1. `POST /api/auth/signup` → 201 + token.
2. `POST /api/auth/signup` same email again → 409.
3. `POST /api/auth/login` wrong password → 401.
4. `POST /api/auth/login` correct → 200 + token.
5. `GET /api/videos` with no `Authorization` header → 401.
6. `GET /api/videos` with valid token → 200, scoped to that user.
7. Set `AUTH_DISABLED=true`, restart, `GET /api/videos` with no header → 200 as
   viewer id 1.
