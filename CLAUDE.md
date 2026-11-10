# CLAUDE.md

Indexes music charts for YARG from Enchor.us and Rhythmverse into PostgreSQL and serves a fast
search UI. Workspace rules (branching, `DOCKER_CONTEXT`, env files, security, local-infra):
`../CLAUDE.md`. Deployment: `DEPLOY.md`.

## Commands

```bash
npm run dev            # Development server (port 3000)
npm run build          # Production build (also run by the Dockerfile)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # vitest (pure units only: validation, chart parsing/tempo, song normalization)
npm run db:generate    # Generate a Drizzle migration after editing lib/db/schema.ts (commit it)
npm run db:check       # Fails if schema.ts and the committed migrations are out of sync (also run by the Dockerfile)

# Apply schema locally (the Docker entrypoint runs these on every container start)
node --env-file=.env.local scripts/migrate.mjs     # Drizzle migrations
node --env-file=.env.local scripts/apply-sql.mjs   # extensions, trigram indexes

# Deploy to the Pi
./deploy.sh                # also: --release (bump + push), --rollback
DOCKER_CONTEXT=umbrel docker compose logs -f yarg-aggregator
```

Tests live beside the code as `*.test.ts` and need no database or Redis.

## Architecture

- Next.js 16 + React 19, Better Auth (Google, Spotify, Apple, Last.fm), BullMQ + Redis.
- DB role `yarg`; Redis ACL user limited to keys/channels `yarg:*`.
- LLM calls (admin agent) go through local-infra's gateway (`lib/services/llm.ts`), never straight
  to OpenRouter.

### Key paths

- `app/api/` — API routes: `music` (search), `providers` (start/stop/retry fetches, `events` SSE,
  `runs` history), `auth/[...all]`, `installations`, `installed-songs`, `lists`, ...
- `app/admin/` — admin pages (`ProtectedRoute requiredRole="admin"`), e.g. `providers`
- `lib/db/schema.ts` — Drizzle schema; migrations in `lib/db/migrations/`, search SQL in `lib/db/setup/`
- `lib/auth.ts` — Better Auth config; `databaseHooks.user.create.after` creates the profile
  (first user = admin) and the Favorites list
- `lib/services/music.ts` — search (fuzzy trigram `%` candidate subqueries that use the GIN indexes, `similarity()` only for ranking; "song - artist" parsing, cursor pagination, filters)
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
- **The runner image has no `npm ci`** (it was ~650 MB). It holds only Next's standalone output
  (which includes `sharp` and its libvips, traced from the builder's locked install) plus
  `scripts/migrate.mjs` / `scripts/apply-sql.mjs`, which the builder stage bundles with esbuild
  (pg + drizzle-orm inlined). A new runtime dependency used only by those scripts needs no Dockerfile
  change; a native `dlopen`'d library that Next's tracing misses would have to be copied from the
  builder. Never `npm install <pkg>` in the runner: it re-resolves every dependency and sharp's
  libvips drifts from the locked binary (`libvips-cpp.so.X: No such file`).
- **Schema changes**: edit `lib/db/schema.ts`, run `npm run db:generate`, commit the migration.
  It is applied automatically when the container starts. The image build runs `npm run db:check`
  and fails on drift; it never generates migrations itself.
- **Env**: variable list in `.env.example` (`REDIS_KEY_PREFIX=yarg:`); local setup in README
  "Local development".
