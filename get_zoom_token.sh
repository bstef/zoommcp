#!/usr/bin/env bash
set -euo pipefail

# Load .env if it exists
if [ -f .env ]; then
  set -a
  source .env
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

# Check if existing token is still valid
if [ -n "${ZOOM_ACCESS_TOKEN:-}" ] && command -v python3 >/dev/null 2>&1; then
  echo "🔍 Checking existing token..."
  
  check_result=$(python3 - "$ZOOM_ACCESS_TOKEN" 2>/dev/null <<'PY'
import sys,base64,json,time
try:
    token = sys.argv[1]
    parts = token.split('.')
    if len(parts) < 2:
        print('INVALID')
        sys.exit(1)
    payload = parts[1]
    padding = '=' * (-len(payload) % 4)
    data = base64.urlsafe_b64decode(payload + padding)
    obj = json.loads(data)
    exp = obj.get('exp')
    if not exp:
        print('INVALID')
        sys.exit(1)
    now = int(time.time())
    remaining = exp - now
    remaining_min = remaining // 60
    if remaining > 60:  # Valid for more than 1 minute
        print(f'VALID:{remaining_min}')
        sys.exit(0)
    print('EXPIRED')
    sys.exit(1)
except:
    print('INVALID')
    sys.exit(1)
PY
)
  
  if [[ "$check_result" == VALID:* ]]; then
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
env_file=".env"
touch "$env_file"

# Use sed with | delimiter (macOS sed needs -i '') to safely replace if the key exists
if grep -q "^ZOOM_ACCESS_TOKEN=" "$env_file"; then
  # Prefer GNU sed syntax when available, fall back to BSD (macOS) sed
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^ZOOM_ACCESS_TOKEN=.*|ZOOM_ACCESS_TOKEN=\"$access_token\"|" "$env_file"
  else
    sed -i '' "s|^ZOOM_ACCESS_TOKEN=.*|ZOOM_ACCESS_TOKEN=\"$access_token\"|" "$env_file"
  fi
else
  printf "\nZOOM_ACCESS_TOKEN=\"%s\"\n" "$access_token" >> "$env_file"
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
