# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm dev                # Start development server (port 3000)
npm build              # Build for production
npm lint               # Run ESLint
npm db:generate        # Generate Drizzle ORM migrations
npm db:migrate         # Run database migrations
npm db:studio          # Open Drizzle Studio (GUI for DB)
npm db:setup           # Apply SQL setup scripts (full-text search)
```

## Architecture Overview

YARG Content Aggregator is a full-stack web platform for indexing and serving music charts for a rhythm game. It aggregates data from external sources (Enchor.us, Rhythmverse), stores metadata in PostgreSQL, and provides a fast search interface.

### Technology Stack

- **Frontend**: Next.js 16 (App Router) with React 19, Tailwind CSS 4, Shadcn UI
- **Language**: TypeScript 5 (strict mode)
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Authentication**: Better Auth (email/password with session management)
- **Job Queue**: BullMQ with Redis (for background data fetching)
- **Internationalization**: next-intl (7 languages)

### Key Directories

- `/app/api/` - API routes: `/music` (search), `/providers` (fetch management), `/auth/[...all]` (Better Auth), `/installations`, `/installed-songs`
- `/lib/db/schema.ts` - Drizzle ORM schema (Users, Songs, Artists, Albums, Genres, Installations)
- `/lib/services/music.ts` - MusicService: search with fuzzy matching, cursor-based pagination, multi-field filtering
- `/lib/services/provider.ts` - ProviderService: external data fetching
- `/lib/queue.ts` - BullMQ worker and queue setup for background jobs
- `/services/providers/` - External API clients (enchor.ts, rhythmverse.ts)
- `/services/cache-reader/` - YARG cache file parser (complex binary format)
- `/components/data-table/MusicTable.tsx` - Main interactive music table
- `/types/index.ts` - Central TypeScript type definitions

### Search Architecture

MusicService implements advanced search with:
- PostgreSQL `similarity()` function for fuzzy matching
- Smart query parsing (detects "song - artist" pattern)
- Cursor-based pagination with encoded cursors
- Multi-field filtering: query, genre, instruments (guitar/bass/drums/keys/vocals), source, installation status
- Weighted relevance scoring

### Background Job Processing

Provider fetch jobs use BullMQ with Redis:
- Redis locks (`provider:{source}:running`) prevent duplicate fetches
- Jobs process sequentially with 2-second rate limiting
- Worker in `/lib/queue.ts` handles fetch, insert/update, and cleanup

### Database Patterns

- All primary keys are UUIDs
- Drizzle relations configured for eager loading
- Full-text search using PostgreSQL `similarity()` function
- Cascade delete on foreign keys
- Indexes on difficulty fields, foreign keys, and updatedAt for sorting

### Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
```
