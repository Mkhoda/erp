#!/bin/bash

set -euo pipefail

# Refuse to run as root — running as root creates a root PM2 daemon that
# hijacks ports 3000/3001 and conflicts with the app-user PM2 instance.
if [ "$(id -u)" -eq 0 ]; then
    echo "❌ Do not run this script as root or with sudo."
    echo "   Run as the application user (e.g. mahdi): bash update.sh"
    exit 1
fi

# Usage: ./update.sh [--docker] [--no-install] [--no-build]

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

# ── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()   { echo -e "${BLUE}▸ $1${NC}"; }
success(){ echo -e "${GREEN}✓ $1${NC}"; }
warn()   { echo -e "${YELLOW}⚠ $1${NC}"; }
error()  { echo -e "${RED}✗ $1${NC}"; }
header() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }

# ── Step tracking ──────────────────────────────────────────────
STEP_LABELS=()
STEP_STATUS=()
STEP_TIMES=()

step_start() {
  _STEP_NAME="$1"
  _STEP_START=$(date +%s)
  info "$1..."
}
step_done() {
  local elapsed=$(( $(date +%s) - _STEP_START ))
  STEP_LABELS+=("$_STEP_NAME")
  STEP_STATUS+=("ok")
  STEP_TIMES+=("${elapsed}s")
  success "$_STEP_NAME (${elapsed}s)"
}
step_skip() {
  STEP_LABELS+=("$_STEP_NAME (skip)")
  STEP_STATUS+=("skip")
  STEP_TIMES+=("-")
}
step_fail() {
  local elapsed=$(( $(date +%s) - _STEP_START ))
  STEP_LABELS+=("$_STEP_NAME")
  STEP_STATUS+=("fail")
  STEP_TIMES+=("${elapsed}s")
  error "$_STEP_NAME ناموفق بود"
}

SCRIPT_START=$(date +%s)

# ── Flags ──────────────────────────────────────────────────────
USE_DOCKER=0; DO_INSTALL=1; DO_BUILD=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --docker)     USE_DOCKER=1; shift ;;
    --no-install) DO_INSTALL=0; shift ;;
    --no-build)   DO_BUILD=0; shift ;;
    -h|--help)    echo "Usage: ./update.sh [--docker] [--no-install] [--no-build]"; exit 0 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── 1. Git pull ────────────────────────────────────────────────
header "Git"
step_start "دریافت آخرین تغییرات"

git fetch --all --prune
BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_BEFORE=$(git rev-parse HEAD)

STASHED=0
if [ -n "$(git status --porcelain)" ]; then
  warn "تغییرات محلی موجود — stash می‌شوند"
  git add -A
  git stash push -u -m "auto-update-$(date +%s)" || true
  STASHED=1
fi

if git pull --rebase origin "$BRANCH"; then
  GIT_AFTER=$(git rev-parse HEAD)
  step_done
else
  step_fail
  [ "$STASHED" -eq 1 ] && { warn "بازگردانی stash..."; git stash pop || true; }
  exit 1
fi

[ "$STASHED" -eq 1 ] && { info "بازگردانی تغییرات stash..."; git stash pop && success "Stash بازگردانده شد" || warn "Stash نیاز به resolve دستی دارد"; }

# Show what changed
if [ "$GIT_BEFORE" != "$GIT_AFTER" ]; then
  COMMIT_COUNT=$(git rev-list --count "$GIT_BEFORE".."$GIT_AFTER" 2>/dev/null || echo "?")
  echo -e "  ${CYAN}$COMMIT_COUNT commit(s) جدید روی branch $BRANCH${NC}"
  git log --oneline "$GIT_BEFORE".."$GIT_AFTER" | sed 's/^/  /'
  echo ""
  CHANGED_FILES=$(git diff --name-only "$GIT_BEFORE" "$GIT_AFTER" 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  ${CYAN}$CHANGED_FILES فایل تغییر کرده${NC}"
else
  echo -e "  ${YELLOW}هیچ تغییری از git نبود — ادامه با build محلی${NC}"
fi

# ── Docker shortcut ────────────────────────────────────────────
if [ "$USE_DOCKER" -eq 1 ]; then
  header "Docker"
  step_start "به‌روزرسانی Docker"
  docker-compose -f docker-compose.prod.yml pull --quiet
  docker-compose -f docker-compose.prod.yml up -d --remove-orphans
  step_done
  echo -e "\n${GREEN}${BOLD}✓ آپدیت Docker کامل شد${NC}"
  exit 0
fi

# ── 2. Install ─────────────────────────────────────────────────
if [ "$DO_INSTALL" -eq 1 ]; then
  header "Dependencies"
  step_start "نصب پکیج‌ها"
  npm install --no-audit --legacy-peer-deps 2>&1 | tail -3 || {
    step_fail
    error "npm install ناموفق بود. دستور زیر را اجرا کنید: npm install --legacy-peer-deps"
    exit 1
  }
  step_done
else
  _STEP_NAME="نصب پکیج‌ها"; step_skip
fi

# ── 3. Build ───────────────────────────────────────────────────
if [ "$DO_BUILD" -eq 1 ]; then
  header "Build"

  step_start "Backend build"
  npm --prefix apps/backend run build 2>&1 | grep -E '(error TS|Error|✓|warning)' | head -20 || true
  step_done

  step_start "Prisma migrate"
  (cd apps/backend && npx prisma migrate deploy 2>&1 | grep -E '(Applying|already applied|error|Error|No pending)' | head -10 || true) \
    && step_done || { step_fail; warn "Migration ناموفق — بررسی کنید"; }

  step_start "Frontend build"
  npm --prefix apps/frontend run build 2>&1 | grep -E '(error|Error|Route|✓|warn|⚠)' | grep -v "^$" | head -30 || true
  step_done
else
  _STEP_NAME="Backend build"; step_skip
  _STEP_NAME="Prisma migrate"; step_skip
  _STEP_NAME="Frontend build"; step_skip
fi

# ── 4. PM2 restart ─────────────────────────────────────────────
header "PM2"

if ! command -v pm2 >/dev/null 2>&1; then
  warn "pm2 یافت نشد — سرویس‌ها را دستی ریستارت کنید"
else
  step_start "آزادسازی پورت‌ها"
  fuser -k 3001/tcp 2>/dev/null || true
  sudo lsof -ti :3001 2>/dev/null | xargs -r sudo kill -9 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  sudo lsof -ti :3000 2>/dev/null | xargs -r sudo kill -9 2>/dev/null || true
  sleep 1
  step_done

  step_start "راه‌اندازی Backend"
  pm2 delete arzesh-backend >/dev/null 2>&1 || true
  pm2 start apps/backend/dist/main.js \
    --name arzesh-backend \
    --max-memory-restart 4G \
    --node-args="--max-old-space-size=4096" >/dev/null 2>&1
  step_done

  step_start "راه‌اندازی Frontend"
  pm2 delete arzesh-frontend >/dev/null 2>&1 || true
  FRONTEND_DIR="apps/frontend"
  STANDALONE_SERVER="$FRONTEND_DIR/.next/standalone/server.js"

  if [ -f "$STANDALONE_SERVER" ]; then
    info "Standalone mode (output: standalone)..."
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
TOTAL_TIME=$(( $(date +%s) - SCRIPT_START ))

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║           خلاصه اجرای update.sh                ║${NC}"
echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════╣${NC}"
for i in "${!STEP_LABELS[@]}"; do
  label="${STEP_LABELS[$i]}"
  status="${STEP_STATUS[$i]}"
  time="${STEP_TIMES[$i]}"
  if [ "$status" = "ok" ]; then
    icon="${GREEN}✓${NC}"
  elif [ "$status" = "skip" ]; then
    icon="${YELLOW}−${NC}"
  else
    icon="${RED}✗${NC}"
  fi
  printf "${BOLD}${CYAN}║${NC}  %b  %-32s %6s  ${BOLD}${CYAN}║${NC}\n" "$icon" "$label" "$time"
done
echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${CYAN}║${NC}  ${GREEN}زمان کل: ${TOTAL_TIME}s${NC}$(printf '%*s' $((31 - ${#TOTAL_TIME})) '')${BOLD}${CYAN}       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if command -v pm2 >/dev/null 2>&1; then
  echo -e "${BOLD}وضعیت سرویس‌ها:${NC}"
  pm2 list --no-color 2>/dev/null | grep -E '(arzesh|name|─)' || pm2 list
fi
