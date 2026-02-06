#!/usr/bin/env bash
set -euo pipefail

load_env() {
  if [ -f .env ]; then
    set -a
    source .env
    set +a
  fi
}

load_env

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
if token_expired; then
  ./get_zoom_token.sh
  load_env
  ./update_claude_config.sh
  ./restart_claude_app.sh
fi

# 2) Start MCP server (foreground)
node index.js
