#!/usr/bin/env bash

# log_event.sh
# Centralized logging utility for Zoom MCP Server
# Logs all events to logs/mcp.log with timestamps
# Usage: log_event "message" or source this file and use log_msg function

# Get project root (parent of scripts directory)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../" && pwd)"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/logs/mcp.log}"

# Ensure logs directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log_msg() {
  local message="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Write to log file
  printf "[%s] %s\n" "$timestamp" "$message" >> "$LOG_FILE"
  
  # Also print to stderr for terminal visibility
  echo "$message" >&2
}

# If called directly with arguments, log them
if [ $# -gt 0 ]; then
  log_msg "$@"
fi
