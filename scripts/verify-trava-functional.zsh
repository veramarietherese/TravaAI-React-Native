#!/bin/zsh
set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "== 1/5 Repository checks =="
git status --short
node -v
npm -v

echo
echo "== 2/5 TypeScript + lint =="
npm run verify

echo
echo "== 3/5 Free location/photo provider checks =="
curl -fsS --max-time 8 "https://photon.komoot.io/api/?q=Ayala%20Center%20Cebu&limit=1" >/dev/null
curl -fsS --max-time 8 "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Ayala%20Center%20Cebu&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*" >/dev/null
echo "Photon + Wikimedia Commons reachable."

echo
echo "== 4/5 Expo web production bundle smoke test =="
rm -rf "$ROOT/.trava-web-smoke"
cd "$ROOT/apps/mobile"
npx expo export --platform web --output-dir "$ROOT/.trava-web-smoke"
test -d "$ROOT/.trava-web-smoke"
rm -rf "$ROOT/.trava-web-smoke"

echo
echo "== 5/5 Static feature assertions =="
cd "$ROOT"
grep -q "workspace-state" apps/api/src/routes/trips.route.ts
grep -q "automatic exact lookup" apps/mobile/src/features/members/screens/TripMembersScreen.tsx
grep -q "resolveFreePlaceImage" apps/mobile/src/features/explore/screens/ExploreScreen.tsx
grep -q "useRealtimeHomeNotifications" apps/mobile/src/features/home/screens/HomeScreen.tsx
grep -q "Preview & share receipt" apps/mobile/src/features/expenses/screens/ExpensesScreen.tsx
grep -q "ProfileSettingsModal" apps/mobile/src/features/profile/screens/ProfileScreen.tsx
grep -q "documents-folder.png" apps/mobile/src/features/documents/components/DocumentsHero.tsx
grep -q "checklist-3d.png" apps/mobile/src/features/checklist/screens/ChecklistScreen.tsx

echo
echo "All source/build smoke checks passed."
echo "For database-backed realtime collaboration/notifications, also confirm:"
echo "  npx supabase db push"
echo "Then run API + Expo:"
echo "  zsh scripts/start-trava-dev.zsh"
