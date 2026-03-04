#!/usr/bin/env bash
set -euo pipefail

# Load .env if it exists
if [ -f ../.env ]; then
  set -a
  source ../.env
  set +a
fi

: "${ZOOM_ACCESS_TOKEN:?set ZOOM_ACCESS_TOKEN (e.g., in .env)}"

# Default Claude config path (handle spaces safely via a separate variable)
default_config="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
config_file="${CLAUDE_CONFIG_FILE:-$default_config}"
server_name="${CLAUDE_MCP_SERVER_NAME:-zoom}"
env_key="${CLAUDE_ZOOM_ENV_KEY:-ZOOM_ACCESS_TOKEN}"

if [ ! -f "$config_file" ]; then
  echo "Claude config not found at: $config_file" >&2
  exit 1
fi

# Update the config file
python3 - "$config_file" "$server_name" "$env_key" "$ZOOM_ACCESS_TOKEN" <<'PY'
import json, sys

path, server_name, env_key, token = sys.argv[1:5]

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

mcp = data.setdefault("mcpServers", {})
server = mcp.setdefault(server_name, {})
env = server.setdefault("env", {})
env[env_key] = token

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

echo "✓ Updated $config_file with $env_key for MCP server '$server_name'"

# Force Claude Desktop to reload the config by restarting it
# This ensures the new token is picked up immediately when Claude loads the MCP server
if pgrep -x "Claude" >/dev/null 2>&1; then
  echo "🔄 Restarting Claude Desktop to load new configuration..."
  
  # Graceful quit first
  osascript -e 'tell application "Claude" to quit' >/dev/null 2>&1 || true
  sleep 1
  
  # If still running, force quit
  if pgrep -x "Claude" >/dev/null 2>&1; then
    pkill -9 -x "Claude" || true
    sleep 1
  fi
  
  # Relaunch Claude
  open -a Claude >/dev/null 2>&1 || true
  echo "✓ Claude Desktop restarted with new config"
fi

