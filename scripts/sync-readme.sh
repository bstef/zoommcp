#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/sync-readme.sh [branch-name] [--check]

Sync README.md from docs/readmes/<branch>.md.

Examples:
  ./scripts/sync-readme.sh
  ./scripts/sync-readme.sh openai
  ./scripts/sync-readme.sh feature/macos-app
  ./scripts/sync-readme.sh --check
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

CHECK_ONLY=false
BRANCH_ARG=""

for arg in "$@"; do
  if [[ "$arg" == "--check" ]]; then
    CHECK_ONLY=true
  elif [[ -z "$BRANCH_ARG" ]]; then
    BRANCH_ARG="$arg"
  else
    echo "Unexpected argument: $arg" >&2
    usage
    exit 1
  fi
done

branch="${BRANCH_ARG:-$(git branch --show-current)}"
if [[ -z "$branch" ]]; then
  echo "Unable to determine branch name. Pass it explicitly." >&2
  exit 1
fi

template_name="${branch//\//-}.md"
template_path="docs/readmes/${template_name}"

if [[ ! -f "$template_path" ]]; then
  echo "No README template found for branch '$branch' at $template_path" >&2
  echo "Available templates:" >&2
  ls -1 docs/readmes/*.md 2>/dev/null | sed 's#^#  - #' >&2 || true
  exit 1
fi

if $CHECK_ONLY; then
  if cmp -s "$template_path" README.md; then
    echo "README.md is in sync with $template_path"
    exit 0
  fi
  echo "README.md differs from $template_path"
  exit 2
fi

cp "$template_path" README.md
echo "Synced README.md from $template_path"
