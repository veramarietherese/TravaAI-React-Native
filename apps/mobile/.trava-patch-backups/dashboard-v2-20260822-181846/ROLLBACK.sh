#!/usr/bin/env bash
set -euo pipefail
MOBILE="${1:-$PWD}"
BACKUP="$(cd "$(dirname "$0")" && pwd)"
cp "$BACKUP/src/features/trips/screens/TripsScreen.tsx" "$MOBILE/src/features/trips/screens/TripsScreen.tsx"
cp "$BACKUP/src/features/trips/components/TravaUI.tsx" "$MOBILE/src/features/trips/components/TravaUI.tsx"
rm -rf "$MOBILE/.expo" "$MOBILE/node_modules/.cache" 2>/dev/null || true
echo "Rolled back TRAVA dashboard v2."
