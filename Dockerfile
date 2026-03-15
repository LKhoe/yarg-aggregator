# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY . .

# Generate drizzle migrations before build
RUN npm run db:generate

# Build args for NEXT_PUBLIC_ vars (must be available at build time)
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build the application
# Note: Ensure "output: 'standalone'" is set in next.config.js/ts
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install pg_isready for entrypoint health check
RUN apk add --no-cache postgresql-client

# Install tsx globally for running TypeScript setup scripts
RUN npm install -g tsx

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install migration dependencies before copying app files for better layer caching
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
RUN npm install pg postgres drizzle-orm drizzle-kit

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
# Note: drizzle.config.ts specifies out: './lib/db/migrations'
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/lib/db ./lib/db

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
