#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${CLAUDE_APP_NAME:-Claude}"

# Refresh the Zoom access token before restarting Claude
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$script_dir/get_zoom_token.sh" ]; then
  "$script_dir/get_zoom_token.sh" >/dev/null 2>&1 || true
  # Update Claude config with the new token
  if [ -f "$script_dir/update_claude_config.sh" ]; then
    "$script_dir/update_claude_config.sh" >/dev/null 2>&1 || true
  fi
fi

# Try graceful quit first
osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true

# Give it a moment to exit
sleep 1

# If still running, force quit
if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
  pkill -x "${APP_NAME}" || true
  sleep 1
fi

# Relaunch
open -a "${APP_NAME}"

echo "✓ Restarted ${APP_NAME}"
