#!/bin/zsh
set +e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$ROOT" ]]; then
  echo "❌ Not inside the TRAVA repository."
  exit 1
fi
cd "$ROOT"

echo "== 1/3 TypeScript =="
npm run typecheck
TYPE_STATUS=$?

echo ""
echo "== 2/3 Lint =="
npm run lint
LINT_STATUS=$?

echo ""
echo "== 3/3 Precision UI assertions =="
python3 - <<'PY'
from pathlib import Path
root = Path.cwd()
checks = {
    "apps/mobile/src/features/home/components/TourPackageCard.tsx": [
        'height: 176',
        'per package',
        'backgroundColor: "#090909"',
    ],
    "apps/mobile/src/features/home/components/AgencyCard.tsx": [
        "AgencyBrandMark",
        "TRAVA Partner",
        'height: 176',
    ],
    "apps/mobile/src/features/home/components/AgencyBrandMark.tsx": [
        "usableLogo",
        "initials",
    ],
    "apps/mobile/src/features/maps/utils/place-photo.ts": [
        "commonsExactImage",
        "exactStaticMap",
    ],
    "apps/mobile/src/features/explore/components/DiscoverMap.web.tsx": [
        'sandbox: "allow-scripts"',
        "userhalo",
        'class="photo"',
    ],
    "apps/mobile/src/features/explore/screens/ExploreScreen.tsx": [
        "Exact venue image when available",
        "useLocalSearchParams",
        "View Details",
    ],
    "apps/mobile/src/features/ai/screens/AiScreen.tsx": [
        "Trava AI Assistant",
        "cleanAssistantText",
        "Add to Itinerary",
        "Animated.timing",
        "attachFile",
    ],
    "apps/mobile/src/features/home/components/TravelCommerceModals.tsx": [
        "Itinerary Preview",
        "Package Details",
        "Verified TRAVA Partner",
        "addPackageToItinerary",
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

print("Precision UI source assertions passed.")
PY
ASSERT_STATUS=$?

if [[ $TYPE_STATUS -ne 0 || $LINT_STATUS -ne 0 || $ASSERT_STATUS -ne 0 ]]; then
  echo ""
  echo "❌ Verification found a code issue. Do not hot-reload; send the terminal output."
  exit 1
fi

echo ""
echo "✅ TRAVA Precision UI Fix 10 verification passed."
echo "Restart the app completely:"
echo "  zsh scripts/start-trava-dev.zsh"
