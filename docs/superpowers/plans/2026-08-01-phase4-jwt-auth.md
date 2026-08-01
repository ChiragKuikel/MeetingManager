# Phase 4 JWT Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `VIEWER_ID = 1` with real JWT auth — signup, login, a global guard, and an `AUTH_DISABLED` dev bypass — per `docs/superpowers/specs/2026-08-01-phase4-jwt-auth-design.md`.

**Architecture:** New `src/auth/` module (`AuthController`/`AuthService`/`JwtStrategy`/`JwtAuthGuard`/`@Public()`/`@CurrentUser()`). Guard mounted globally via `APP_GUARD`. `videos.controller.ts`/`summaries.controller.ts` swap `VIEWER_ID` for `@CurrentUser()`. No test framework exists in this repo yet (see `package.json` — no jest/vitest); verification is manual curl end-to-end, matching every prior phase's pattern (see Phase 2/3 memory notes).

**Tech Stack:** NestJS 11, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, Prisma 7.

---

### Task 1: Install auth dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install packages**

Run:
```bash
cd backend
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

- [ ] **Step 2: Verify install**

Run: `node -e "require('bcrypt'); require('passport-jwt'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add JWT auth dependencies"
```

---

### Task 2: Add AUTH_DISABLED to environment config

**Files:**
- Modify: `backend/src/config/environment.ts`
- Modify: `backend/.env`
- Modify: `backend/.env.example` (create the var doc if `.env.example` covers app vars — check first; if `.env.example` only documents Compose vars, skip editing it and just document in `.env`)

- [ ] **Step 1: Add `AUTH_DISABLED` to the `Environment` interface and `env` object**

In `backend/src/config/environment.ts`, add to the interface (after `JWT_SECRET: string;`):

```typescript
    JWT_SECRET: string;
    AUTH_DISABLED: boolean;
```

Add to the `env` object (after the `JWT_SECRET` line):

```typescript
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    AUTH_DISABLED: process.env.AUTH_DISABLED === 'true',
```

- [ ] **Step 2: Add `AUTH_DISABLED=false` to `backend/.env`**

Add this line right after the existing `JWT_SECRET=change-me-in-production` line in `backend/.env`:

```
AUTH_DISABLED=false
```

- [ ] **Step 3: Verify env loads**

Run: `cd backend && node -e "require('ts-node/register'); const {env} = require('./src/config/environment.ts'); console.log(env.AUTH_DISABLED)"`
Expected: `false`

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/environment.ts backend/.env
git commit -m "feat(backend): add AUTH_DISABLED env flag"
```

---

### Task 3: Auth DTOs

**Files:**
- Create: `backend/src/auth/dto/signup.dto.ts`
- Create: `backend/src/auth/dto/login.dto.ts`

- [ ] **Step 1: Write `signup.dto.ts`**

```typescript
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password too long' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
```

- [ ] **Step 2: Write `login.dto.ts`**

```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors referencing `src/auth/dto`

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/dto
git commit -m "feat(backend): add signup/login DTOs"
```

---

### Task 4: AuthService (signup, login, JWT signing)

**Files:**
- Create: `backend/src/auth/auth.service.ts`

- [ ] **Step 1: Write `auth.service.ts`**

```typescript
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const DEFAULT_ORGANIZATION_ID = 1;
const BCRYPT_ROUNDS = 10;

interface JwtPayload {
  sub: number;
  organizationId: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<{ accessToken: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
    });

    return { accessToken: this.signToken(user.id, user.organizationId, user.email) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    return { accessToken: this.signToken(user.id, user.organizationId, user.email) };
  }

  private signToken(userId: number, organizationId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, organizationId, email };
    return this.jwt.sign(payload);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: errors only about missing `AuthModule`/`JwtStrategy` imports elsewhere (not yet created) — no errors inside `auth.service.ts` itself. If `tsc --noEmit` fails project-wide before those files exist, that's expected at this point; re-run after Task 7.

- [ ] **Step 3: Commit**

```bash
git add backend/src/auth/auth.service.ts
git commit -m "feat(backend): add AuthService (signup/login/JWT signing)"
```

---

### Task 5: JwtStrategy + Public decorator + CurrentUser decorator

**Files:**
- Create: `backend/src/auth/jwt.strategy.ts`
- Create: `backend/src/auth/public.decorator.ts`
- Create: `backend/src/auth/current-user.decorator.ts`

- [ ] **Step 1: Write `jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../config/environment';

export interface AuthenticatedUser {
  id: number;
  organizationId: number;
  email: string;
}

interface JwtPayload {
  sub: number;
  organizationId: number;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, organizationId: payload.organizationId, email: payload.email };
  }
}
```

- [ ] **Step 2: Write `public.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 3: Write `current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors inside `src/auth/jwt.strategy.ts`, `public.decorator.ts`, `current-user.decorator.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/jwt.strategy.ts backend/src/auth/public.decorator.ts backend/src/auth/current-user.decorator.ts
git commit -m "feat(backend): add JwtStrategy, @Public and @CurrentUser decorators"
```

---

### Task 6: JwtAuthGuard (with AUTH_DISABLED bypass)

**Files:**
- Create: `backend/src/auth/jwt-auth.guard.ts`

- [ ] **Step 1: Write `jwt-auth.guard.ts`**

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { env } from '../config/environment';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (env.AUTH_DISABLED) {
      const request = context.switchToHttp().getRequest();
      request.user = { id: 1, organizationId: 1, email: 'dev@example.com' };
      return true;
    }

    return super.canActivate(context);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors inside `src/auth/jwt-auth.guard.ts`

- [ ] **Step 3: Commit**

```bash
git add backend/src/auth/jwt-auth.guard.ts
git commit -m "feat(backend): add JwtAuthGuard with AUTH_DISABLED bypass"
```

---

### Task 7: AuthController + AuthModule, wire into AppModule

**Files:**
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write `auth.controller.ts`**

```typescript
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  async signup(@Body() dto: SignupDto) {
    const { accessToken } = await this.auth.signup(dto);
    return { success: true, data: { accessToken } };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const { accessToken } = await this.auth.login(dto);
    return { success: true, data: { accessToken } };
  }
}
```

- [ ] **Step 2: Write `auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { env } from '../config/environment';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 3: Wire `AuthModule` + global `JwtAuthGuard` into `app.module.ts`**

Replace the full contents of `backend/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';
import { SummariesModule } from './summaries/summaries.module';
import { ProcessingModule } from './processing/processing.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { QueueModule, VIDEO_PROCESSING_QUEUE } from './queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    BullBoardModule.forRoot({ route: '/admin/queues', adapter: ExpressAdapter }),
    BullBoardModule.forFeature({ name: VIDEO_PROCESSING_QUEUE, adapter: BullMQAdapter }),
    AuthModule,
    VideosModule,
    SummariesModule,
    ProcessingModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Mark `/health` public**

In `backend/src/health/health.controller.ts`, add the `Public` import and decorator:

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import fileService from '../services/fileService';
import { env } from '../config/environment';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
```

(leave the rest of the method body unchanged)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/auth.controller.ts backend/src/auth/auth.module.ts backend/src/app.module.ts backend/src/health/health.controller.ts
git commit -m "feat(backend): wire AuthModule + global JwtAuthGuard into AppModule"
```

---

### Task 8: Replace VIEWER_ID with @CurrentUser() in videos/summaries controllers

**Files:**
- Modify: `backend/src/videos/videos.controller.ts`
- Modify: `backend/src/summaries/summaries.controller.ts`

- [ ] **Step 1: Rewrite `videos.controller.ts`**

Replace the full file contents with:

```typescript
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';
import { ProcessingService } from '../processing/processing.service';
import { UploadVideoDto } from './dto/upload-video.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { videoMulterOptions } from '../common/multer.config';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import fileService from '../services/fileService';

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly processing: ProcessingService,
  ) {}

  @Post('upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('video', videoMulterOptions))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVideoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No video file uploaded');

    const video = await this.videos.create({
      userId: user.id,
      title: dto.title || file.originalname.replace(/\.[^/.]+$/, ''),
      filename: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    await this.processing.enqueue(video.id);

    return { success: true, data: { id: video.id, filename: file.filename, status: video.status } };
  }

  @Get()
  async list(@Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.videos.listByUser(user.id, pagination.page, pagination.limit);
    return { success: true, data };
  }

  @Get(':id/status')
  async status(@Param('id', ParseIntPipe) id: number) {
    const status = await this.videos.getStatus(id);
    return { success: true, data: { status } };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    const video = await this.videos.findForViewer(id, user.id);
    return { success: true, data: video };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.updateTitle(id, user.id, title);
    return { success: true, message: 'Video updated successfully' };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    const filePath = await this.videos.remove(id, user.id);
    if (filePath) await fileService.deleteFile(filePath);
    return { success: true, message: 'Video deleted successfully' };
  }
}
```

- [ ] **Step 2: Rewrite `summaries.controller.ts`**

Replace the full file contents with:

```typescript
import { Controller, Get, Post, Put, Param, Body, ParseIntPipe } from '@nestjs/common';
import { SummariesService } from './summaries.service';
import { VideosService } from '../videos/videos.service';
import { UpdateSummaryDto } from './dto/update-summary.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('summaries')
export class SummariesController {
  constructor(
    private readonly summaries: SummariesService,
    private readonly videos: VideosService,
  ) {}

  @Get('video/:videoId')
  async getSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.findForViewer(videoId, user.id);
    const summary = await this.summaries.findByVideoId(videoId);
    return { success: true, data: summary };
  }

  @Post('video/:videoId/generate')
  async generateSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.findForViewer(videoId, user.id);
    await this.summaries.generate(videoId);
    return { success: true, message: 'Summary generation started' };
  }

  @Put('video/:videoId')
  async updateSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Body() dto: UpdateSummaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.findForViewer(videoId, user.id);
    await this.summaries.update(videoId, dto);
    return { success: true, message: 'Summary updated successfully' };
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/videos/videos.controller.ts backend/src/summaries/summaries.controller.ts
git commit -m "feat(backend): replace hardcoded VIEWER_ID with authenticated user"
```

---

### Task 9: Update seed script with real bcrypt hash

**Files:**
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/.env.example` (document the dev password)

- [ ] **Step 1: Rewrite `seed.ts` to hash a real dev password**

Replace the full file contents with:

```typescript
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEV_PASSWORD = 'devpassword123';

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Default Organization' },
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  await prisma.user.upsert({
    where: { id: 1 },
    update: { passwordHash },
    create: {
      id: 1,
      organizationId: org.id,
      email: 'dev@example.com',
      name: 'Default User',
      passwordHash,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Document the dev credentials**

Add this block to the bottom of `backend/.env.example`:

```
# Seeded dev user (prisma/seed.ts): dev@example.com / devpassword123
```

- [ ] **Step 3: Re-run the seed against the local dev database**

Run: `cd backend && npx prisma db seed`
Expected: completes without error (upserts user id=1 with the new hash)

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts backend/.env.example
git commit -m "feat(backend): seed dev user with real bcrypt password hash"
```

---

### Task 10: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start Postgres + Redis, then the API**

Run:
```bash
docker compose up -d
cd backend && npm run dev
```
Expected: server logs `Server running on http://localhost:3001`, no crash

- [ ] **Step 2: Signup a new user**

Run:
```bash
curl -s -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123","name":"Alice"}'
```
Expected: `{"success":true,"data":{"accessToken":"..."}}` (201)

- [ ] **Step 3: Signup same email again → 409**

Run: same curl command as Step 2
Expected: HTTP 409, `ConflictException` body (`"Email already registered"`)

- [ ] **Step 4: Login with wrong password → 401**

Run:
```bash
curl -s -i -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"wrong"}'
```
Expected: HTTP 401

- [ ] **Step 5: Login with correct password → 200 + token**

Run:
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
```
Expected: `{"success":true,"data":{"accessToken":"..."}}` — save this token as `$TOKEN` for the next steps

- [ ] **Step 6: Request a protected route with no token → 401**

Run: `curl -s -i http://localhost:3001/api/videos`
Expected: HTTP 401

- [ ] **Step 7: Request a protected route with valid token → 200**

Run:
```bash
TOKEN="<paste accessToken from step 5>"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/videos
```
Expected: `{"success":true,"data":{...}}` with an empty/paginated video list for Alice (userId scoped, not user id=1's videos)

- [ ] **Step 8: Verify AUTH_DISABLED bypass**

Set `AUTH_DISABLED=true` in `backend/.env`, restart `npm run dev`, then run:
```bash
curl -s -i http://localhost:3001/api/videos
```
Expected: HTTP 200 (no token needed), scoped to user id=1. Afterward, set `AUTH_DISABLED=false` again in `backend/.env` and restart, so the repo's dev default stays "auth on."

- [ ] **Step 9: Confirm `/api/health` still public**

Run: `curl -s -i http://localhost:3001/api/health`
Expected: HTTP 200, no token required (with `AUTH_DISABLED=false`)

---

## Post-plan housekeeping (not a task — do after Task 10 passes)

Update `CLAUDE.md`'s "Current state" checklist: check off `Phase 4 — real JWT auth`, and add a one-line summary of what shipped (mirroring the style of the Phase 1-3 entries), same as prior phases.
