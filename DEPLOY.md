# Deployment

YARG Aggregator runs on a Raspberry Pi 4 with umbrelOS 2. It is deployed **from the Mac**
through a Docker context named `umbrel`: `docker compose` runs on the Mac, but the
image is built and the container runs on the Pi. Nothing is cloned on the Pi.

```
┌──────────── this repo ───────────────┐     ┌──────────── LocalInfra ─────────────┐
│  yarg-aggregator (Next.js)  :3000    │     │                                     │
│      ├── localinfra_postgres ────────┼────►│  localinfra-postgres  db/role "yarg"│
│      ├── localinfra_redis ───────────┼────►│  localinfra-redis     user  "yarg"  │
│      └── umbrel_main_network         │     │                       (keys yarg:*) │
└──────────│───────────────────────────┘     │  localinfra-backup → external drive │
           ▼                                 └─────────────────────────────────────┘
  Cloudflare Tunnel app (umbrelOS) → http://yarg-aggregator:3000
  LAN: http://umbrel.local:3000
```

- **Postgres and Redis** come from [LocalInfra](https://github.com/LKhoe/LocalInfra) (start
  it first). This repo has no data volumes; the database is backed up nightly by LocalInfra.
- **Public access** goes through the umbrelOS Cloudflare Tunnel app, which is on
  `umbrel_main_network`; the container joins that network, so the tunnel reaches it as
  `http://yarg-aggregator:3000`.
- **Migrations** run automatically on every container start (`docker-entrypoint.sh`:
  wait for Postgres → `scripts/migrate.mjs` → `scripts/apply-sql.mjs` → start Next.js).

## Prerequisites (on the Mac)

- Docker CLI (Docker Desktop) and the `umbrel` context, with SSH key login to the Pi.
  Setup steps are in the LocalInfra README, section 1.
- LocalInfra running on the Pi: `DOCKER_CONTEXT=umbrel docker ps --filter name=localinfra`
  shows `localinfra-postgres` and `localinfra-redis` as healthy.

## First deploy

The easiest way is LocalInfra's bootstrap. It provisions the `yarg` database role and
Redis user, writes their credentials into this repo's `.env`, then builds and starts
the app:

```bash
cp .env.example .env      # then fill in the app settings below (leave the DB/Redis lines)
../../LocalInfra/scripts/bootstrap-pi.sh
```

By hand, the same thing:

```bash
DOCKER_CONTEXT=umbrel ../../LocalInfra/scripts/new-project.sh yarg   # paste its output into .env
DOCKER_CONTEXT=umbrel docker compose up -d --build
```

The build runs on the Pi and takes about 3–5 minutes.

## Configuration (`.env`)

Compose reads `.env` **on the Mac**. It is git-ignored; `.env.example` lists every key.

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | from `new-project.sh`: `postgresql://yarg:<pw>@localinfra-postgres:5432/yarg` |
| `POSTGRES_HOST`, `POSTGRES_PORT` | ✅ | `localinfra-postgres`, `5432` (the entrypoint waits for it) |
| `REDIS_HOST`, `REDIS_PORT` | ✅ | `localinfra-redis`, `6379` |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | ✅ | from `new-project.sh` (Redis ACL user `yarg`) |
| `REDIS_KEY_PREFIX` | ✅ | `yarg:`; the ACL only allows keys/channels `yarg:*` |
| `BETTER_AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✅ | public URL, e.g. `https://yarg.example.com` |
| `NEXT_PUBLIC_APP_URL` | ✅ | same as `BETTER_AUTH_URL`. Baked in at **build** time: rebuild after changing it |
| `PORT` | | host port on the Pi, default `3000` |
| `GOOGLE_*`, `SPOTIFY_*`, `APPLE_*` | | OAuth sign-in; the callback URLs must use the public URL |
| `LASTFM_API_KEY`, `LASTFM_API_SECRET` | | Last.fm sign-in and import (disabled when empty) |
| `YOUTUBE_API_KEY`, `SOUNDCLOUD_CLIENT_ID`, `OPENROUTER_API_KEY` | | optional features |

After the first sign-up on a fresh database, that account is the admin. Fill the library
from **Admin → Providers**.

## Redeploy after changes

```bash
DOCKER_CONTEXT=umbrel docker compose up -d --build
```

Only the app container is rebuilt and restarted; LocalInfra keeps running. Check it:

```bash
DOCKER_CONTEXT=umbrel docker compose ps                  # STATUS should say (healthy)
DOCKER_CONTEXT=umbrel docker compose logs -f yarg-aggregator
curl -s http://umbrel.local:3000/api/health              # {"status":"ok"}
```

## Common commands

All from the repo folder on the Mac:

```bash
DOCKER_CONTEXT=umbrel docker compose restart yarg-aggregator
DOCKER_CONTEXT=umbrel docker compose down                 # removes the app container only; data stays in LocalInfra
DOCKER_CONTEXT=umbrel docker compose logs --tail 100 yarg-aggregator
DOCKER_CONTEXT=umbrel docker compose exec yarg-aggregator sh
```

### Database

The database is `yarg` in `localinfra-postgres`. Nightly backups are handled by
LocalInfra (its README, section 5).

```bash
# shell
DOCKER_CONTEXT=umbrel docker exec -it localinfra-postgres psql -U postgres -d yarg
# ad-hoc dump to the Mac
DOCKER_CONTEXT=umbrel docker exec localinfra-postgres pg_dump -U postgres -Fc yarg > yarg.dump
# restore (replaces contents)
DOCKER_CONTEXT=umbrel docker exec -i localinfra-postgres pg_restore -U postgres -d yarg --clean --if-exists --no-owner --role=yarg < yarg.dump
```

## Troubleshooting

- **Container not healthy**: `DOCKER_CONTEXT=umbrel docker compose logs yarg-aggregator`.
  The entrypoint prints each step (database wait, migrations, SQL setup).
- **`Database connection failed after 30 attempts`**: LocalInfra isn't running, or the
  container isn't on `localinfra_postgres`: `DOCKER_CONTEXT=umbrel docker ps --filter name=localinfra`.
- **Redis `NOPERM` errors**: `REDIS_KEY_PREFIX` must be `yarg:` and match the ACL user.
- **`network umbrel_main_network declared as external, but could not be found`**:
  start any umbrelOS app once (the Cloudflare Tunnel app creates it), or remove that
  network from `docker-compose.yml` if you don't use the tunnel.
- **Sign-in redirects to the wrong host**: `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` must be
  the public URL; rebuild after changing `NEXT_PUBLIC_APP_URL`.
- **Out of memory**: the container is limited to 512 MB (`deploy.resources.limits.memory`
  in `docker-compose.yml`).
