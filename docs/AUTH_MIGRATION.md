# TRAVA AI Authentication Migration

This package replaces the Vite authentication shell with a React Native/Expo implementation while preserving the original visual language and two animated onboarding screens.

## Included

- Two first-launch onboarding screens using the original `onboarding-1.gif` and `onboarding-2.gif`
- Responsive phone, tablet, desktop-web, safe-area, and keyboard handling
- Email/password signup and login
- Google OAuth through Supabase
- Email confirmation with **Verify now** and **Verify later**
- Resend verification, password reset, and deep-link callback routes
- Traveler/agency role selection and route guards
- Persistent Supabase sessions
- Secure API bearer-token validation and `/api/auth/me`
- `profiles` table, trigger, role RPC, grants, and RLS

## Verification behavior

“Verify later” postpones verification but never bypasses it. The pending email is saved locally and the user returns to sign in. Protected authenticated features remain unavailable until Supabase confirms the email.

## Supabase dashboard setup

1. Apply `supabase/migrations/20260729223500_auth_profiles.sql`.
2. Authentication → Providers → Email: enable email/password and **Confirm email**.
3. Authentication → URL Configuration: add:
   - `travaai://auth/callback`
   - `http://localhost:8082/auth/callback`
   - `http://localhost:8081/auth/callback`
   - your deployed web callback URL
4. Authentication → Providers → Google: add the Google OAuth client ID and secret.
5. In Google Cloud, the authorized redirect URI is the Supabase callback shown in the Google provider panel, normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.

## Environment files

Copy the examples, then fill them locally:

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

Never put the service-role key or Google client secret in `apps/mobile` or in any `EXPO_PUBLIC_` variable.

## Run

```bash
npm run api
npm run mobile
```

For a physical phone, change `EXPO_PUBLIC_API_BASE_URL` from `localhost` to the Mac's LAN IP. OAuth custom-scheme testing should use an Expo development build.

## Backend session test

After login, the mobile `apiRequest` helper attaches the Supabase access token. A valid call to `GET /api/auth/me` returns the authenticated Supabase user and profile.

## Acceptance checklist

- [ ] Onboarding appears only on first launch
- [ ] Skip and both tap-to-continue actions work
- [ ] Email signup sends confirmation email
- [ ] Verify now, resend, verify later, and callback work
- [ ] Email login persists after restart
- [ ] Google signup and returning login work
- [ ] New Google user reaches role selection
- [ ] Traveler cannot open agency routes and vice versa
- [ ] Forgot/reset password works through callback
- [ ] API rejects requests without a valid bearer token
- [ ] `npm run verify` passes
- [ ] Web, development build, and physical-device flows are tested


## Installer validation

The installer clears stale Expo Router generated types, creates a production-style web export, then runs workspace type checking, Expo lint, Expo Doctor, and authentication-specific structural checks. It rolls back all copied and modified files if any stage fails.
