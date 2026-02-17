#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${CLAUDE_APP_NAME:-Claude}"

# Refresh the Zoom access token before restarting Claude.
# Use the lightweight check script to avoid unnecessary network calls.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -x "$script_dir/check_zoom_token.sh" ]; then
  threshold_arg=""
  verbose_arg=""
  if [ -n "${ZOOM_TOKEN_THRESHOLD:-}" ]; then
    threshold_arg="-t $ZOOM_TOKEN_THRESHOLD"
  fi
  if [ -n "${ZOOM_CHECK_VERBOSE:-}" ]; then
    verbose_arg="-v"
  fi
  if ! "$script_dir/check_zoom_token.sh" $threshold_arg $verbose_arg >/dev/null 2>&1; then
    "$script_dir/get_zoom_token.sh" >/dev/null 2>&1 || true
    if [ -f "$script_dir/update_claude_config.sh" ]; then
      "$script_dir/update_claude_config.sh" >/dev/null 2>&1 || true
    fi
  fi
else
  # If no checker is present, refresh unconditionally to be safe
  if [ -f "$script_dir/get_zoom_token.sh" ]; then
    "$script_dir/get_zoom_token.sh" >/dev/null 2>&1 || true
  fi
  if [ -f "$script_dir/update_claude_config.sh" ]; then
    "$script_dir/update_claude_config.sh" >/dev/null 2>&1 || true
  fi
fi

# Try graceful quit first (suppress errors and continue)
osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || {
  echo "Note: Claude app not running or could not quit via AppleScript" >&2
}

# Give it a moment to exit
sleep 2

# If still running, force quit
if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
  echo "Force quitting ${APP_NAME}..." >&2
  pkill -x "${APP_NAME}" || true
  sleep 2
fi

# Verify the app exists before launching
if [ ! -d "/Applications/${APP_NAME}.app" ]; then
  echo "Error: ${APP_NAME} application not found at /Applications/${APP_NAME}.app" >&2
  exit 1
fi

# Relaunch the app
open -a "${APP_NAME}" 2>/dev/null || {
  echo "Error: Could not launch ${APP_NAME}" >&2
  exit 1
}

# Wait for app to start
sleep 2

# Verify it started
if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
  echo "✓ Successfully restarted ${APP_NAME}"
else
  echo "Warning: ${APP_NAME} may not have started properly" >&2
  exit 1
fi
