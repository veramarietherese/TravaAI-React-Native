#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
if [ -f "$ROOT/src/components/ui/LoadingScreen.tsx" ]; then
  MOBILE="$ROOT"
elif [ -f "$ROOT/apps/mobile/src/components/ui/LoadingScreen.tsx" ]; then
  MOBILE="$ROOT/apps/mobile"
else
  echo "Could not locate mobile app." >&2
  exit 1
fi
BACKUP="$(cd "$(dirname "$0")" && pwd)"
cp "$BACKUP/src/components/ui/LoadingScreen.tsx" "$MOBILE/src/components/ui/LoadingScreen.tsx"
cp "$BACKUP/src/app/_layout.tsx" "$MOBILE/src/app/_layout.tsx"
if [ -f "$BACKUP/HAD_HTML" ]; then cp "$BACKUP/src/app/+html.tsx" "$MOBILE/src/app/+html.tsx"; else rm -f "$MOBILE/src/app/+html.tsx"; fi
if [ -f "$BACKUP/HAD_NATIVE_ASSETS" ]; then rm -rf "$MOBILE/assets/images/trava-loader"; cp -R "$BACKUP/assets/images/trava-loader" "$MOBILE/assets/images/"; else rm -rf "$MOBILE/assets/images/trava-loader"; fi
if [ -f "$BACKUP/HAD_PUBLIC_ASSETS" ]; then rm -rf "$MOBILE/public/trava-loader"; cp -R "$BACKUP/public/trava-loader" "$MOBILE/public/"; else rm -rf "$MOBILE/public/trava-loader"; fi
echo "Rolled back TRAVA actual loading screen patch."
