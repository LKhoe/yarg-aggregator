#!/bin/sh
set -e

# 1. Wait for database connection?
# The docker-compose 'depends_on' condition 'service_healthy' usually handles this.
# But extra safety doesn't hurt.

echo "🔄 Docker Entrypoint: Preparing Database..."

# 2. Sync Schema (Idempotent - safe to run every time)
# 'db push' is better for containerized self-hosting than 'migrate deploy' 
# because it doesn't require a migration history to be present/valid in the image.
echo "🔄 Pushing Drizzle Schema to DB..."
npm run db:generate && npm run db:migrate

# 3. Apply custom SQL (Extensions, Search, Triggers)
# We run our custom script here
echo "🔄 Applying Custom SQL Setup..."
npm run db:setup

# 4. Start the application
echo "🚀 Starting Next.js..."
exec "$@"
