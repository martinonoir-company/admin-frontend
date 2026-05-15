/**
 * Centralised runtime config for the admin frontend.
 *
 * Everything that needs the API base URL imports `API_BASE` from here.
 * Override via `NEXT_PUBLIC_API_URL` in `.env.local` (dev) or the build
 * environment (CI / Vercel / Railway / etc).
 *
 * Convention matches the rest of the monorepo (user-frontend, POS,
 * scanner-mobile-app, user-mobile-app): the base URL INCLUDES the
 * `/api/v1` version prefix. Per-call paths are just `/auth/login`,
 * `/products`, etc. — no version prefix in the call sites.
 *
 * Default (`http://localhost:3000/api/v1`) targets a server running
 * locally on port 3000. Production deploys MUST set the env var to the
 * deployed API host, e.g. `https://api.martinonoir.com/api/v1`.
 *
 * Reminder: `NEXT_PUBLIC_*` vars are inlined into the client bundle at
 * build time. Don't put secrets here.
 */
export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3000/api/v1";
