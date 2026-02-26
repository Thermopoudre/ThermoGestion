# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
ThermoGestion is a Next.js 14 (App Router) SaaS for powder-coating workshop management. Backend is hosted Supabase (PostgreSQL, Auth, Storage). No Docker or local database needed.

### Key commands
See `package.json` scripts and `README.md`. Summary:
- `npm run dev` — dev server on port 3000
- `npm run lint` — ESLint (warnings only, no errors expected)
- `npm run type-check` — TypeScript check (known failures from Supabase deep types; `continue-on-error` in CI)
- `npm run test` — Vitest unit tests (77 tests across 6 files)
- `npm run build` — production build (TS errors ignored via `ignoreBuildErrors: true` in `next.config.js`)
- `npm run test:e2e` — Playwright end-to-end tests (requires running dev server)

### Node.js version
The project targets **Node.js 20** (see `.github/workflows/ci.yml`). Use `nvm use 20` before running commands.

### Environment variables
A `.env.local` file is required. For CI/build-only purposes, placeholder values work:
```
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
For full functionality (auth, database, storage), real Supabase credentials are needed. See `.env.example` for all variables.

### Gotchas
- **TypeScript type-check fails** on Supabase deep instantiation types. This is expected and marked `continue-on-error` in CI. The build ignores TS errors (`ignoreBuildErrors: true`).
- **Sentry is conditionally loaded** only when `NEXT_PUBLIC_SENTRY_DSN` is set; safe to omit in dev.
- **The app starts and serves pages without real Supabase keys**, but auth/data features will show "fetch failed" errors. This is expected when using placeholder credentials.
- **Lockfile**: `package-lock.json` is used — always install with `npm ci` for deterministic builds.
