#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

required=(
  "apps/mobile/src/features/home/screens/HomeScreen.tsx"
  "apps/mobile/src/features/home/components/TravelFootprintCard.tsx"
  "apps/mobile/src/features/home/components/TravelGlobeSurface.native.tsx"
  "apps/mobile/src/features/home/components/TravelGlobeSurface.web.tsx"
  "apps/mobile/src/features/home/components/TravelGlobeSurface.types.ts"
  "apps/mobile/src/features/home/components/CountryPickerModal.tsx"
  "apps/mobile/src/features/home/components/TravelRouteEditorModal.tsx"
  "apps/mobile/src/features/home/hooks/useTravelRoutes.ts"
  "apps/mobile/src/features/home/api/travel-globe.api.ts"
  "apps/mobile/src/features/home/data/globe-country-data.ts"
  "apps/mobile/src/features/home/utils/travel-globe-engine.ts"
  "apps/mobile/src/features/home/utils/home-normalizers.ts"
  "apps/mobile/src/features/home/api/home.api.ts"
  "apps/mobile/src/features/home/types/home.types.ts"
  "apps/api/src/data/country-centroids.ts"
  "apps/api/src/routes/home.route.ts"
  "supabase/migrations/20260730052500_travel_routes.sql"
)

for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "Missing interactive globe file: $path" >&2; exit 1; }
done

if ! grep -Fq 'react-native-webview' apps/mobile/package.json; then
  echo "apps/mobile/package.json is missing react-native-webview." >&2
  exit 1
fi

country_count=$(grep -o '"code":"[A-Z][A-Z]"' \
  apps/mobile/src/features/home/data/globe-country-data.ts | wc -l | tr -d ' ')
if [[ "$country_count" -lt 200 ]]; then
  echo "Country directory is incomplete: only $country_count entries." >&2
  exit 1
fi

for pattern in \
  'pointerdown' \
  'pointermove' \
  'wheel' \
  'function slerp' \
  'type==="zoom-in"' \
  'type==="zoom-out"' \
  'type==="focus"'; do
  grep -Fq "$pattern" apps/mobile/src/features/home/utils/travel-globe-engine.ts || {
    echo "Globe engine is missing required interaction: $pattern" >&2
    exit 1
  }
done

grep -Fq 'WebView' apps/mobile/src/features/home/components/TravelGlobeSurface.native.tsx || {
  echo "Native globe surface is not connected to react-native-webview." >&2
  exit 1
}

grep -Fq 'sandbox: "allow-scripts"' apps/mobile/src/features/home/components/TravelGlobeSurface.web.tsx || {
  echo "Web globe surface is missing its sandboxed iframe." >&2
  exit 1
}

if grep -R -nF 'useMemo(createTravelGlobeHtml, [])' \
  apps/mobile/src/features/home/components/TravelGlobeSurface.native.tsx \
  apps/mobile/src/features/home/components/TravelGlobeSurface.web.tsx; then
  echo "Globe surfaces must use an inline useMemo callback for Expo ESLint compatibility." >&2
  exit 1
fi

grep -Fq '<TravelFootprintCard userId={user?.id} />' apps/mobile/src/features/home/screens/HomeScreen.tsx || {
  echo "HomeScreen is not connected to the authenticated user globe." >&2
  exit 1
}

grep -Fq 'TravelRouteEditorModal' apps/mobile/src/features/home/components/TravelFootprintCard.tsx || {
  echo "Travel footprint card is missing route management." >&2
  exit 1
}

grep -Fq 'visible={fullScreenOpen}' apps/mobile/src/features/home/components/TravelFootprintCard.tsx || {
  echo "Travel footprint card is missing full-screen mode." >&2
  exit 1
}

for endpoint in \
  'homeRouter.get("/travel-routes"' \
  'homeRouter.post("/travel-routes"' \
  'homeRouter.delete("/travel-routes/:routeId"'; do
  grep -Fq "$endpoint" apps/api/src/routes/home.route.ts || {
    echo "Backend route is missing: $endpoint" >&2
    exit 1
  }
done

route_role_count=$(grep -c '"/travel-routes.*requireAuth, requireRole("traveler")' apps/api/src/routes/home.route.ts || true)
if [[ "$route_role_count" -lt 3 ]]; then
  echo "Travel route endpoints are not consistently protected by traveler authorization." >&2
  exit 1
fi

for sql_pattern in \
  'CREATE TABLE IF NOT EXISTS public.travel_routes' \
  'CREATE TABLE IF NOT EXISTS public.travel_country_catalog' \
  'travel_routes_select_own' \
  'travel_routes_insert_own' \
  'travel_routes_delete_own' \
  "NOTIFY pgrst, 'reload schema'"; do
  grep -Fq "$sql_pattern" supabase/migrations/20260730052500_travel_routes.sql || {
    echo "Database migration is missing: $sql_pattern" >&2
    exit 1
  }
done

if grep -R -nE 'PlaceholderScreen|ready for migration|NOT_IMPLEMENTED|TODO: implement|coming soon' \
  apps/mobile/src/features/home/components/TravelFootprintCard.tsx \
  apps/mobile/src/features/home/components/TravelGlobeSurface* \
  apps/mobile/src/features/home/components/CountryPickerModal.tsx \
  apps/mobile/src/features/home/components/TravelRouteEditorModal.tsx \
  apps/mobile/src/features/home/hooks/useTravelRoutes.ts \
  apps/mobile/src/features/home/api/travel-globe.api.ts \
  apps/api/src/routes/home.route.ts; then
  echo "Interactive globe migration contains placeholder content." >&2
  exit 1
fi

if grep -R -nE 'react-globe\.gl|three\.js|three/examples|window\.localStorage|sessionStorage|fetch\(|https?://' \
  apps/mobile/src/features/home/utils/travel-globe-engine.ts; then
  echo "Globe engine contains a forbidden remote/runtime dependency." >&2
  exit 1
fi

if grep -R -nE 'service_role|sb_secret_' apps/mobile/src/features/home; then
  echo "Mobile globe feature contains a server-only secret pattern." >&2
  exit 1
fi

node - "$ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const source = fs.readFileSync(path.join(root, "apps/api/src/data/country-centroids.ts"), "utf8");
const match = source.match(/= (\{.*\}) as const;/s);
if (!match) throw new Error("Unable to parse country centroid catalog.");
const countries = JSON.parse(match[1]);
if (Object.keys(countries).length < 200) throw new Error("Country centroid catalog is incomplete.");
if (!countries.PH || !countries.JP || !countries.US) throw new Error("Core country records are missing.");
function distance(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const first = radians(a.lat);
  const second = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(first) * Math.cos(second) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const phJapan = distance(countries.PH, countries.JP);
if (phJapan < 2500 || phJapan > 3500) throw new Error(`Unexpected PH-JP distance: ${phJapan}`);
console.log(`Country and distance checks passed (${Object.keys(countries).length} countries).`);
NODE

echo "TRAVA AI interactive globe migration checks passed."
