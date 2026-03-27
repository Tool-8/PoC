#!/bin/sh
set -eu

cd /var/www/html

if [ ! -f package-lock.json ]; then
  npm install
fi

CURRENT_NPM_HASH="$(sha1sum package-lock.json | awk '{print $1}')"
SAVED_NPM_HASH="$(cat node_modules/.package-lock.hash 2>/dev/null || true)"

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ] || [ "$CURRENT_NPM_HASH" != "$SAVED_NPM_HASH" ]; then
  npm ci
  echo "$CURRENT_NPM_HASH" > node_modules/.package-lock.hash
fi

exec npm run dev -- --host 0.0.0.0