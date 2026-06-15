#!/bin/bash

set -euo pipefail

# Refuse to run as root — running as root creates a root PM2 daemon that
# hijacks ports 3000/3001 and conflicts with the app-user PM2 instance.
if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: Do not run this script as root or with sudo."
    echo "       Run as the application user: bash update.sh"
    exit 1
fi

# Usage: ./update.sh [--docker] [--no-install] [--no-build]

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

# ── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()   { echo -e "${BLUE}>> $1${NC}"; }
ok()     { echo -e "${GREEN}   OK  $1${NC}"; }
warn()   { echo -e "${YELLOW}   WARN $1${NC}"; }
err()    { echo -e "${RED}   ERR  $1${NC}"; }
header() { echo -e "\n${BOLD}${CYAN}-- $1 -----------------------------------------------${NC}"; }

# ── Step tracking ──────────────────────────────────────────────
declare -a STEP_LABELS=()
declare -a STEP_STATUS=()
declare -a STEP_TIMES=()
_STEP_NAME=""
_STEP_START=0

step_start() { _STEP_NAME="$1"; _STEP_START=$(date +%s); info "$1..."; }
step_done()  {
  local t=$(( $(date +%s) - _STEP_START ))
  STEP_LABELS+=("$_STEP_NAME"); STEP_STATUS+=("ok");   STEP_TIMES+=("${t}s")
  ok "$_STEP_NAME (${t}s)"
}
step_skip()  {
  STEP_LABELS+=("$_STEP_NAME (skip)"); STEP_STATUS+=("skip"); STEP_TIMES+=("-")
}
step_fail()  {
  local t=$(( $(date +%s) - _STEP_START ))
  STEP_LABELS+=("$_STEP_NAME"); STEP_STATUS+=("fail"); STEP_TIMES+=("${t}s")
  err "$_STEP_NAME failed"
}

SCRIPT_START=$(date +%s)

# ── Flags ──────────────────────────────────────────────────────
USE_DOCKER=0; DO_INSTALL=1; DO_BUILD=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --docker)     USE_DOCKER=1;  shift ;;
    --no-install) DO_INSTALL=0;  shift ;;
    --no-build)   DO_BUILD=0;    shift ;;
    -h|--help)    echo "Usage: ./update.sh [--docker] [--no-install] [--no-build]"; exit 0 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── 1. Git pull ────────────────────────────────────────────────
header "Git"
step_start "Git pull"

git fetch --all --prune
BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_BEFORE=$(git rev-parse HEAD)

STASHED=0
if [ -n "$(git status --porcelain)" ]; then
  warn "Local changes detected — stashing before update"
  git add -A
  git stash push -u -m "auto-update-$(date +%s)" || true
  STASHED=1
fi

if git pull --rebase origin "$BRANCH"; then
  GIT_AFTER=$(git rev-parse HEAD)
  step_done
else
  step_fail
  [ "$STASHED" -eq 1 ] && { warn "Restoring stash..."; git stash pop || true; }
  exit 1
fi

[ "$STASHED" -eq 1 ] && { info "Restoring stash..."; git stash pop && ok "Stash restored" || warn "Stash needs manual resolve"; }

# Show what changed
if [ "$GIT_BEFORE" != "$GIT_AFTER" ]; then
  COUNT=$(git rev-list --count "$GIT_BEFORE".."$GIT_AFTER" 2>/dev/null || echo "?")
  echo -e "  ${CYAN}$COUNT new commit(s) on $BRANCH${NC}"
  git log --oneline "$GIT_BEFORE".."$GIT_AFTER" | sed 's/^/  /'
  CHANGED=$(git diff --name-only "$GIT_BEFORE" "$GIT_AFTER" 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  ${CYAN}$CHANGED files changed${NC}"
else
  echo -e "  ${YELLOW}Already up to date — building local state${NC}"
fi

# ── Docker shortcut ────────────────────────────────────────────
if [ "$USE_DOCKER" -eq 1 ]; then
  header "Docker"
  step_start "Docker update"
  docker-compose -f docker-compose.prod.yml pull --quiet
  docker-compose -f docker-compose.prod.yml up -d --remove-orphans
  step_done
  echo -e "\n${GREEN}${BOLD}Docker update complete${NC}"
  exit 0
fi

# ── 2. Install ─────────────────────────────────────────────────
if [ "$DO_INSTALL" -eq 1 ]; then
  header "Dependencies"
  step_start "npm install"
  npm install --no-audit --legacy-peer-deps 2>&1 | tail -3 || {
    step_fail
    err "npm install failed. Try: npm install --legacy-peer-deps"
    exit 1
  }
  step_done
else
  _STEP_NAME="npm install"; step_skip
fi

# ── 3. Build ───────────────────────────────────────────────────
if [ "$DO_BUILD" -eq 1 ]; then
  header "Build"

  step_start "Backend build"
  npm --prefix apps/backend run build 2>&1 | grep -E '(error TS|Error:|warning TS)' | head -20 || true
  step_done

  step_start "Prisma migrate"
  if (cd apps/backend && npx prisma migrate deploy 2>&1 | grep -E '(Applying|applied|error|Error|No pending|failed)' | head -15); then
    step_done
  else
    step_fail
    warn "Migration failed — check DB state"
  fi

  step_start "Frontend build"
  FE_BUILD_OUT=$(npm --prefix apps/frontend run build 2>&1)
  FE_BUILD_EC=$?
  echo "$FE_BUILD_OUT" | grep -E '(Route |✓|warn |⚠)' | grep -v "^$" | head -20 || true
  # Check both exit code and error strings in output (Next.js sometimes exits 0 on build errors)
  if [ $FE_BUILD_EC -ne 0 ] || echo "$FE_BUILD_OUT" | grep -qE '(Build error occurred|Turbopack build failed|Error: )'; then
    step_fail
    echo -e "${RED}--- Frontend build error output ---${NC}"
    echo "$FE_BUILD_OUT" | grep -A5 -E '(Build error|Turbopack|Error:)' | head -50
    exit 1
  fi
  step_done
else
  _STEP_NAME="Backend build";   step_skip
  _STEP_NAME="Prisma migrate";  step_skip
  _STEP_NAME="Frontend build";  step_skip
fi

# ── 4. PM2 restart ─────────────────────────────────────────────
header "Services"

if ! command -v pm2 >/dev/null 2>&1; then
  warn "pm2 not found — restart services manually"
else
  step_start "Free ports"
  fuser -k 3001/tcp 2>/dev/null || true
  sudo lsof -ti :3001 2>/dev/null | xargs -r sudo kill -9 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  sudo lsof -ti :3000 2>/dev/null | xargs -r sudo kill -9 2>/dev/null || true
  sleep 1
  step_done

  step_start "Start backend"
  pm2 delete arzesh-backend >/dev/null 2>&1 || true
  pm2 start apps/backend/dist/main.js \
    --name arzesh-backend \
    --max-memory-restart 4G \
    --node-args="--max-old-space-size=4096" >/dev/null 2>&1
  step_done

  step_start "Start frontend"
  pm2 delete arzesh-frontend >/dev/null 2>&1 || true
  FRONTEND_DIR="apps/frontend"
  STANDALONE_SERVER="$FRONTEND_DIR/.next/standalone/server.js"

  if [ -f "$STANDALONE_SERVER" ]; then
    info "Using standalone mode (output: standalone)"
    cp -r "$FRONTEND_DIR/public" "$FRONTEND_DIR/.next/standalone/public" 2>/dev/null || true
    mkdir -p "$FRONTEND_DIR/.next/standalone/.next/static"
    cp -r "$FRONTEND_DIR/.next/static/." "$FRONTEND_DIR/.next/standalone/.next/static/" 2>/dev/null || true
    PORT=3000 HOSTNAME=0.0.0.0 pm2 start "$STANDALONE_SERVER" \
      --name arzesh-frontend \
      --max-memory-restart 4G \
      --node-args="--max-old-space-size=4096" >/dev/null 2>&1
  else
    (cd "$FRONTEND_DIR" && PORT=3000 HOSTNAME=0.0.0.0 pm2 start npm \
      --name arzesh-frontend \
      --max-memory-restart 4G \
      --node-args="--max-old-space-size=4096" \
      -- start >/dev/null 2>&1)
  fi
  step_done

  pm2 save >/dev/null 2>&1 || true
fi

# ── Summary ────────────────────────────────────────────────────
TOTAL=$(( $(date +%s) - SCRIPT_START ))

echo ""
echo -e "${BOLD}${CYAN}+--------------------------------------------------+${NC}"
echo -e "${BOLD}${CYAN}|           Arzesh ERP — Update Summary            |${NC}"
echo -e "${BOLD}${CYAN}+-----------------------------+--------+------------+${NC}"
echo -e "${BOLD}${CYAN}| Step                        | Status | Time       |${NC}"
echo -e "${BOLD}${CYAN}+-----------------------------+--------+------------+${NC}"
for i in "${!STEP_LABELS[@]}"; do
  label="${STEP_LABELS[$i]}"
  status="${STEP_STATUS[$i]}"
  time="${STEP_TIMES[$i]}"
  if   [ "$status" = "ok"   ]; then icon="${GREEN}  OK  ${NC}"
  elif [ "$status" = "skip" ]; then icon="${YELLOW} SKIP ${NC}"
  else                               icon="${RED} FAIL ${NC}"
  fi
  printf "${BOLD}${CYAN}|${NC} %-27s ${BOLD}${CYAN}|${NC} %b ${BOLD}${CYAN}|${NC} %-10s ${BOLD}${CYAN}|${NC}\n" \
    "${label:0:27}" "$icon" "$time"
done
echo -e "${BOLD}${CYAN}+-----------------------------+--------+------------+${NC}"
echo -e "${BOLD}${CYAN}|${NC} Total elapsed: ${GREEN}${TOTAL}s${NC}$(printf '%*s' $((28 - ${#TOTAL})) '')${BOLD}${CYAN}               |${NC}"
echo -e "${BOLD}${CYAN}+--------------------------------------------------+${NC}"
echo ""

if command -v pm2 >/dev/null 2>&1; then
  echo -e "${BOLD}Process status:${NC}"
  pm2 list --no-color 2>/dev/null | grep -E '(arzesh|name|\-\-\-)' || pm2 list
fi
