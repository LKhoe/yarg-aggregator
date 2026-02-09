#!/bin/sh
set -e

echo "========================================"
echo "🚀 YARG Aggregator - Docker Entrypoint"
echo "========================================"

# 1. Wait for database to be ready (defensive - additional to depends_on)
echo "⏳ Waiting for database connection..."
max_retries=30
retry_count=0
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" 2>/dev/null || [ $retry_count -eq $max_retries ]; do
  retry_count=$((retry_count + 1))
  echo "  Attempt $retry_count/$max_retries - Database not ready, waiting..."
  sleep 2
done

if [ $retry_count -eq $max_retries ]; then
  echo "❌ Database connection failed after $max_retries attempts"
  exit 1
fi
echo "✅ Database is ready!"

# 2. Run Drizzle migrations (migrations were generated at build time)
echo ""
echo "🔄 Running database migrations..."
drizzle-kit migrate
echo "✅ Database migrations complete!"

# 3. Apply custom SQL (Extensions, Search, Triggers)
echo ""
echo "🔄 Applying custom SQL setup..."
tsx lib/db/setup/apply-sql.ts
echo "✅ Custom SQL setup complete!"

# 4. Start the application
echo ""
echo "========================================"
echo "🚀 Starting Next.js server..."
echo "========================================"
exec "$@"
