# TRAVA AI Native Trip Workspace

This migration replaces the legacy browser trip workflow with authenticated Expo/React Native features and connects the Home Dashboard to the active trip workspace.

## Server-backed features

- Trips list, lifecycle filters, create/edit/delete, private cover images, refresh, loading, error, and empty states
- Daily itinerary activity CRUD, day selection, categories, location search, times, notes, and estimated costs
- Native map markers and route polyline, optional foreground location, full map screen, and external navigation
- Owner/member permissions, member directory, invitations, acceptance/rejection, duplicate protection, and owner-controlled removal
- Budget categories, planned/actual/remaining values, expenses, private receipts, payer selection, splits, and balances
- Backend-only AirLabs live flight status with caching, trip access checks, and persisted real provider snapshots
- Home quick actions and workspace navigation connecting Itinerary, Budget, Expenses, Checklist, Documents, Members, and Map

## Device-only features

Checklist items and document files are keyed by signed-in user and trip on the device. They are intentionally absent from the SQL migration and API. Native documents are copied into the app’s private document directory. Web documents use IndexedDB. Each document is limited to 25 MB.

## Private trip media

Trip covers and receipts use the private `trip-media` Supabase Storage bucket. Client paths are restricted to the signed-in user’s top-level folder. Images are limited to 10 MB, and newly uploaded files are removed when their related API mutation fails.

## External configuration

1. Run `supabase/migrations/20260730172000_trip_workspace.sql` once in the Supabase SQL Editor.
2. Run `node scripts/verify-trip-database.mjs` afterward.
3. Configure `AIRLABS_API_KEY` in `apps/api/.env` for live flight status. There is no mock fallback.
4. Configure `ALLOWED_ORIGINS` and `NODE_ENV=production` before public web deployment.
5. Configure `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/mobile/.env` before Android native builds. iOS uses Apple Maps by default.
6. Restart the API and Metro after environment changes.

## Verification

```bash
npm run verify
bash scripts/verify-trip-workspace.sh
node scripts/verify-trip-database.mjs
```
