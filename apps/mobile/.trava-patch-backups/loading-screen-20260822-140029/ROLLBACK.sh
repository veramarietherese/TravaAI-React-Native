#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
if [ -f "$ROOT/src/features/home/screens/HomeScreen.tsx" ]; then
  DEST_BASE="$ROOT"
elif [ -f "$ROOT/apps/mobile/src/features/home/screens/HomeScreen.tsx" ]; then
  DEST_BASE="$ROOT/apps/mobile"
else
  echo "Could not find HomeScreen.tsx from target: $ROOT" >&2
  exit 1
fi
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$BACKUP_DIR/src/features/home/screens/HomeScreen.tsx" "$DEST_BASE/src/features/home/screens/HomeScreen.tsx"
echo "Rolled back loading screen patch."
