#!/bin/bash

# Polled by cron every few minutes. Cheap no-op when origin/main hasn't moved
# (a single `git fetch` + two `git rev-parse` calls); only invokes the full
# update.sh pipeline (install/build/pm2 restart) when there are new commits.
# Usage: ./auto-update.sh   (no args; intended for cron, logs to stdout/stderr)

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: Do not run this script as root or with sudo." >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

BRANCH="main"
git fetch origin "$BRANCH" --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

# .deploy-failed is left by update.sh when migrations could not be applied (services were
# not restarted). Retry the whole pipeline until it succeeds, even with no new commits.
if [ "$LOCAL" = "$REMOTE" ] && [ ! -f "$REPO_ROOT/.deploy-failed" ]; then
  exit 0
fi

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') — retrying failed deploy of ${LOCAL:0:7} ====="
else
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') — new commits on $BRANCH: ${LOCAL:0:7} -> ${REMOTE:0:7} ====="
fi
./update.sh
echo "===== auto-update finished $(date '+%Y-%m-%d %H:%M:%S') ====="
