#!/usr/bin/env bash
set -euo pipefail

# check_zoom_token.sh
# Exits 0 when token is valid for >60s, exits 1 when missing or expiring soon/expired.
# Usage: ./check_zoom_token.sh [threshold_seconds]

DEFAULT_THRESHOLD=60

usage() {
  cat <<USAGE
Usage: $0 [-t seconds] [-v]
  -t seconds    Threshold in seconds (overrides ZOOM_TOKEN_THRESHOLD env, default ${DEFAULT_THRESHOLD})
  -v            Verbose output
Environment:
  ZOOM_TOKEN_THRESHOLD   optional default threshold
  ZOOM_CHECK_VERBOSE     if set (non-empty), enables verbose mode
USAGE
  exit 2
}

THRESHOLD=""
VERBOSE=0
while getopts ":t:v" opt; do
  case "$opt" in
    t) THRESHOLD="$OPTARG" ;;
    v) VERBOSE=1 ;;
    ?) usage ;;
  esac
done
shift $((OPTIND-1))

load_env() {
  if [ -f ../.env ]; then
    set -a
    # shellcheck disable=SC1091
    source ../.env
    set +a
  fi
}

load_env

# Determine threshold: CLI > env > default
if [ -n "$THRESHOLD" ]; then
  : # use THRESHOLD
elif [ -n "${ZOOM_TOKEN_THRESHOLD:-}" ]; then
  THRESHOLD="$ZOOM_TOKEN_THRESHOLD"
else
  THRESHOLD="$DEFAULT_THRESHOLD"
fi

if [ -n "${ZOOM_CHECK_VERBOSE:-}" ] && [ "$VERBOSE" -eq 0 ]; then
  VERBOSE=1
fi

# Logging: when verbose mode is enabled, append messages to a logfile
LOG_FILE="${ZOOM_CHECK_LOGFILE:-./logs/zoom_token.log}"
if [ "$VERBOSE" -eq 1 ]; then
  mkdir -p "$(dirname "$LOG_FILE")"
fi

if [ -z "${ZOOM_ACCESS_TOKEN:-}" ]; then
  msg="❌ MISSING: ZOOM_ACCESS_TOKEN not found in .env file"
  [ "$VERBOSE" -eq 1 ] && echo "$msg" >&2
  [ "$VERBOSE" -eq 1 ] && printf "%s %s\n" "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" "$msg" >>"$LOG_FILE" || true
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  msg="❌ ERROR: python3 is required but not found - please install Python 3"
  [ "$VERBOSE" -eq 1 ] && echo "$msg" >&2
  [ "$VERBOSE" -eq 1 ] && printf "%s %s\n" "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" "$msg" >>"$LOG_FILE" || true
  exit 1
fi

if [ "$VERBOSE" -eq 1 ]; then
  threshold_min=$((THRESHOLD / 60))
  echo "🔍 Validating Zoom token (threshold: ${threshold_min}m)..."
fi

out=$(python3 - "$ZOOM_ACCESS_TOKEN" "$THRESHOLD" <<'PY'
import sys,base64,json,time

token = sys.argv[1]
threshold = int(sys.argv[2])
try:
    parts = token.split('.')
    if len(parts) < 2:
        print('❌ INVALID: Token format is not a valid JWT', file=sys.stderr)
        sys.exit(1)
    payload = parts[1]
    padding = '=' * (-len(payload) % 4)
    data = base64.urlsafe_b64decode(payload + padding)
    obj = json.loads(data)
    exp = obj.get('exp')
    if not exp:
        print('❌ INVALID: Token missing expiration claim', file=sys.stderr)
        sys.exit(1)
    now = int(time.time())
    remaining = exp - now
    remaining_min = remaining // 60
    threshold_min = threshold // 60
    exp_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(exp))
    if remaining <= 0:
        print(f'⏰ EXPIRED: Token expired at {exp_time}', file=sys.stderr)
        sys.exit(1)
    print(f'✅ VALID: Token expires at {exp_time} ({remaining_min}m remaining)')
    if remaining <= threshold:
      print(f'⚠️  WARNING: Token expires soon (within {threshold_min}m threshold)')
      sys.exit(1)
    sys.exit(0)
except Exception as e:
    print(f'❌ ERROR: Failed to parse token - {e}', file=sys.stderr)
    sys.exit(1)
PY
)
status=$?

# Echo python output
printf "%s\n" "$out"

if [ "$VERBOSE" -eq 1 ]; then
  printf "%s %s\n" "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" "$out" >>"$LOG_FILE" || true
fi

exit $status
PY
