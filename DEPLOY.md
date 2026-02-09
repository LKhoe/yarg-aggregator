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
| `POSTGRES_PASSWORD` | ✅ | Database password (use a strong random value) |
| `BETTER_AUTH_SECRET` | ✅ | Auth secret: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your public URL (e.g., `http://192.168.1.100:3000`) |
| `BETTER_AUTH_URL` | ✅ | Same as `NEXT_PUBLIC_APP_URL` |
| `GOOGLE_CLIENT_ID` | ❌ | For Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | ❌ | For Google OAuth login |

### Generate Secrets

```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
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

```bash
# Backup database
docker compose exec postgres pg_dump -U postgres yarg_db > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres yarg_db < backup.sql

# Access database shell
docker compose exec postgres psql -U postgres yarg_db
```

### Cleanup

```bash
# Remove containers (keeps data volumes)
docker compose down

# Remove everything including volumes (⚠️ DELETES DATA)
docker compose down -v

# Prune unused Docker resources
docker system prune -f
```

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker compose logs yarg-aggregator

# Check if database is healthy
docker compose ps

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
┌─────────────────────────────────────────────┐
│               Docker Network                │
│                                             │
│  ┌──────────────┐  ┌─────────┐  ┌─────────┐ │
│  │    App       │  │ Postgres│  │  Redis  │ │
│  │  (Next.js)   │──│  :5432  │  │  :6379  │ │
│  │    :3000     │  └─────────┘  └─────────┘ │
│  └──────────────┘                           │
└─────────────────────────────────────────────┘
           │
           ▼
      Host :3000 (configurable)
```

## Data Persistence

Data is stored in Docker volumes:
- `postgres_data` - Database files
- `redis_data` - Redis cache

Volumes persist across container restarts. To backup:
```bash
# Find volume location
docker volume inspect yarg-aggregator_postgres_data

# Or use pg_dump as shown above (recommended)
```
