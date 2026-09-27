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

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "===== $(date '+%Y-%m-%d %H:%M:%S') — new commits on $BRANCH: ${LOCAL:0:7} -> ${REMOTE:0:7} ====="
./update.sh
echo "===== auto-update finished $(date '+%Y-%m-%d %H:%M:%S') ====="
