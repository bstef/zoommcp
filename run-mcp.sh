#!/usr/bin/env bash
set -euo pipefail

# All-in-one launcher: ensure Claude is running, refresh token only if expired,
# then start the MCP server.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_APP_NAME="${CLAUDE_APP_NAME:-Claude}"
FORCE_REFRESH=0
LOG_FILE="${LOG_FILE:-$DIR/logs/mcp.log}"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  local message="$*"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "$message" >&2
  printf "[%s] %s\n" "$timestamp" "$message" >> "$LOG_FILE"
}

usage() {
  cat >&2 <<USAGE
Usage: $0 [-f|--force]
  -f, --force    Force fetch a new token before starting MCP
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
      log "Unknown option: $1"
      usage
      ;;
  esac
done

load_env() {
  if [ -f "$DIR/.env" ]; then
    set -a
    source "$DIR/.env"
    set +a
  fi
}

load_token_from_claude_config() {
  local config_path="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
  local token=""

  if [ -f "$config_path" ] && command -v jq >/dev/null 2>&1; then
    token=$(jq -r '.mcpServers.zoom.env.ZOOM_ACCESS_TOKEN // empty' "$config_path" 2>/dev/null || true)
  fi

  if [ -n "$token" ] && [ "$token" != "null" ]; then
    export ZOOM_ACCESS_TOKEN="$token"
  fi
}

is_token_expired() {
  if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    # If we cannot validate, force renewal for safety.
    return 0
  fi

  python3 - "$ZOOM_ACCESS_TOKEN" <<'PY'
import base64
import json
import sys
import time

token = sys.argv[1]
try:
    parts = token.split('.')
    if len(parts) != 3:
        sys.exit(0)
    payload = parts[1]
    padding = '=' * (-len(payload) % 4)
    data = base64.urlsafe_b64decode(payload + padding)
    claims = json.loads(data)
    exp = int(claims.get('exp', 0))
    now = int(time.time())
    # Exit 0 => expired, Exit 1 => not expired
    sys.exit(0 if exp <= now else 1)
except Exception:
    sys.exit(0)
PY
}

ensure_claude_running() {
  if pgrep -x "$CLAUDE_APP_NAME" >/dev/null 2>&1; then
    log "✅ Claude Desktop is running"
    return
  fi

  log "⚠️  Claude Desktop is not running - opening it now..."
  if [ -x "$DIR/scripts/restart_claude_app.sh" ]; then
    bash "$DIR/scripts/restart_claude_app.sh" || true
  else
    open -a "$CLAUDE_APP_NAME" >/dev/null 2>&1 || true
  fi

  if pgrep -x "$CLAUDE_APP_NAME" >/dev/null 2>&1; then
    log "✅ Claude Desktop opened"
  else
    log "⚠️  Could not verify Claude Desktop startup"
  fi
}

maybe_refresh_expired_token() {
  load_env

  if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
    load_token_from_claude_config
  fi

  if [ "$FORCE_REFRESH" -eq 1 ]; then
    log "🔄 Force refresh enabled - fetching a new token..."
    bash "$DIR/scripts/get_zoom_token.sh" -f
    load_env
  elif is_token_expired; then
    log "🔄 Zoom token is expired (or missing). Fetching a new token..."
    bash "$DIR/scripts/get_zoom_token.sh" -f
    load_env
  else
    log "✅ Zoom token is still valid. No refresh needed."
  fi

  if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
    log "❌ ZOOM_ACCESS_TOKEN is still missing after refresh attempt."
    exit 1
  fi

  export ZOOM_ACCESS_TOKEN
}

display_token_status() {
  if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
    return
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    return
  fi

  python3 - "$ZOOM_ACCESS_TOKEN" <<'PY'
import sys,base64,json,time

token = sys.argv[1]
try:
    parts = token.split('.')
    if len(parts) < 2:
        sys.exit(0)
    payload = parts[1]
    padding = '=' * (-len(payload) % 4)
    data = base64.urlsafe_b64decode(payload + padding)
    obj = json.loads(data)
    exp = obj.get('exp')
    if not exp:
        sys.exit(0)
    now = int(time.time())
    remaining = exp - now
    remaining_min = remaining // 60
    remaining_sec = remaining % 60
    exp_time = time.strftime('%H:%M:%S', time.localtime(exp))
    if remaining <= 0:
        print(f'⏰ Token expired', file=sys.stderr)
        sys.exit(0)
    # Format remaining time nicely
    if remaining_min > 0:
        time_str = f'{remaining_min}m {remaining_sec}s'
    else:
        time_str = f'{remaining_sec}s'
    print(f'🔑 Token refreshed - Expires in {time_str} (at {exp_time})', file=sys.stderr)
    sys.exit(0)
except Exception as e:
    sys.exit(0)
PY
}

ensure_claude_running
maybe_refresh_expired_token
display_token_status

log "🚀 Starting Zoom MCP server..."
exec node "$DIR/index.js"
