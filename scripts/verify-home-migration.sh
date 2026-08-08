#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

required=(
  "apps/mobile/src/features/home/screens/HomeScreen.tsx"
  "apps/mobile/src/features/home/api/home.api.ts"
  "apps/mobile/src/features/home/hooks/useHomeDashboard.ts"
  "apps/mobile/src/features/home/hooks/useHomeFavorites.ts"
  "apps/mobile/src/features/home/components/HomeHeader.tsx"
  "apps/mobile/src/features/home/components/TravelFootprintCard.tsx"
  "apps/mobile/src/features/home/components/UpcomingTripCard.tsx"
  "apps/mobile/src/features/home/components/QuickActions.tsx"
  "apps/mobile/src/features/home/components/TourPackageCard.tsx"
  "apps/mobile/src/features/home/components/AgencyCard.tsx"
  "apps/mobile/src/features/home/components/HomeModals.tsx"
  "apps/mobile/src/features/home/types/home.types.ts"
  "apps/mobile/src/features/home/utils/home-normalizers.ts"
  "apps/mobile/src/features/home/utils/home-storage.ts"
  "apps/mobile/src/app/(traveler)/(tabs)/_layout.tsx"
  "apps/api/src/routes/home.route.ts"
  "apps/mobile/assets/images/home/globe.png"
  "apps/mobile/assets/images/home/luggage.png"
  "apps/mobile/assets/images/home/wallet.png"
  "apps/mobile/assets/images/home/invite.png"
)

for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "Missing required home migration file: $path" >&2; exit 1; }
done

grep -Fq 'app.use("/api/home", homeRouter);' apps/api/src/app.ts || {
  echo "apps/api/src/app.ts is missing the /api/home router registration." >&2
  exit 1
}

grep -Fq 'import { homeRouter } from "./routes/home.route.js";' apps/api/src/app.ts || {
  echo "apps/api/src/app.ts is missing the homeRouter import." >&2
  exit 1
}

if grep -R -nE 'PlaceholderScreen|ready for migration|NOT_IMPLEMENTED' \
  apps/mobile/src/features/home apps/api/src/routes/home.route.ts; then
  echo "Home migration contains placeholder or not-implemented content." >&2
  exit 1
fi

if grep -R -nE 'useRef\(new Animated\.Value' apps/mobile/src/features/home; then
  echo "Home migration contains a known Expo SDK 57 animation compatibility problem." >&2
  exit 1
fi

if grep -R -nE 'fontWeight:[[:space:]]*"650"|fontWeight:[[:space:]]*'"'"'650'"'"'' apps/mobile/src/features/home; then
  echo "Home migration contains an unsupported font weight." >&2
  exit 1
fi

if grep -nE '^[[:space:]]+set(Data|IsLoading|Favorites)\(' \
  apps/mobile/src/features/home/hooks/useHomeDashboard.ts \
  apps/mobile/src/features/home/hooks/useHomeFavorites.ts | \
  grep -E ':(5[3-9]|6[0-2]|1[3-9]):'; then
  echo "Home hooks contain synchronous state updates in an effect body." >&2
  exit 1
fi

grep -Fq 'type ColorValue' 'apps/mobile/src/app/(traveler)/(tabs)/_layout.tsx' || {
  echo "Traveler tab icons are not typed for React Native ColorValue." >&2
  exit 1
}

for route in explore trips ai profile; do
  [[ -f "apps/mobile/src/app/(traveler)/(tabs)/${route}.tsx" ]] || {
    echo "Traveler navbar target is missing: ${route}.tsx" >&2
    exit 1
  }
done

grep -Fq 'initialRouteName="home"' 'apps/mobile/src/app/(traveler)/(tabs)/_layout.tsx' || {
  echo "Traveler tab navigation does not make Home the initial route." >&2
  exit 1
}

if grep -Fq 'color: string; focused: boolean' 'apps/mobile/src/app/(traveler)/(tabs)/_layout.tsx'; then
  echo "Traveler tab icons use an incompatible string-only color annotation." >&2
  exit 1
fi

grep -Fq 'type ColorValue' 'apps/mobile/src/app/(traveler)/(tabs)/_layout.tsx' || {
  echo "Traveler tab icons are missing React Native ColorValue compatibility." >&2
  exit 1
}

grep -Fq 'router.push(typedHref("/trip/create"))' apps/mobile/src/features/home/screens/HomeScreen.tsx || {
  echo "Create Trip navigation is missing." >&2
  exit 1
}

grep -Fq '/api/home/dashboard' apps/mobile/src/features/home/api/home.api.ts || {
  echo "Mobile dashboard is not connected to the home API." >&2
  exit 1
}

grep -Fq 'router.push(typedHref("/(traveler)/(tabs)/explore"))' apps/mobile/src/features/home/screens/HomeScreen.tsx || {
  echo "Explore tab navigation is missing." >&2
  exit 1
}

grep -Fq 'router.push(typedHref(`/package/${encodeURIComponent(String(listing.item.id))}`))' apps/mobile/src/features/home/screens/HomeScreen.tsx || {
  echo "Tour package detail navigation is missing." >&2
  exit 1
}

grep -Fq 'router.push(typedHref(`/agency/${encodeURIComponent(String(listing.item.id))}`))' apps/mobile/src/features/home/screens/HomeScreen.tsx || {
  echo "Agency detail navigation is missing." >&2
  exit 1
}

echo "TRAVA AI home dashboard migration checks passed."
