#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ -f "$ROOT/package.json" ]] && grep -q '"@trava/mobile"' "$ROOT/package.json"; then
  MOBILE="$ROOT"
elif [[ -f "$ROOT/apps/mobile/package.json" ]]; then
  MOBILE="$ROOT/apps/mobile"
else
  echo "ERROR: Could not locate mobile workspace." >&2
  exit 1
fi

if [[ "$(cat "$HERE/+html.state")" == "existing" ]]; then
  cp "$HERE/src/app/+html.tsx" "$MOBILE/src/app/+html.tsx"
else
  rm -f "$MOBILE/src/app/+html.tsx"
fi

rm -rf "$MOBILE/public/trava-loader"
if [[ "$(cat "$HERE/assets.state")" == "existing" ]]; then
  mkdir -p "$MOBILE/public"
  cp -R "$HERE/public/trava-loader" "$MOBILE/public/trava-loader"
fi

echo "TRAVA global loading screen rolled back."
