# Trava AI

Production-oriented npm-workspaces monorepo for the Trava AI React Native migration.

## Workspaces

- `apps/mobile` — Expo React Native application
- `apps/api` — secure API and server-side integrations
- `packages/shared` — platform-independent TypeScript contracts and utilities
- `supabase` — local configuration, migrations, functions, and seed data
- `legacy/web-vite` — preserved original Vite application during migration

## Common commands

```bash
npm install
npm run mobile
npm run android
npm run ios
npm run api
npm run verify
```

The legacy site remains available with:

```bash
npm run legacy:web:install
npm run legacy:web
```
