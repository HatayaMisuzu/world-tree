#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required: https://nodejs.org" >&2
  exit 1
fi

WT_VERSION="$(node -p "require('./package.json').version")"
echo "Starting World Tree ${WT_VERSION} safely; an available port will be selected automatically."
exec node scripts/start-local.mjs
