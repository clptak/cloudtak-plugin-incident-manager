#!/usr/bin/env bash
# Simulate CloudTAK Docker web build gate for this plugin:
#   npm run lint && npm run check && npm run build  (from api/web, no plugin node_modules)
set -euo pipefail

WEB="${1:-$HOME/CloudTAK/api/web}"
PLUGIN_SLUG="${PLUGIN_SLUG:-incident-manager}"
PLUGIN_DIR="plugins/${PLUGIN_SLUG}"
PLUGIN_NM="$WEB/$PLUGIN_DIR/node_modules"
BACKUP=""

if [[ -d "$PLUGIN_NM" ]]; then
  BACKUP="$(mktemp -d)"
  mv "$PLUGIN_NM" "$BACKUP/node_modules"
fi

cleanup() {
  if [[ -n "$BACKUP" && -d "$BACKUP/node_modules" ]]; then
    mkdir -p "$(dirname "$PLUGIN_NM")"
    mv "$BACKUP/node_modules" "$PLUGIN_NM"
    rmdir "$BACKUP" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$WEB"

echo "==> eslint $PLUGIN_DIR"
npx eslint --config eslint.config.js "./$PLUGIN_DIR/"

echo "==> vue-tsc (host check; fail only on $PLUGIN_DIR errors)"
set +e
npm run check 2>&1 | tee /tmp/cloudtak-check.log
set -e
if grep -q "${PLUGIN_DIR}/" /tmp/cloudtak-check.log; then
  echo >&2
  echo "${PLUGIN_SLUG} vue-tsc errors — fix types or ensure deps come from api/web package.json:" >&2
  grep "${PLUGIN_DIR}/" /tmp/cloudtak-check.log >&2
  exit 1
fi

echo "==> vite build"
npm run build

echo "check passed (eslint + no ${PLUGIN_DIR}/ vue-tsc errors + build)"
