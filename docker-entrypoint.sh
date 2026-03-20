#!/bin/sh
set -e

echo "========================================"
echo "🚀 YARG Aggregator - Docker Entrypoint"
echo "========================================"

# 1. Wait for database to be ready (pure Node — no postgresql-client needed)
echo "⏳ Waiting for database connection..."
max_retries=30
retry_count=0
until node -e "
  const net = require('net');
  const s = net.createConnection({
    host: process.env.POSTGRES_HOST || 'postgres',
    port: Number(process.env.POSTGRES_PORT || 5432)
  });
  s.on('connect', () => { s.destroy(); process.exit(0); });
  s.on('error', () => process.exit(1));
  setTimeout(() => process.exit(1), 2000);
" 2>/dev/null || [ $retry_count -eq $max_retries ]; do
  retry_count=$((retry_count + 1))
  echo "  Attempt $retry_count/$max_retries - Database not ready, waiting..."
  sleep 2
done

if [ $retry_count -eq $max_retries ]; then
  echo "❌ Database connection failed after $max_retries attempts"
  exit 1
fi
echo "✅ Database is ready!"

# 2. Run Drizzle migrations via plain .mjs script (no drizzle-kit or tsx needed)
echo ""
echo "🔄 Running database migrations..."
node scripts/migrate.mjs
echo "✅ Database migrations complete!"

# 3. Apply custom SQL (Extensions, Search, Triggers)
echo ""
echo "🔄 Applying custom SQL setup..."
node scripts/apply-sql.mjs
echo "✅ Custom SQL setup complete!"

# 4. Start the application
echo ""
echo "========================================"
echo "🚀 Starting Next.js server..."
echo "========================================"
exec "$@"
