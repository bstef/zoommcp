#!/usr/bin/env bash
set -euo pipefail

# Single user entrypoint: keeps the banner/UX and delegates all logic to run-mcp.sh.

FORCE_REFRESH=0

display_banner() {
  cat <<'BANNER'
╔════════════════════════════════════════════════════════════════════╗
║                  🚀 ZOOM MCP SERVER 🚀                             ║
║             Connect Claude with Your Zoom Meetings                 ║
╚════════════════════════════════════════════════════════════════════╝
BANNER
}

usage() {
  cat <<USAGE
📋 USAGE:
  $0 [OPTIONS]

⚙️  OPTIONS:
  -f, --force    🔄 Force fetch a new token before starting MCP
  -h, --help     ❓ Show this help message

💡 EXAMPLES:
  $0              # Normal run - only refreshes token if expired
  $0 -f           # Force token refresh then start server
USAGE
  exit 0
}

display_startup_info() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  if [ "$FORCE_REFRESH" -eq 1 ]; then
    echo "🔧 Configuration: FORCE REFRESH enabled"
  else
    echo "🔧 Configuration: Smart token validation (only refresh if expired)"
  fi
  echo "════════════════════════════════════════════════════════════════════"
  echo ""
}

open_zoom() {
  echo "Opening Zoom meetings page..."
  open "https://us04web.zoom.us/meeting#/upcoming"
  echo ""
  echo "📝 If you're not already signed in:"
  echo "   -> Sign in with your Google email (benjaminstef.com)"
  echo "   -> If already authenticated, page will load your current meetings"
  echo ""
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--force)
      FORCE_REFRESH=1
      shift
      ;;
    -h|--help)
      display_banner
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

display_banner
display_startup_info
open_zoom

echo "🚀 Starting Zoom MCP Server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FORCE_REFRESH" -eq 1 ]; then
  exec bash ./run-mcp.sh -f
else
  exec bash ./run-mcp.sh
fi
