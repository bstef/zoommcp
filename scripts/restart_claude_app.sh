#!/usr/bin/env bash
# Relaxed error handling - don't stop on non-critical errors
set -uo pipefail

APP_NAME="${CLAUDE_APP_NAME:-Claude}"
app_was_running=false

echo "🔍 Checking Claude Desktop status..."
echo "   Looking for app: ${APP_NAME}"

# Check if app exists in common locations
if [ -d "/Applications/${APP_NAME}.app" ]; then
  echo "   ✓ Found at: /Applications/${APP_NAME}.app"
elif [ -d "$HOME/Applications/${APP_NAME}.app" ]; then
  echo "   ✓ Found at: $HOME/Applications/${APP_NAME}.app"
else
  echo "   ⚠️  ${APP_NAME}.app not found in standard locations"
  echo "   Available apps in /Applications:"
  ls -1 /Applications | grep -i claude || echo "     (no Claude apps found)"
fi

if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
  app_was_running=true
  echo "✓ ${APP_NAME} is currently running (PID: $(pgrep -x "${APP_NAME}"))"
else
  echo "ℹ️  ${APP_NAME} is not running"
fi

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

if [ "$app_was_running" = true ]; then
  echo "🔄 Restarting ${APP_NAME}..."
  # Try graceful quit first (suppress errors and continue)
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || {
    echo "⚠️  Could not quit via AppleScript, trying force quit..." >&2
  }

  # Give it a moment to exit
  sleep 2

  # If still running, force quit
  if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
    echo "🔨 Force quitting ${APP_NAME}..." >&2
    pkill -x "${APP_NAME}" || true
    sleep 2
  fi
else
  echo "🚀 ${APP_NAME} is not running. Launching it now..."
fi

# Verify the app exists before launching
app_path="/Applications/${APP_NAME}.app"
if [ ! -d "$app_path" ]; then
  echo "⚠️  Warning: ${APP_NAME}.app not found at $app_path" >&2
  echo "   Attempting to launch anyway..." >&2
fi

# Relaunch the app
echo "📱 Launching ${APP_NAME}..."
if open -a "${APP_NAME}" 2>/dev/null; then
  echo "✓ Launch command succeeded"
else
  echo "⚠️  Launch command failed, but continuing..." >&2
fi

# Wait for app to start with multiple checks
echo "⏳ Waiting for ${APP_NAME} to start..."
max_attempts=15
attempt=0

while [ $attempt -lt $max_attempts ]; do
  sleep 1
  attempt=$((attempt + 1))
  
  # Check multiple ways: exact process name, fuzzy match, or window title
  if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
    echo "✅ Successfully started ${APP_NAME} (found process)"
    exit 0
  fi
  
  # Also check for Claude process even if exact name doesn't match
  if pgrep -i "claude" >/dev/null 2>&1; then
    echo "✅ Successfully started ${APP_NAME} (found Claude process)"
    exit 0
  fi
  
  # Check if the app window is open by looking for the app bundle
  if lsof -c "${APP_NAME}" >/dev/null 2>&1; then
    echo "✅ Successfully started ${APP_NAME} (app is active)"
    exit 0
  fi
done

echo "⚠️  ${APP_NAME} may not have started properly after 15 seconds" >&2
echo "   Please check if the app is running manually" >&2
echo "   Continuing with script execution..." >&2
exit 0  # Changed to exit 0 so we don't stop the whole pipeline
