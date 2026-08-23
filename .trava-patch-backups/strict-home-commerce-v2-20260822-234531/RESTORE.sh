#!/usr/bin/env bash
set -euo pipefail
MOBILE="/Users/veramarie/Desktop/TravaAI-React-Native/apps/mobile"
BACKUP="/Users/veramarie/Desktop/TravaAI-React-Native/.trava-patch-backups/strict-home-commerce-v2-20260822-234531"
cp "$BACKUP/apps/mobile/src/features/home/screens/HomeScreen.tsx" "$MOBILE/src/features/home/screens/HomeScreen.tsx"
for rel in   "src/features/home/components/HomeMessagesStrip.tsx"   "src/features/home/components/TravelCommerceModals.tsx"; do
  if [ -f "$BACKUP/apps/mobile/$rel" ]; then
    mkdir -p "$MOBILE/$(dirname \"$rel\")"
    cp "$BACKUP/apps/mobile/$rel" "$MOBILE/$rel"
  else
    rm -f "$MOBILE/$rel"
  fi
done
echo "✅ Restored HomeScreen and the two commerce UI components."
