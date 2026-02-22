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

echo "==> Pushing to git..."
git push origin main

echo "==> Deploying to ${PI_USER}@${PI_HOST}:${PI_PORT}..."
ssh -p "${PI_PORT}" "${PI_USER}@${PI_HOST}" "
  set -euo pipefail
  cd ${REMOTE_DIR}
  git pull origin main
  docker compose -f docker-compose.yml up -d --build
"

echo "==> Done."
