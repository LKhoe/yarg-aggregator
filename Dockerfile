# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files, then strip the version field so version bumps don't bust the npm ci cache
COPY package.json package-lock.json ./
RUN sed -i '3s/"version": "[^"]*"/"version": "0.0.0"/' package.json package-lock.json

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files (overwrites package.json with the real version)
COPY . .

# Generate drizzle migrations before build
RUN npm run db:generate

# Build args for NEXT_PUBLIC_ vars (must be available at build time)
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build the application
# Note: Ensure "output: 'standalone'" is set in next.config.js/ts
RUN npm run build

# Bundle the entrypoint scripts (pg + drizzle-orm inlined) so the runner image needs no node_modules
# of its own. The banner gives bundled CommonJS deps (pg) a working require() inside the ESM output;
# pg-native is an optional dependency of pg that is never installed.
RUN npx esbuild scripts/migrate.mjs scripts/apply-sql.mjs \
      --bundle --platform=node --format=esm --target=node24 --external:pg-native \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
      --out-extension:.js=.mjs --outdir=/app/scripts-dist

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only the necessary files for standalone mode
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database migration files
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/setup ./lib/db/setup

# Migration/setup scripts: self-contained bundles built above (same names the entrypoint calls)
COPY --from=builder --chown=nextjs:nodejs /app/scripts-dist ./scripts

# Copy and setup entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Set entrypoint and command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
