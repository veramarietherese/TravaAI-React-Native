#!/usr/bin/env bash
set -euo pipefail

required=(
  "apps/mobile/src/features/auth/screens/OnboardingScreen.tsx"
  "apps/mobile/src/features/auth/screens/LoginScreen.tsx"
  "apps/mobile/src/features/auth/screens/RegisterScreen.tsx"
  "apps/mobile/src/features/auth/screens/VerifyEmailScreen.tsx"
  "apps/mobile/src/features/auth/api/auth.api.ts"
  "apps/mobile/src/providers/AuthProvider.tsx"
  "apps/mobile/assets/images/onboarding/onboarding-1.gif"
  "apps/mobile/assets/images/onboarding/onboarding-2.gif"
  "apps/api/src/routes/auth.route.ts"
  "apps/api/src/middleware/auth.middleware.ts"
  "supabase/migrations/20260729223500_auth_profiles.sql"
)

for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "Missing auth migration file: $path" >&2; exit 1; }
done

if grep -R --line-number -E 'SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY' apps/mobile/src apps/mobile/.env 2>/dev/null; then
  echo "A server-only secret name was found in mobile code or environment." >&2
  exit 1
fi

if grep -R --line-number 'fontWeight: "650"' apps/mobile/src/features/auth; then
  echo "Unsupported React Native fontWeight 650 found in authentication code." >&2
  exit 1
fi

if grep -R --line-number 'pathname: "/verify-email"' apps/mobile/src/features/auth; then
  echo "Object-form navigation to the newly-added verify-email route can fail against stale Expo typed routes." >&2
  exit 1
fi

if grep -R --line-number 'as unknown as Href' apps/mobile/src/features/auth; then
  echo "Unsafe double route casts found in authentication code." >&2
  exit 1
fi

if grep -R --line-number -E 'useRef\(new Animated\.Value' apps/mobile/src/features/auth; then
  echo "Animated values must use lazy useState initialization to satisfy the React refs lint rule." >&2
  exit 1
fi

if grep -R --line-number -E 'This native feature is ready for migration|TODO_AUTH|AUTH_PLACEHOLDER' apps/mobile/src/features/auth; then
  echo "Placeholder authentication content was found." >&2
  exit 1
fi

npm run verify
(cd apps/mobile && npx expo-doctor)
echo "TRAVA AI authentication migration checks passed."
