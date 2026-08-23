#!/usr/bin/env bash
set -e
cp "/Users/veramarie/Desktop/TravaAI-React-Native/.trava-patch-backups/trips-reference-live-flights-20260822-131921/apps/mobile/src/features/trips/screens/TripsScreen.tsx" "/Users/veramarie/Desktop/TravaAI-React-Native/apps/mobile/src/features/trips/screens/TripsScreen.tsx"
cp "/Users/veramarie/Desktop/TravaAI-React-Native/.trava-patch-backups/trips-reference-live-flights-20260822-131921/apps/mobile/src/features/flights/api/flights.api.ts" "/Users/veramarie/Desktop/TravaAI-React-Native/apps/mobile/src/features/flights/api/flights.api.ts"
cp "/Users/veramarie/Desktop/TravaAI-React-Native/.trava-patch-backups/trips-reference-live-flights-20260822-131921/apps/api/src/routes/flights.route.ts" "/Users/veramarie/Desktop/TravaAI-React-Native/apps/api/src/routes/flights.route.ts"
echo "TRAVA Trips patch rolled back."
