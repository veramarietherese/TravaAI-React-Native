# Home Dashboard Migration

## Architecture

The Expo route remains intentionally small:

- `apps/mobile/src/app/(traveler)/(tabs)/home.tsx`

All home implementation code is isolated under:

- `apps/mobile/src/features/home/screens`
- `apps/mobile/src/features/home/components`
- `apps/mobile/src/features/home/hooks`
- `apps/mobile/src/features/home/api`
- `apps/mobile/src/features/home/types`
- `apps/mobile/src/features/home/utils`

The authenticated backend endpoint is:

- `GET /api/home/dashboard`
- `POST /api/home/invitations`
- `POST /api/home/feedback`

`apps/api/src/app.ts` is patched to register `homeRouter` at `/api/home`.

## Data sources

The dashboard preserves compatibility with the existing TRAVA AI schema and reads from these established tables when available:

- `trips`
- `trip_members`
- `expense_tracking`
- `trip_flights`
- `tour_packages`
- `travel_agencies`
- `notifications` (optional; a missing table only marks the response partial)
- `profiles` or the legacy `users` table for invitation lookup
- `travel_listing_feedback` for ratings/comments

The backend uses the server-only Supabase client but explicitly restricts trip data to the authenticated traveler before returning it. The mobile fallback uses the publishable Supabase client and therefore remains subject to RLS.

## Navigation contract

- Home tab: `/(traveler)/(tabs)/home`
- Explore action/tab: `/(traveler)/(tabs)/explore`
- Trips tab: `/(traveler)/(tabs)/trips`
- AI tab: `/(traveler)/(tabs)/ai`
- Profile tab: `/(traveler)/(tabs)/profile`
- Create trip: `/trip/create`
- Trip detail: `/trip/[tripId]`
- Trip budget: `/trip/[tripId]/budget`
- Package detail: `/package/[packageId]`
- Agency detail: `/agency/[agencyId]`

## Runtime behavior

- Initial load uses authenticated API data.
- API failure falls back to Supabase RLS queries.
- The most recent valid dashboard is cached per user for resilient refresh behavior.
- Pull-to-refresh performs a new authenticated fetch.
- Favorites remain local and per-user.
- Passwords, access tokens, and service-role credentials are never stored by the home feature.
- Invitations validate trip membership/ownership server-side.
- Feedback is validated server-side and limited to ratings 1–5 and comments up to 500 characters.

## Validation

The installer validates:

- Required feature and asset files
- API route registration
- No migration placeholders or known invalid font/animation patterns
- Home as the traveler initial tab
- Required navigation destinations
- Expo web export
- Workspace TypeScript and ESLint
- Expo Doctor

The installer rolls back all replaced/new files if any step fails.

- React hooks lint-safe state hydration with per-user cache isolation
