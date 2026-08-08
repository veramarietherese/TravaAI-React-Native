#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
fail(){ printf 'Trip workspace verification failed: %s\n' "$1" >&2; exit 1; }
need(){ [ -f "$ROOT/$1" ] || fail "missing $1"; }
contains(){ grep -Fq "$2" "$ROOT/$1" || fail "$3"; }

for file in \
  apps/mobile/src/app/'(traveler)'/'(tabs)'/trips.tsx \
  apps/mobile/src/app/trip/create.tsx \
  apps/mobile/src/app/trip/'[tripId]'/index.tsx \
  apps/mobile/src/app/trip/'[tripId]'/edit.tsx \
  apps/mobile/src/app/trip/'[tripId]'/itinerary.tsx \
  apps/mobile/src/app/trip/'[tripId]'/map.tsx \
  apps/mobile/src/app/trip/'[tripId]'/budget.tsx \
  apps/mobile/src/app/trip/'[tripId]'/expenses.tsx \
  apps/mobile/src/app/trip/'[tripId]'/checklist.tsx \
  apps/mobile/src/app/trip/'[tripId]'/documents.tsx \
  apps/mobile/src/app/trip/'[tripId]'/members.tsx \
  apps/mobile/src/features/home/components/QuickActions.tsx \
  apps/mobile/src/features/home/screens/HomeScreen.tsx \
  apps/mobile/src/features/trips/screens/TripsScreen.tsx \
  apps/mobile/src/features/trips/screens/CreateTripScreen.tsx \
  apps/mobile/src/features/trips/screens/EditTripScreen.tsx \
  apps/mobile/src/features/trips/screens/TripDetailsScreen.tsx \
  apps/mobile/src/features/itinerary/screens/ItineraryScreen.tsx \
  apps/mobile/src/features/maps/components/TripMapSurface.native.tsx \
  apps/mobile/src/features/maps/components/TripMapSurface.web.tsx \
  apps/mobile/src/features/maps/screens/TripMapScreen.tsx \
  apps/mobile/src/features/members/screens/TripMembersScreen.tsx \
  apps/mobile/src/features/budget/screens/BudgetScreen.tsx \
  apps/mobile/src/features/expenses/screens/ExpensesScreen.tsx \
  apps/mobile/src/features/checklist/screens/ChecklistScreen.tsx \
  apps/mobile/src/features/documents/screens/DocumentsScreen.tsx \
  apps/mobile/src/features/documents/utils/local-documents.native.ts \
  apps/mobile/src/features/documents/utils/local-documents.web.ts \
  apps/api/src/routes/trips.route.ts \
  apps/api/src/routes/flights.route.ts \
  apps/api/src/routes/places.route.ts \
  packages/shared/src/schemas/trip.schema.ts \
  packages/shared/src/types/trip.types.ts \
  supabase/migrations/20260730172000_trip_workspace.sql; do need "$file"; done

FEATURES="$ROOT/apps/mobile/src/features"
! grep -R "PlaceholderScreen" "$FEATURES/trips" "$FEATURES/itinerary" "$FEATURES/maps" "$FEATURES/members" "$FEATURES/budget" "$FEATURES/expenses" "$FEATURES/checklist" "$FEATURES/documents" >/dev/null || fail "a migrated screen is still a placeholder"
! grep -R -E "MapLibre|maplibre-gl|window\.alert|window\.confirm" "$FEATURES/trips" "$FEATURES/itinerary" "$FEATURES/maps" "$FEATURES/members" "$FEATURES/budget" "$FEATURES/expenses" >/dev/null || fail "browser-only code remains in native features"
! grep -R -E "useMemo\([A-Za-z_$][A-Za-z0-9_$]*,[[:space:]]*\[" "$FEATURES" >/dev/null || fail "non-inline useMemo callback would fail Expo lint"
! grep -R "absoluteFillObject" "$FEATURES" >/dev/null || fail "unsupported StyleSheet.absoluteFillObject remains"
! grep -R 'fontWeight: "650"' "$FEATURES" >/dev/null || fail "unsupported font weight remains"
! grep -R -Ei "mock[ _-]?flight|fake[ _-]?flight|sample[ _-]?flight" "$FEATURES/flights" "$ROOT/apps/api/src/routes/flights.route.ts" >/dev/null || fail "mock flight fallback exists"
! grep -R -E 'loadTripAccess\([^,]+,[[:space:]]*request\.params\.' "$ROOT/apps/api/src/routes" >/dev/null || fail "raw Express route params are passed where normalized string IDs are required"
! grep -R -E 'const blob=asset\.file\?\?' "$FEATURES/documents/utils" >/dev/null || fail "web document Blob is not narrowed before storage"
contains apps/api/src/routes/itinerary.route.ts 'Array.isArray(rawTripId)' "itinerary route parameter is not normalized for Express 5"
contains apps/mobile/src/features/documents/utils/local-documents.web.ts 'let blob: Blob | undefined = asset.file' "web document Blob narrowing is missing"
! grep -R -E 'useRef\([^)]*\)\.current' "$FEATURES/trips" "$FEATURES/itinerary" "$FEATURES/maps" "$FEATURES/members" "$FEATURES/budget" "$FEATURES/expenses" "$FEATURES/checklist" "$FEATURES/documents" >/dev/null || fail "render-time ref access pattern remains in migrated features"

# Local-only features must not call the API, Supabase, or browser network APIs.
! grep -R -E "apiRequest|getSupabaseClient|supabase\.from|storage\.from" "$FEATURES/checklist" "$FEATURES/documents/utils" >/dev/null || fail "local checklist/documents are connected to remote storage"
contains apps/mobile/src/features/documents/utils/local-documents.native.ts 'FileSystem.documentDirectory' "native documents are not copied into app-local storage"
contains apps/mobile/src/features/documents/utils/local-documents.web.ts 'indexedDB.open' "web documents are not stored locally in IndexedDB"
contains apps/mobile/src/features/documents/utils/local-documents.native.ts 'MAX_LOCAL_DOCUMENT_BYTES' "native local document size limit missing"
grep -Eq 'const MAX_LOCAL_DOCUMENT_BYTES[[:space:]]*=[[:space:]]*25[[:space:]]*\*[[:space:]]*1024[[:space:]]*\*[[:space:]]*1024' "$ROOT/apps/mobile/src/features/documents/utils/local-documents.web.ts" || fail "web local document size limit declaration missing"

contains apps/api/src/app.ts 'app.use("/api/trips", tripsRouter)' "trip API is not mounted"
contains apps/api/src/app.ts 'app.use("/api/places", placesRouter)' "place search API is not mounted"
contains apps/api/src/app.ts 'app.use("/api/flights", flightsRouter)' "flight API is not mounted"
contains apps/api/src/routes/flights.route.ts 'AIRLABS_API_KEY' "live flight provider is not server-configured"
contains apps/api/src/routes/flights.route.ts 'airlabs.co/api/v9' "AirLabs endpoint is missing"
contains apps/api/src/routes/flights.route.ts 'persistFlightSnapshot' "verified flight snapshots are not persisted to the trip"
! grep -R -E "AIRLABS_API_KEY|SUPABASE_SERVICE_ROLE_KEY" "$ROOT/apps/mobile/src" >/dev/null || fail "server secrets are referenced by mobile code"

contains apps/api/src/routes/trips.route.ts '.eq("role", "traveler")' "agency accounts can be invited into traveler trips"
contains apps/api/src/routes/trips.route.ts 'ownerMembershipError' "trip creation does not verify owner membership creation"
contains apps/api/src/routes/trips.route.ts 'previousSplits' "expense split replacement has no rollback protection"
contains apps/mobile/src/features/trips/utils/media-upload.ts 'export * from "./media-upload.native"' "TypeScript platform fallback for media uploads is missing"
contains apps/mobile/src/features/trips/utils/media-upload.native.ts 'removeTripImage' "native media cleanup is missing"
contains apps/mobile/src/features/trips/utils/media-upload.web.ts 'removeTripImage' "web media cleanup is missing"
contains apps/mobile/src/features/trips/screens/CreateTripScreen.tsx 'draftMediaId' "trip cover is not uploaded atomically before trip creation"
contains apps/mobile/src/features/expenses/screens/ExpensesScreen.tsx 'newlyUploadedPath' "failed receipt mutations can leave orphaned files"
contains apps/mobile/src/features/itinerary/screens/ItineraryScreen.tsx 'ActivityEditorModal key={`${editor.open}-${editor.activity?.id ?? "new"}-${activeDay}`}' "activity editor does not reset between activities or days"
contains apps/mobile/src/features/trips/utils/media-upload.native.ts 'MAX_TRIP_IMAGE_BYTES' "native trip image size limit missing"
contains apps/mobile/src/features/trips/utils/media-upload.web.ts 'MAX_TRIP_IMAGE_BYTES' "web trip image size limit missing"
contains apps/mobile/src/features/expenses/screens/ExpensesScreen.tsx 'method !== "payer_only" && !selected.length' "payer-only expense validation incorrectly requires selected participants"

for dependency in react-native-maps expo-location expo-document-picker expo-file-system expo-image-picker expo-sharing; do
  grep -q "\"$dependency\"" "$ROOT/apps/mobile/package.json" || fail "$dependency dependency missing"
done

for suffix in itinerary budget expenses checklist documents members; do
  grep -q "\"/$suffix\"" "$ROOT/apps/mobile/src/features/trips/components/TripWorkspaceHeader.tsx" || fail "workspace navigation missing $suffix"
done
contains apps/mobile/src/features/trips/screens/TripDetailsScreen.tsx '["Map", "See every activity", "map"' "trip overview does not link to the native map"
contains apps/mobile/src/features/trips/screens/TripsScreen.tsx '/trip/create' "trips list does not link to trip creation"
contains apps/mobile/src/features/home/screens/HomeScreen.tsx 'router.push(typedHref(`/trip/${encodeURIComponent(String(trip.id))}/${action}`))' "home quick actions are not connected to the active trip workspace"
for action in itinerary budget expenses checklist documents; do
  grep -q "key: \"$action\"" "$ROOT/apps/mobile/src/features/home/components/QuickActions.tsx" || fail "home quick action missing $action"
done

SQL="$ROOT/supabase/migrations/20260730172000_trip_workspace.sql"
for table in trips trip_members trip_activities trip_budget_categories expense_tracking expense_splits trip_flights; do
  grep -q "CREATE TABLE IF NOT EXISTS public.$table" "$SQL" || fail "$table migration missing"
done
contains supabase/migrations/20260730172000_trip_workspace.sql "'trip-media'" "private trip media bucket missing"
contains supabase/migrations/20260730172000_trip_workspace.sql 'ENABLE ROW LEVEL SECURITY' "RLS migration missing"
contains supabase/migrations/20260730172000_trip_workspace.sql 'GRANT SELECT ON public.trips' "authenticated read grant missing"
! grep -E 'GRANT (SELECT, )?INSERT|GRANT .*UPDATE|GRANT .*DELETE' "$SQL" | grep -q 'authenticated' || fail "authenticated clients have direct relational write grants; mutations must pass through the protected API"
! grep -q 'CREATE POLICY trip_members_update_related' "$SQL" || fail "unsafe direct member-role update policy remains"
contains supabase/migrations/20260730172000_trip_workspace.sql "(storage.foldername(name))[1] = auth.uid()::text" "private media ownership policy missing"

printf 'TRAVA AI trip workspace structural, security, local-only, and navigation checks passed.\n'
