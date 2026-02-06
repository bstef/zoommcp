#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${CLAUDE_APP_NAME:-Claude}"

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
