# TRAVA AI Authentication UX Refinement

This refinement is applied on top of the completed React Native authentication migration.

## User-facing changes

- Onboarding and authentication now fill the entire viewport. There is no artificial phone-shaped outer frame.
- The two original onboarding GIFs remain unchanged and cover the full screen.
- Onboarding provides Back, Skip, explicit Continue/Start buttons, tap-anywhere navigation, and two progress tiles.
- The current onboarding page is persisted so a refresh or app restart resumes at the same page.
- Traveler and Travel Agency access use separate routes while sharing the same responsive design system:
  - Traveler: `/login` and `/register`
  - Travel Agency: `/agency-login` and `/agency-register`
- Each login portal validates the stored profile role. A traveler account cannot enter through the agency portal, and an agency account cannot enter through the traveler portal.
- Google OAuth receives the selected portal before authorization and automatically locks a new account to that portal after callback.
- Signup drafts persist non-sensitive fields across refreshes. Passwords are intentionally never persisted.
- Verification, password reset, and fallback workspace setup include progress tiles and predictable Back controls.
- The root entry gate remembers the last-used portal and returns logged-out users to the correct sign-in screen.

## Backend protection

`requireAuth` now verifies all of the following before a request reaches protected backend logic:

1. A Bearer token is present.
2. Supabase accepts the token.
3. The email is verified.
4. A profile row exists.

The exported `requireRole("traveler" | "agency")` middleware is available for role-specific routes. `/api/auth/me` returns the verified profile and portal access flags.

## Refresh and backtracking

- The current route remains refreshable through Expo Router.
- Onboarding progress is stored in AsyncStorage.
- Traveler and agency remembered emails are stored separately.
- Signup name, email, and Terms selection are stored separately per portal.
- Passwords and confirmation passwords are never stored.
- Explicit Back buttons use deterministic fallback routes rather than relying only on browser history.

## Validation

After application, run:

```bash
npm run verify
npm run mobile -- --clear
```

Test both portals, browser refresh, Android hardware back, onboarding back/skip, email verification, Google OAuth, and `/api/auth/me`.
