#!/usr/bin/env bash
set -euo pipefail

# Parse command line arguments
FORCE_REFRESH=0

usage() {
  cat <<USAGE
Usage: $0 [-f|--force] [-h|--help]
  -f, --force    Force fetch a new token even if current one is valid
  -h, --help     Show this help message

Examples:
  $0              # Normal run - only refreshes if token expired
  $0 -f           # Force new token then start server
USAGE
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--force)
      FORCE_REFRESH=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

load_env() {
  if [ -f .env ]; then
    set -a
    source .env
    set +a
  fi
}

load_env

restart_or_open_claude() {
  echo "Ensuring Claude Desktop is running (restart if open, launch if closed)..."
  if ./scripts/restart_claude_app.sh; then
    echo "✓ Claude Desktop operation completed"
  else
    echo "⚠️  Claude Desktop operation had issues (see above)"
    echo "   Continuing anyway - you may need to start Claude manually"
  fi
}

ensure_claude_open_if_needed() {
  local app_name="${CLAUDE_APP_NAME:-Claude}"
  if pgrep -x "${app_name}" >/dev/null 2>&1; then
    echo "✓ ${app_name} is already running"
  else
    echo "⚠️  ${app_name} is not running. Attempting to open..."
    if ./scripts/restart_claude_app.sh; then
      echo "✓ Launch completed"
    else
      echo "⚠️  Could not launch ${app_name}"
      echo "   Please start Claude Desktop manually"
    fi
  fi
}

# Check if token is missing/expired (JWT exp)
token_expired() {
  if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found; treating token as expired." >&2
    return 0
  fi

  python3 - "$ZOOM_ACCESS_TOKEN" <<'PY'
import base64, json, sys, time

token = sys.argv[1]
try:
    parts = token.split(".")
    if len(parts) < 2:
        sys.exit(0)
    payload = parts[1]
    padding = "=" * (-len(payload) % 4)
    data = base64.urlsafe_b64decode(payload + padding)
    exp = json.loads(data).get("exp")
    if not exp:
        sys.exit(0)
    now = int(time.time())
    # refresh if expiring within 60s
    sys.exit(0 if exp <= now + 60 else 1)
except Exception:
    sys.exit(0)
PY
}

# 1) Refresh token + update config + restart Claude only if needed
# Prefer the centralized check script when available

if [ "$FORCE_REFRESH" -eq 1 ]; then
  echo "🔄 Force refresh requested - fetching new token..."
  if ./scripts/get_zoom_token.sh -f; then
    load_env
    ./scripts/update_claude_config.sh
    restart_or_open_claude
  else
    echo "❌ Failed to get new token. Continuing anyway..."
  fi
elif [ -x ./scripts/check_zoom_token.sh ]; then
  # Determine threshold and verbose flags from env
  threshold_arg=""
  verbose_arg=""
  if [ -n "${ZOOM_TOKEN_THRESHOLD:-}" ]; then
    threshold_arg="-t $ZOOM_TOKEN_THRESHOLD"
  fi
  if [ -n "${ZOOM_CHECK_VERBOSE:-}" ]; then
    verbose_arg="-v"
  fi
  if ! ./scripts/check_zoom_token.sh $threshold_arg $verbose_arg; then
    echo "⚠️  Token needs refresh. Fetching new token..."
    if ./scripts/get_zoom_token.sh; then
      load_env
      ./scripts/update_claude_config.sh
      restart_or_open_claude
    else
      echo "❌ Failed to get new token. Continuing with existing token (may cause API errors)..."
    fi
  fi
else
  if token_expired; then
    echo "⚠️  Token needs refresh. Fetching new token..."
    if ./scripts/get_zoom_token.sh; then
      load_env
      ./scripts/update_claude_config.sh
      restart_or_open_claude
    else
      echo "❌ Failed to get new token. Continuing with existing token (may cause API errors)..."
    fi
  fi
fi

# Ensure Claude is open even when no token refresh/restart was needed
ensure_claude_open_if_needed

# 2) Open Zoom in browser
open_zoom() {
  echo "Opening Zoom meetings page..."
  open "https://us04web.zoom.us/meeting#/upcoming"
  echo ""
  echo "📝 If you're not already signed in:"
  echo "   → Sign in with your Google email (benjaminstef.com)"
  echo "   → If already authenticated, page will load your current meetings"
}

# 3) Open Zoom in browser
open_zoom

# 4) Start MCP server (foreground)
echo ""
echo "🚀 Starting Zoom MCP Server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Note: If Claude Desktop didn't start automatically:"
echo "   1. Open Claude Desktop manually"
echo "   2. The MCP server will connect automatically"
echo ""
node index.js
