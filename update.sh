#!/bin/bash

set -euo pipefail

# Lightweight update script: pulls latest from git, installs, builds, migrates, restarts
# Usage: ./update.sh [--docker] [--no-install] [--no-build]

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

info(){ echo -e "${BLUE}$1${NC}"; }
success(){ echo -e "${GREEN}$1${NC}"; }
error(){ echo -e "${RED}$1${NC}"; }

USE_DOCKER=0
DO_INSTALL=1
DO_BUILD=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --docker) USE_DOCKER=1; shift ;;
    --no-install) DO_INSTALL=0; shift ;;
    --no-build) DO_BUILD=0; shift ;;
    -h|--help) echo "Usage: ./update.sh [--docker] [--no-install] [--no-build]"; exit 0 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

info "Pulling latest from Git..."
git fetch --all --prune
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# If there are local changes, stash them so pull/rebase succeeds
STASHED=0
if [ -n "$(git status --porcelain)" ]; then
  info "Local changes detected — stashing before update..."
  git add -A
  git stash push -u -m "auto-update-$(date +%s)" || true
  STASHED=1
fi

if git pull --rebase origin "$BRANCH"; then
  success "Updated to latest $BRANCH"
else
  error "git pull failed"
  if [ "$STASHED" -eq 1 ]; then
    info "Attempting to reapply stashed changes (stash left if conflicts)..."
    git stash pop || true
  fi
  exit 1
fi

# If we stashed earlier, try to reapply now
if [ "$STASHED" -eq 1 ]; then
  info "Reapplying stashed changes..."
  if git stash pop; then
    success "Stash reapplied"
  else
    error "Failed to pop stash cleanly — stash preserved. Run 'git stash list' and resolve conflicts manually."
  fi
fi

if [ "$USE_DOCKER" -eq 1 ]; then
  info "Using Docker flow: pulling images and restarting compose"
  docker-compose -f docker-compose.prod.yml pull --quiet
  docker-compose -f docker-compose.prod.yml up -d --remove-orphans
  success "Docker services updated"
  exit 0
fi

if [ "$DO_INSTALL" -eq 1 ]; then
  info "Installing workspace dependencies (root + apps)..."
  # Clean lockfile/node_modules only when necessary; prefer incremental install
  npm install --no-audit --legacy-peer-deps || {
    error "npm install failed; try running: npm install --legacy-peer-deps"
    exit 1
  }
  success "Dependencies installed"
fi

if [ "$DO_BUILD" -eq 1 ]; then
  info "Building backend..."
  npm --prefix apps/backend run build
  success "Backend built"

  info "Running Prisma migrations (deploy)..."
  (cd apps/backend && npx prisma migrate deploy) || error "Prisma migrate failed (check DB)"

  info "Building frontend..."
  npm --prefix apps/frontend run build
  success "Frontend built"
fi

info "Restarting services with PM2 (if available)..."
if command -v pm2 >/dev/null 2>&1; then
  # Delete all frontend/backend entries first to avoid duplicate-process port conflicts,
  # then start fresh. This handles the EADDRINUSE crash-loop caused by stale entries.

  # Kill anything still holding port 3000 (old Next.js instance that survived)
  fuser -k 3000/tcp 2>/dev/null || true

  # Backend: delete all instances, start fresh
  pm2 delete arzesh-backend 2>/dev/null || true
  pm2 start apps/backend/dist/main.js \
    --name arzesh-backend \
    --max-memory-restart 4G \
    --node-args="--max-old-space-size=4096"

  # Frontend: prefer standalone server.js (built with output:'standalone'),
  # fall back to npm start
  pm2 delete arzesh-frontend 2>/dev/null || true
  FRONTEND_DIR="apps/frontend"
  STANDALONE_SERVER="$FRONTEND_DIR/.next/standalone/server.js"
  if [ -f "$STANDALONE_SERVER" ]; then
    # Copy public and static assets required by standalone mode
    cp -r "$FRONTEND_DIR/public" "$FRONTEND_DIR/.next/standalone/public" 2>/dev/null || true
    cp -r "$FRONTEND_DIR/.next/static" "$FRONTEND_DIR/.next/standalone/.next/static" 2>/dev/null || true
    PORT=3000 pm2 start "$STANDALONE_SERVER" \
      --name arzesh-frontend \
      --max-memory-restart 4G \
      --node-args="--max-old-space-size=4096"
  else
    (cd "$FRONTEND_DIR" && pm2 start npm \
      --name arzesh-frontend \
      --max-memory-restart 4G \
      --node-args="--max-old-space-size=4096" \
      -- start)
  fi

  pm2 save || true
  success "PM2 services restarted"
else
  info "pm2 not found — to apply changes manually restart your services (pm2 start/stop)"
fi

success "Update completed"
