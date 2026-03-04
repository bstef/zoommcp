#!/usr/bin/env bash
set -euo pipefail

# Parse command line arguments
FORCE_REFRESH=0

usage() {
  cat <<USAGE
Usage: $0 [-f|--force] [-h|--help]
  -f, --force    Force fetch a new token even if current one is valid
  -h, --help     Show this help message
USAGE
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--force)
      FORCE_REFRESH=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

# Load .env if it exists
if [ -f ../.env ]; then
  set -a
  source ../.env
  set +a
fi

# Required env vars: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
: "${ZOOM_CLIENT_ID:?❌ ERROR: ZOOM_CLIENT_ID not set in .env}"
: "${ZOOM_CLIENT_SECRET:?❌ ERROR: ZOOM_CLIENT_SECRET not set in .env}"
: "${ZOOM_ACCOUNT_ID:?❌ ERROR: ZOOM_ACCOUNT_ID not set in .env}"

# Display current token if it exists
if [ -n "${ZOOM_ACCESS_TOKEN:-}" ]; then
  echo "📋 Current Token:"
  echo "$ZOOM_ACCESS_TOKEN"
  echo ""
  echo "Token Length: ${#ZOOM_ACCESS_TOKEN} characters"
  echo ""
fi

# Check if existing token is still valid (skip if force refresh)
if [ "$FORCE_REFRESH" -eq 1 ]; then
  echo "🔄 Force refresh enabled - skipping token validation"
  echo ""
elif [ -n "${ZOOM_ACCESS_TOKEN:-}" ] && command -v python3 >/dev/null 2>&1; then
  echo "🔍 Checking existing token..."
  
  # Use temp variable to ensure we capture only the first output line
  check_output=$(python3 << 'PYTHON_END'
import sys, base64, json, time
token = """ZOOM_TOKEN_PLACEHOLDER"""
try:
    parts = token.split('.')
    if len(parts) != 3:
        print('INVALID')
    else:
        payload = parts[1]
        padding = '=' * (4 - len(payload) % 4)
        data = base64.urlsafe_b64decode(payload + padding)
        obj = json.loads(data)
        exp = obj.get('exp', 0)
        now = int(time.time())
        remaining = exp - now
        if remaining > 60:
            remaining_min = remaining // 60
            print(f'VALID:{remaining_min}')
        else:
            print('EXPIRED')
except Exception as e:
    print('INVALID')
PYTHON_END
)
  
  # Replace placeholder with actual token in Python
  check_result=$(echo "$check_output" | python3 -c "
import sys, base64, json, time
token = '$ZOOM_ACCESS_TOKEN'
try:
    parts = token.split('.')
    if len(parts) == 3:
        payload = parts[1]
        padding = '=' * (4 - len(payload) % 4)
        data = base64.urlsafe_b64decode(payload + padding)
        obj = json.loads(data)
        exp = obj.get('exp', 0)
        now = int(time.time())
        remaining = exp - now
        if remaining > 60:
            remaining_min = remaining // 60
            print(f'VALID:{remaining_min}')
        else:
            print('EXPIRED')
    else:
        print('INVALID')
except:
    print('INVALID')
" 2>/dev/null || echo 'EXPIRED')
  
  if [[ "$check_result" =~ ^VALID: ]]; then
    minutes="${check_result#VALID:}"
    echo "✅ Existing token is still valid (${minutes}m remaining)"
    echo ""
    echo "✅ No need to fetch a new token!"
    exit 0
  else
    echo "⚠️  Existing token is expired or invalid"
    echo ""
  fi
fi

echo "🔄 Requesting new access token from Zoom API..."

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
    echo "❌ ERROR: Install jq or python3 to parse JSON" >&2
    echo "📄 Raw response:" >&2
    echo "$resp" >&2
    exit 1
  fi
fi

if [ -z "$access_token" ]; then
  echo "❌ ERROR: Failed to obtain access token" >&2
  echo "📄 API Response:" >&2
  echo "$resp" >&2
  exit 1
fi

echo "✅ Token received successfully"

# Save token into .env (create or replace ZOOM_ACCESS_TOKEN)
env_file="../.env"
mkdir -p "$(dirname "$env_file")"

# Use atomic write to handle iCloud files safely: write to temp, then move
temp_env="${env_file}.tmp.$$"

if [ -f "$env_file" ]; then
  # Copy existing file, then update the token line using Python for safe handling
  cp "$env_file" "$temp_env"
  python3 /dev/stdin "$temp_env" "$access_token" << 'PYTHON_END'
import sys, os

env_file = sys.argv[1]
new_token = sys.argv[2]

# Read existing file
with open(env_file, 'r') as f:
    lines = f.readlines()

# Find and replace ZOOM_ACCESS_TOKEN line, or add it
found = False
output = []
for line in lines:
    if line.startswith('ZOOM_ACCESS_TOKEN='):
        output.append(f'ZOOM_ACCESS_TOKEN="{new_token}"\n')
        found = True
    else:
        output.append(line)

if not found:
    if output and not output[-1].endswith('\n'):
        output.append('\n')
    output.append(f'ZOOM_ACCESS_TOKEN="{new_token}"\n')

# Write back safely
with open(env_file, 'w') as f:
    f.writelines(output)
PYTHON_END
else
  # Create new file with token
  printf "ZOOM_ACCESS_TOKEN=\"%s\"\n" "$access_token" > "$temp_env"
fi

# Atomic move: replace original file with updated temp file
if [ -f "$temp_env" ]; then
  mv "$temp_env" "$env_file" || {
    echo "❌ ERROR: Failed to write token to $env_file" >&2
    rm -f "$temp_env"
    exit 1
  }
else
  echo "❌ ERROR: Failed to prepare token file" >&2
  exit 1
fi

# Export the token into the current process environment for immediate use
export ZOOM_ACCESS_TOKEN="$access_token"

echo "💾 Token saved to $env_file"
echo ""
echo "📋 New Token:"
echo "$access_token"
echo ""
echo "Token Length: ${#access_token} characters"
echo ""
echo "✅ All set! Token is ready to use."

exit 0
