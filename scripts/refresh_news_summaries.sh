#!/bin/bash
set -euo pipefail

# Refresh MapleLand/Tespia news and local summary fallback before committing.
#
# Usage:
#   ./scripts/refresh_news_summaries.sh
#   ./scripts/refresh_news_summaries.sh --force-crawl
#   ./scripts/refresh_news_summaries.sh --force-summary

cd "$(dirname "$0")/.."
ROOT=$(pwd)

PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  if [ -x "$ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$ROOT/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    PYTHON_BIN="python"
  fi
fi

FORCE_CRAWL_ARG=""
FORCE_SUMMARY_ARG=""

for arg in "$@"; do
  case "$arg" in
    --force-crawl)
      FORCE_CRAWL_ARG="--force"
      ;;
    --force-summary)
      FORCE_SUMMARY_ARG="--force"
      ;;
    --force)
      FORCE_CRAWL_ARG="--force"
      FORCE_SUMMARY_ARG="--force"
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

for env_file in "$ROOT/.env" "$ROOT/.env.local" "$ROOT/web/.env.local"; do
  if [ -f "$env_file" ]; then
    echo "Loading env: $env_file"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

echo "=== Crawl MapleLand/Tespia news ==="
"$PYTHON_BIN" -m crawler crawl --type maple-land ${FORCE_CRAWL_ARG:+"$FORCE_CRAWL_ARG"}

echo "=== Generate local summary fallback ==="
"$PYTHON_BIN" scripts/generate_local_news_summaries.py ${FORCE_SUMMARY_ARG:+"$FORCE_SUMMARY_ARG"}

echo "=== News files changed ==="
git status --short data/maple.db data/local_news_summaries.json
