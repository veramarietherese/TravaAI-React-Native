#!/bin/zsh
# Deliberately no `set -e`: a failed grep/test must not kill the user's VS Code shell.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$ROOT" ]]; then
  echo "Not inside a git repository."
  exit 1
fi
cd "$ROOT"

FAIL=0

echo "== 1/4 TypeScript =="
npm run typecheck || FAIL=1

echo ""
echo "== 2/4 Lint =="
npm run lint || FAIL=1

echo ""
echo "== 3/4 Requested feature assertions =="
python3 - <<'PY' || FAIL=1
from pathlib import Path
root = Path.cwd()
checks = {
  "apps/mobile/src/features/explore/screens/ExploreScreen.tsx": ["Wikimedia Commons photos", "suggestionImage", "View Details", "startVoiceSearch"],
  "apps/mobile/src/features/maps/utils/world-place-search.ts": ["photonNearby", "Deliberately do not hit Overpass"],
  "apps/mobile/src/features/checklist/screens/ChecklistScreen.tsx": ["checklist-pencil-pink.png", "ConfirmDelete", "deleteChecklist(deleteTarget.id)"],
  "apps/mobile/src/features/documents/screens/DocumentsScreen.tsx": ["prepareStoredDocument", "Open full document", "onPress={() => setActive(doc)}"],
  "apps/mobile/src/features/home/components/QuickActions.tsx": ["softHighlight"],
  "apps/mobile/src/features/home/components/TourPackageCard.tsx": ["Book now", "height: 430"],
  "apps/mobile/src/features/home/components/AgencyCard.tsx": ["View agency", "height: 390"],
  "apps/mobile/src/features/itinerary/screens/ItineraryScreen.tsx": ["Delete day", "deleteDay(day)"],
  "apps/mobile/src/features/trips/hooks/useLocalTripWorkspace.ts": ["deleteDay(dayNumber: number)", "manualDayCount"],
  "apps/mobile/src/features/home/hooks/useRealtimeHomeNotifications.ts": ["notificationChannelSequence"],
  "apps/api/src/routes/places.route.ts": ["safePhoton", "photonNearby"],
}
missing=[]
for rel, needles in checks.items():
  p=root/rel
  if not p.exists():
    missing.append(f"{rel}: file missing")
    continue
  text=p.read_text(encoding="utf-8")
  for needle in needles:
    if needle not in text:
      missing.append(f"{rel}: missing {needle!r}")
if missing:
  for item in missing: print("FAIL", item)
  raise SystemExit(1)
print("Requested feature source assertions passed.")
PY

echo ""
echo "== 4/4 Console-source assertions =="
python3 - <<'PY' || FAIL=1
from pathlib import Path
root=Path.cwd()
mobile=root/"apps/mobile/src"
text="\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in mobile.rglob("*") if p.suffix in {".ts",".tsx"})
problems=[]
if "overpass-api.de/api/interpreter" in text: problems.append("direct browser Overpass URL remains")
if "api.frankfurter.app/latest" in text: problems.append("Frankfurter browser URL remains")
if 'allow-scripts allow-same-origin' in text: problems.append("unsafe iframe sandbox combination remains")
if 'channel(`trava-notifications:${userId}`)' in text: problems.append("fixed notification channel topic remains")
if problems:
  for item in problems: print("FAIL", item)
  raise SystemExit(1)
print("Actionable console-source assertions passed.")
PY

if [[ $FAIL -ne 0 ]]; then
  echo ""
  echo "Verification found a code issue. Do not start the app yet; send this output."
  exit 1
fi

echo ""
echo "Local code verification passed."
echo "NEXT DATABASE STEP (required for workspace-state/members/realtime schema):"
echo "  npx supabase db push"
echo "Then fully restart API + Expo; hot reload is not sufficient."
