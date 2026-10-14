# Deployment Guide

This guide covers deploying YARG Aggregator using Docker, optimized for Raspberry Pi but works on any Docker-compatible system.

## Prerequisites

- **Docker** (20.10+)
- **Docker Compose** (v2.0+)
- **Git** (to clone the repository)

### Raspberry Pi Specific

For Raspberry Pi, ensure Docker is installed:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in for group changes
```

## Quick Start

Postgres and Redis are **not** part of this project. They run in the shared
[LocalInfra](../../LocalInfra) stack. Before the first deploy:

1. Start LocalInfra on the Pi (see its README).
2. Provision this app: `DOCKER_CONTEXT=pi LocalInfra/scripts/new-project.sh yarg`
3. Put the printed `DATABASE_URL` / `REDIS_*` variables in this project's `.env` on the Pi.

```bash
# 1. Clone the repository
git clone <repository-url>
cd yarg-aggregator

# 2. Create environment file
cp .env.production.example .env

# 3. Edit .env with your values (see Configuration below)
nano .env

# 4. Build and start
docker compose up -d --build

# 5. Check status
docker compose ps
docker compose logs -f yarg-aggregator
```

## Configuration

Copy `.env.production.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://yarg:<pw>@localinfra-postgres:5432/yarg` (from `new-project.sh`) |
| `REDIS_USERNAME` / `REDIS_PASSWORD` | ✅ | Redis ACL user for this app (from `new-project.sh`) |
| `REDIS_KEY_PREFIX` | ✅ | `yarg:`, the namespace for every Redis key/channel (the ACL only allows `yarg:*`) |
| `BETTER_AUTH_SECRET` | ✅ | Auth secret: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your public URL (e.g., `http://192.168.1.100:3000`) |
| `BETTER_AUTH_URL` | ✅ | Same as `NEXT_PUBLIC_APP_URL` |
| `GOOGLE_CLIENT_ID` | ❌ | For Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | ❌ | For Google OAuth login |

### Generate Secrets

```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32
```

## Common Commands

### Start/Stop

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart yarg-aggregator
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f yarg-aggregator

# Last 100 lines
docker compose logs --tail 100 yarg-aggregator
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Or force rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

### Database Operations

The database lives in LocalInfra (`localinfra-postgres`, database and role `yarg`).
Nightly backups go to the external drive automatically (see the LocalInfra README).

```bash
# Ad-hoc backup (custom format)
docker exec localinfra-postgres pg_dump -U yarg -Fc yarg > yarg.dump

# Restore (replaces contents)
docker exec -i localinfra-postgres pg_restore -U yarg -d yarg --clean --if-exists --no-owner < yarg.dump

# Access database shell
docker exec -it localinfra-postgres psql -U yarg yarg
```

### Cleanup

```bash
# Remove the app container (data lives in LocalInfra, untouched)
docker compose down

# Prune unused Docker resources
docker system prune -f
```

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker compose logs yarg-aggregator

# Check that LocalInfra is up and healthy
docker ps --filter name=localinfra

# Restart from scratch
docker compose down
docker compose up -d
```

### Database migration errors

```bash
# View migration logs
docker compose logs yarg-aggregator | grep -i "migration\|drizzle"

# Manually enter container to debug
docker compose exec yarg-aggregator sh
```

### Out of memory (Raspberry Pi)

Adjust memory limits in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 768M  # Increase from 512M
```

### Port already in use

Change the port in `.env`:
```bash
PORT=3001  # Use a different port
```

## Architecture

```
┌──────────── this project ────────────┐     ┌──────────── LocalInfra ─────────────┐
│  yarg-aggregator (Next.js)  :3000    │     │                                     │
│      │                    │          │     │  localinfra-postgres  db/role "yarg"│
│      └── localinfra_postgres ────────┼────►│  localinfra-redis     user  "yarg"  │
│                           └─ localinfra_redis ──►  (keys "yarg:*")              │
└──────────────────────────────────────┘     │  localinfra-backup → external drive │
           │                                 └─────────────────────────────────────┘
           ▼
      Host :3000 (configurable)
```

## Data Persistence

This project has no data volumes. Postgres and Redis data live in LocalInfra's volumes,
and Postgres is backed up nightly to the external drive by `localinfra-backup`.
