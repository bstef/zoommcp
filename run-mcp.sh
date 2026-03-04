#!/usr/bin/env bash
# Wrapper script to set environment variables and run the MCP server

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load environment variables from .env file if it exists
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

# Export the token if provided as argument
if [ -n "${ZOOM_ACCESS_TOKEN:-}" ]; then
  export ZOOM_ACCESS_TOKEN
fi

# If ZOOM_ACCESS_TOKEN is not set yet, try to get it from Claude config
if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
  TOKEN=$(cat "$HOME/Library/Application Support/Claude/claude_desktop_config.json" 2>/dev/null | \
          jq -r '.mcpServers.zoom.env.ZOOM_ACCESS_TOKEN // empty' 2>/dev/null)
  
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    export ZOOM_ACCESS_TOKEN="$TOKEN"
  fi
fi

# Run the MCP server
exec node "$DIR/index.js"
