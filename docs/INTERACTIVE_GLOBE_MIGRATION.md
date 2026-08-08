# Interactive Globe Architecture

## Rendering

The visualizer uses one self-contained Canvas globe engine shared by native and web:

- iOS and Android render the engine inside `react-native-webview`.
- Expo web renders the same engine inside a sandboxed inline iframe.
- Country geometry is bundled with the app; no map script or runtime geometry download is required.
- Latitude and longitude are projected onto a sphere. Pointer/touch movement rotates the view, pinch or wheel input adjusts scale, and route arcs use spherical interpolation.

## Route data flow

1. The traveler searches the bundled country directory.
2. The mobile client submits only country codes and the selected travel date.
3. The Express API validates both codes against its bundled catalog.
4. Supabase stores the route under the authenticated user's ID.
5. A database trigger overwrites names and coordinates from the database catalog and calculates the great-circle distance.
6. The API returns normalized camel-case route data.
7. The globe redraws the route and the statistics recalculate immediately.

When the API is temporarily unavailable, the mobile client can use Supabase directly. Row-level security permits only the authenticated traveler to select, insert, or delete their own routes. The same database trigger still validates and derives route details.

## Statistics

- **Total Distance:** sum of `distance_km` for the user's saved routes.
- **Flights Taken:** number of saved route rows.
- **Countries:** unique origin and destination country codes.
- **Travel Days:** unique saved travel dates.

The broader Home Dashboard API uses these route statistics when routes exist and retains legacy `trip_flights` statistics only for accounts that have not saved globe routes yet.

## Database migration

Run once:

```text
supabase/migrations/20260730052500_travel_routes.sql
```

The migration is idempotent and includes:

- `public.travel_country_catalog`
- `public.travel_routes`
- great-circle distance function
- route hydration trigger
- authenticated-user RLS policies
- required grants
- PostgREST schema reload
