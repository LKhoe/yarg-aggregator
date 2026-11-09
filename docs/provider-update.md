# Provider Update System

The provider system is responsible for importing song data from external sources (**Enchor.us** and **Rhythmverse**) into the aggregator's PostgreSQL database. Songs come in through one path, the **API fetch** (background job), which feeds the song processing pipeline. Real-time progress is delivered to the admin panel via **SSE over Redis Pub/Sub**.

---

## Architecture Overview

```
Admin Panel (ProviderPanel.tsx)
    |
    | POST /api/providers
    v
 BullMQ Queue (lib/queue.ts)
    |
    |  Background Worker
    v
 External API --> processSongs() (services/songs/)
 (paginated)           |
                       |  Redis Pub/Sub
                       v
                 SSE Endpoint (/api/providers/events)
                       |
                       v
                 EventSource in ProviderPanel
```

---

## Data Flow

### API Fetch (Background Job)

1. **Admin clicks fetch button** in `ProviderPanel`
2. **`POST /api/providers`** validates auth, checks Redis lock (`provider:{source}:running`), reads `lastSuccessfulFetch` from DB, and enqueues a BullMQ job
3. **BullMQ worker** (`lib/queue.ts`) picks up the job:
   - Sets Redis running flag (`provider:{source}:running = true`, TTL 1h)
   - Publishes `{ type: "running", isRunning: true }` to `provider:events` channel
   - Fetches pages from the external API (100 songs/page, 2s rate limit)
   - After each page: writes progress to Redis key AND publishes to `provider:events`
   - Once all pages fetched: runs `processSongs()` (dedup, resolve metadata, insert/update DB)
   - During processing: publishes phase transitions (deduplicating, resolving metadata, building transactions, saving)
   - On completion: updates `lastSuccessfulFetch` in DB, publishes final stats
   - On failure: publishes error details
4. **Worker event handlers** clear the running flag and publish state changes on `completed`, `failed`, and `drained` events

---

## Real-Time Updates (SSE via Redis Pub/Sub)

### Why Redis Pub/Sub?

The BullMQ worker runs in a background process. The SSE endpoint runs in a Next.js API route. Redis Pub/Sub bridges them — the worker publishes events, and SSE subscribers forward them to connected clients. No polling anywhere.

### Channel: `provider:events`

All events are published to a single Redis channel. Each event includes a `source` field so clients can route updates to the correct provider card.

### SSE Endpoint (`GET /api/providers/events`)

On client connect:

1. **Initial state** — reads current progress from Redis keys + `lastSuccessfulFetch` from DB + song counts from `download_url` table, sends as a single `init` event
2. **Subscribes** to `provider:events` using a dedicated ioredis subscriber connection (required by ioredis for pub/sub)
3. **Forwards** each published message as an SSE `data:` frame
4. **Cleanup** on client disconnect: unsubscribes and disconnects the subscriber

### Event Types

| Event | Fields | When |
|-------|--------|------|
| `init` | `{ type, providers: { [name]: { isRunning, progress, lastSuccessfulFetch, songCount } } }` | On SSE connect |
| `running` | `{ source, type: "running", isRunning }` | Job starts / worker completes/fails |
| Progress | `{ source, phase, page, songsFetched, progress?, stats? }` | During fetch/processing |
| Completed | `{ source, phase: "completed", progress: 100, stats, lastSuccessfulFetch }` | Job finished successfully |
| Failed | `{ source, phase: "failed", error }` | Job failed |
| `drained` | `{ type: "drained" }` | All jobs in queue finished |

### Client Side (`ProviderPanel.tsx`)

- Single `useEffect` opens `EventSource('/api/providers/events')` on mount
- `onmessage` handler parses events and updates `providerStatuses` state
- `EventSource` auto-reconnects on network errors
- Cleanup: `eventSource.close()` on unmount

---

## Redis Keys

| Key | Value | TTL | Purpose |
|-----|-------|-----|---------|
| `provider:{source}:running` | `"true"` | 1h | Lock to prevent duplicate fetches |
| `provider:{source}:progress` | JSON progress object | 1h (5min after completion) | Persisted progress for SSE init state |

---

## Database: `provider` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | UUID |
| `name` | enum (`enchor`, `rhythmverse`) | Unique provider identifier |
| `lastSuccessfulFetch` | timestamp | Last time songs were successfully imported |
| `createdAt` | timestamp | Row creation time |
| `updatedAt` | timestamp | Row update time |

### Auto-creation

Provider rows are created lazily via `ProviderService.findOrCreate()`. Both `updateLastSuccessfulFetch()` and `updateLastSuccessfulFetchIfNewer()` call this internally, so the provider table is populated automatically on first use.

### `lastSuccessfulFetch` Logic

- **API fetch**: set to `now()` on completion

---

## Song Processing Pipeline (`processSongs`)

Fetched songs go through `processSongs()` in `services/songs/index.ts`:

1. **Deduplication** — removes duplicate songs within the batch
2. **Fetch existing** — queries DB for songs matching the batch keys
3. **Pre-resolve metadata** — resolves/creates artists, albums, genres
4. **Build transactions** — determines inserts vs updates based on instrument count comparison
5. **Save** — executes DB transactions (insert new songs + download URLs, update existing songs)

Progress is reported via a callback at each phase, which the worker forwards to Redis Pub/Sub.

### Filtering Rules

Songs are ignored if:
- They have fewer than 4 instruments with difficulty data
- An existing version already has more instruments
- No changes are needed (identical data)

---

## File Reference

| File | Role |
|------|------|
| `lib/queue.ts` | BullMQ queue, worker, Redis publish calls |
| `app/api/providers/route.ts` | POST (start fetch), DELETE (stop), GET (status query) |
| `app/api/providers/events/route.ts` | SSE endpoint with Redis Pub/Sub subscription |
| `lib/services/provider.ts` | ProviderService (CRUD, findOrCreate, conditional timestamp update) |
| `services/providers/enchor.ts` | Enchor.us API client and response parser |
| `services/providers/rhythmverse.ts` | Rhythmverse API client and response parser |
| `services/songs/index.ts` | `processSongs()` — shared processing pipeline |
| `components/providers/ProviderPanel.tsx` | Admin UI with EventSource, progress display |
