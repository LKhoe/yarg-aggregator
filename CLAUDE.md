# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Development server (port 3000)
npm run build          # Production build (also run by the Dockerfile)
npm run lint           # ESLint
npx tsc --noEmit       # Type check
npm run db:generate    # Generate a Drizzle migration after editing lib/db/schema.ts (commit it)

# Apply schema locally (the Docker entrypoint runs these on every container start)
node --env-file=.env.local scripts/migrate.mjs     # Drizzle migrations
node --env-file=.env.local scripts/apply-sql.mjs   # extensions, full-text search, trigram indexes

# Deploy to the Raspberry Pi (Docker context "umbrel"; builds on the Pi)
DOCKER_CONTEXT=umbrel docker compose up -d --build
DOCKER_CONTEXT=umbrel docker compose logs -f yarg-aggregator
```

There is no test suite. Always pass `DOCKER_CONTEXT` explicitly: the active context is
usually `umbrel`, so a bare `docker compose` runs on the Pi (`desktop-linux` = Docker
Desktop on the Mac).

## Architecture

Full-stack platform that indexes music charts for YARG from Enchor.us and Rhythmverse,
stores metadata in PostgreSQL and serves a fast search UI.

- **Stack**: Next.js 16 (App Router) + React 19, TypeScript (strict), Tailwind CSS 4 + Shadcn UI,
  PostgreSQL + Drizzle ORM, Better Auth (email/password, Google, Spotify, Apple, Last.fm),
  BullMQ + Redis, Docker.
- **Infrastructure**: Postgres and Redis come from the separate LocalInfra repo
  (`../LocalInfra`, containers `localinfra-postgres` / `localinfra-redis`). This app has
  its own DB role `yarg` and a Redis ACL user limited to keys/channels `yarg:*`.
- **Hosting**: Raspberry Pi 4 with umbrelOS 2; public access via the umbrelOS Cloudflare
  Tunnel app (`umbrel_main_network` → `http://yarg-aggregator:3000`). See `DEPLOY.md`.

### Key paths

- `app/api/` — API routes: `music` (search), `providers` (start/stop/retry fetches, `events` SSE,
  `runs` history, `upload` ZIP import), `auth/[...all]`, `installations`, `installed-songs`, `lists`, ...
- `app/admin/` — admin pages (`ProtectedRoute requiredRole="admin"`), e.g. `providers`
- `lib/db/schema.ts` — Drizzle schema; migrations in `lib/db/migrations/`, search SQL in `lib/db/setup/`
- `lib/auth.ts` — Better Auth config; `databaseHooks.user.create.after` creates the profile
  (first user = admin) and the Favorites list
- `lib/services/music.ts` — search (fuzzy `similarity()`, "song - artist" parsing, cursor pagination, filters)
- `lib/redis.ts` — Redis clients and key namespacing
- `lib/queue.ts` — BullMQ queue + worker (concurrency 1) that runs provider fetches
- `services/providers/` — provider fetch pipeline (below)
- `services/songs/` — normalise, dedupe and save songs (`processSongs`)
- `services/cache-reader/` — YARG cache file parser
- `components/providers/` — Provider control panel (live run view, page map, history)
- `types/index.ts` — central types (incl. `FetchRunSnapshot`, `FetchGap`)
- `messages/*.json` — translations (7 locales)

### Provider fetch pipeline

`ProviderFetchRunner` (`services/providers/fetch-runner.ts`) runs one fetch run:

- Adapters (`enchor.ts`, `rhythmverse.ts`) build the request and parse a page; each entry
  is parsed on its own, bad entries become `issues` instead of failing the page.
- `http.ts`: `AdaptivePacer` (AIMD pacing, learns the unknown rate limit, pace saved in Redis)
  and `requestJson` with separate retry budgets for rate limits (429/403/503+Retry-After),
  transient errors (5xx, network, invalid body) and permanent 4xx.
- Every page is saved right away (`processSongs`). A page that keeps failing becomes a
  **gap** bounded by neighbouring `sourceUpdatedAt` timestamps; gaps are re-fetched by
  walking until the lower bound (safe when the listing shifts). Circuit breaker after
  3 consecutive failures.
- Runs persist in `provider_fetch_run` (status, page map, gaps, counters). The unfetched rest
  is a `pending` gap, so cancel/crash/restart leaves a resumable run (`recoverInterruptedRuns`
  at worker boot). `provider.source_cursor` = newest fully ingested timestamp; the next
  incremental run stops 24h below it, and the cursor never moves past an unfilled gap.
- Live state: snapshot in Redis `provider:{source}:progress`, published on the
  `provider:events` channel → SSE `/api/providers/events`. Lock `provider:{source}:running`,
  cooperative stop via `provider:{source}:cancel`.

## Gotchas

- **Redis keys must use the prefix.** The ACL only allows `yarg:*`. Use the helpers in
  `lib/redis.ts`: `getRedisClient()` / `createRedisReader()` add `keyPrefix`; BullMQ uses
  `getQueueConnection()` + `prefix: BULLMQ_PREFIX` (BullMQ rejects `keyPrefix`); pub/sub
  channel names go through `redisChannel()`. Anything else fails with `NOPERM`.
- **IDs are generated in JS**, not by the database (`text` primary keys with
  `$default(() => randomUUID())`). Raw SQL inserts (`db.execute(sql\`...\`)`) must pass the
  id explicitly, and enum columns need a cast (e.g. `'admin'::role`).
- **Translations have no fallback.** The client `t()` (`contexts/TranslationContext.tsx`)
  returns the key itself when it's missing, so add new keys to all 7 files in `messages/`.
- **`NEXT_PUBLIC_APP_URL` is baked in at build time** (Docker build arg); rebuild after changing it.
- **Runner-stage deps come from the lockfile** (`npm ci --omit=dev` in the Dockerfile). Never
  replace it with `npm install <pkg>`: with a package.json and no lockfile that re-resolves every
  dependency to the newest matching version, so sharp's libvips (dlopen'd, not traced into the
  standalone output) drifts from the locked sharp binary and image processing fails with
  `libvips-cpp.so.X: No such file`.
- **Schema changes**: edit `lib/db/schema.ts`, run `npm run db:generate`, commit the migration.
  It is applied automatically when the container starts.

## Environment

- Local dev: `.env.local` (overrides `.env`) with `localhost` hosts for LocalInfra running on
  Docker Desktop; see README "Local development".
- Pi: `.env` on the Mac (compose reads it through the Docker context). Required:
  `DATABASE_URL`, `POSTGRES_HOST`, `REDIS_HOST`, `REDIS_USERNAME`, `REDIS_PASSWORD`,
  `REDIS_KEY_PREFIX=yarg:`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`.
  Full list in `.env.example`.
