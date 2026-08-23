#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-$PWD}"
if [ -f "$TARGET/src/features/trips/screens/TripsScreen.tsx" ]; then MOBILE="$TARGET"; ROOT="$(cd "$TARGET/../.." && pwd)"; else ROOT="$TARGET"; MOBILE="$TARGET/apps/mobile"; fi
B="$(cd "$(dirname "$0")" && pwd)"
cp "$B/src/features/trips/screens/TripsScreen.tsx" "$MOBILE/src/features/trips/screens/TripsScreen.tsx"
cp "$B/src/features/trips/components/TripWorkspaceHeader.tsx" "$MOBILE/src/features/trips/components/TripWorkspaceHeader.tsx"
rm -f "$ROOT/supabase/migrations/20260822182500_trip_workspace_compat_repair.sql"
echo "Rolled back TRAVA trips tabs + white 3D UI patch."
