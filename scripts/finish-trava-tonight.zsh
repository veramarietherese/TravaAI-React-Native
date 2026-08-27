#!/bin/zsh
set +e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$ROOT" ]]; then
  echo "❌ Not inside the TRAVA git repository."
  exit 1
fi

cd "$ROOT"

echo ""
echo "============================================================"
echo " TRAVA FINAL ONE-SHOT CHECK"
echo "============================================================"
echo ""

echo "== 1/3 Local code verification =="
zsh scripts/verify-trava-ux-runtime-06.zsh
VERIFY=$?
if [[ $VERIFY -ne 0 ]]; then
  echo ""
  echo "❌ Local verification failed. Database was NOT touched."
  exit $VERIFY
fi

echo ""
echo "== 2/3 Database migration =="
echo "Supabase may ask once for confirmation. Choose Yes."
npx supabase db push
DB=$?
if [[ $DB -ne 0 ]]; then
  echo ""
  echo "❌ Database push failed."
  echo "Run this single diagnostic if you need to send the exact DB error:"
  echo "  npx supabase db push --debug"
  exit $DB
fi

echo ""
echo "== 3/3 Final source sanity =="
python3 - <<'PY'
from pathlib import Path
root = Path.cwd()

checks = {
    "apps/mobile/src/features/explore/screens/ExploreScreen.tsx": [
        "Wikimedia Commons",
        "View Details",
    ],
    "apps/mobile/src/features/checklist/screens/ChecklistScreen.tsx": [
        "checklist-pencil-pink.png",
        "ConfirmDelete",
    ],
    "apps/mobile/src/features/documents/screens/DocumentsScreen.tsx": [
        "Open full document",
        "prepareStoredDocument",
    ],
    "apps/mobile/src/features/itinerary/screens/ItineraryScreen.tsx": [
        "Delete day",
    ],
    "apps/mobile/src/features/home/hooks/useRealtimeHomeNotifications.ts": [
        "notificationChannelSequence",
    ],
    "supabase/migrations/20260824023000_runtime_schema_guard.sql": [
        "user_id::text = auth.uid()::text",
        "DROP POLICY IF EXISTS",
        "pg_publication_tables",
    ],
}

missing = []
for rel, needles in checks.items():
    p = root / rel
    if not p.exists():
        missing.append(f"{rel}: missing file")
        continue
    text = p.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            missing.append(f"{rel}: missing {needle!r}")

if missing:
    print("\n".join("FAIL " + item for item in missing))
    raise SystemExit(1)

print("✅ Final source sanity passed.")
PY

SANITY=$?
if [[ $SANITY -ne 0 ]]; then
  exit $SANITY
fi

echo ""
echo "============================================================"
echo " ✅ TRAVA FIX 08 COMPLETE"
echo "============================================================"
echo ""
echo "TypeScript: passed"
echo "Lint: passed (warnings may remain, but zero errors)"
echo "Requested feature assertions: passed"
echo "Console-source assertions: passed"
echo "Database migration: pushed"
echo ""
echo "You can stop here for tonight."
echo "When you want to run the app again:"
echo "  zsh scripts/start-trava-dev.zsh"
echo ""
