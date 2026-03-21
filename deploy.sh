#!/usr/bin/env bash
set -euo pipefail

# Load .env
if [[ -f .env ]]; then
  set -o allexport
  source .env
  set +o allexport
else
  echo "Error: .env file not found" >&2
  exit 1
fi

PI_HOST="${PI_HOST:?PI_HOST is not set in .env}"
PI_USER="${PI_USER:?PI_USER is not set in .env}"
PI_PORT="${PI_PORT:-22}"
REMOTE_DIR="/home/${PI_USER}/yarg-aggregator"

# --- Rollback mode ---
if [[ "${1:-}" == "--rollback" ]]; then
  echo "==> Rolling back to previous image..."
  ssh -p "${PI_PORT}" "${PI_USER}@${PI_HOST}" "
    set -euo pipefail
    cd ${REMOTE_DIR}
    # Restart with the previous image (docker compose keeps the last image)
    docker compose -f docker-compose.yml stop yarg-aggregator
    docker compose -f docker-compose.yml up -d --no-build yarg-aggregator
  "
  echo "==> Rollback complete."
  exit 0
fi

# --- Pre-flight checks ---
CURRENT_BRANCH=$(git branch --show-current)
if [[ "${CURRENT_BRANCH}" != "main" ]]; then
  echo "Warning: You are on branch '${CURRENT_BRANCH}', not 'main'." >&2
  read -rp "Continue anyway? [y/N] " confirm
  [[ "${confirm}" =~ ^[Yy]$ ]] || exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Warning: Working tree has uncommitted changes:" >&2
  git status --short >&2
  read -rp "Continue anyway? [y/N] " confirm
  [[ "${confirm}" =~ ^[Yy]$ ]] || exit 1
fi

START_TIME=$(date +%s)

echo "==> Bumping version..."
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version for deploy"

echo "==> Pushing to git..."
git push origin "${CURRENT_BRANCH}"

echo "==> Deploying to ${PI_USER}@${PI_HOST}:${PI_PORT}..."
ssh -p "${PI_PORT}" "${PI_USER}@${PI_HOST}" "
  set -euo pipefail
  cd ${REMOTE_DIR}
  git pull origin main

  # Build and restart only the app container — DB and Redis stay up
  docker compose -f docker-compose.yml build yarg-aggregator
  docker compose -f docker-compose.yml up -d --no-deps yarg-aggregator

  # Wait for health check
  echo '==> Waiting for app to become healthy...'
  retries=0
  max_retries=30
  until [ \"\$(docker inspect --format='{{.State.Health.Status}}' yarg-aggregator 2>/dev/null)\" = 'healthy' ] || [ \$retries -eq \$max_retries ]; do
    retries=\$((retries + 1))
    echo \"  Attempt \$retries/\$max_retries...\"
    sleep 5
  done

  if [ \$retries -eq \$max_retries ]; then
    echo '❌ App failed to become healthy. Check logs with: docker compose logs yarg-aggregator'
    exit 1
  fi
  echo '✅ App is healthy!'
"

ELAPSED=$(( $(date +%s) - START_TIME ))
if (( ELAPSED >= 60 )); then
  echo "==> Done in $(( ELAPSED / 60 ))m $(( ELAPSED % 60 ))s."
else
  echo "==> Done in ${ELAPSED}s."
fi
