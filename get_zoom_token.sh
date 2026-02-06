#!/usr/bin/env bash
set -euo pipefail

# Load .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Required env vars: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
: "${ZOOM_CLIENT_ID:?set ZOOM_CLIENT_ID}"
: "${ZOOM_CLIENT_SECRET:?set ZOOM_CLIENT_SECRET}"
: "${ZOOM_ACCOUNT_ID:?set ZOOM_ACCOUNT_ID}"

resp=$(curl -s -X POST "https://zoom.us/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}" \
  -u "${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}")

# Prefer jq if available
if command -v jq >/dev/null 2>&1; then
  access_token=$(echo "$resp" | jq -r '.access_token // empty')
else
  # Fallback to python for JSON parsing (safer than fragile grep/sed)
  if command -v python3 >/dev/null 2>&1; then
    access_token=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
  else
    echo "Install jq or python3 to parse JSON" >&2
    echo "Raw response:" >&2
    echo "$resp" >&2
    exit 1
  fi
fi

if [ -z "$access_token" ]; then
  echo "Failed to obtain access_token. Response:" >&2
  echo "$resp" >&2
  exit 1
fi

# Save token into .env (create or replace ZOOM_ACCESS_TOKEN)
env_file=".env"
touch "$env_file"

# Use sed with | delimiter (macOS sed needs -i '') to safely replace if the key exists
if grep -q "^ZOOM_ACCESS_TOKEN=" "$env_file"; then
  sed -i '' "s|^ZOOM_ACCESS_TOKEN=.*|ZOOM_ACCESS_TOKEN=\"$access_token\"|" "$env_file"
else
  printf "\nZOOM_ACCESS_TOKEN=\"%s\"\n" "$access_token" >> "$env_file"
fi

echo "✓ Access token saved to $env_file"
echo $ZOOM_ACCESS_TOKEN
