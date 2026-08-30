# IBEX HAD Cloudflare preview

The feature branch `feature/ibex-had-chat-pwa` uses Cloudflare Pages Functions to connect directly to Neon.

Required Cloudflare secrets / variables:

- `DATABASE_URL` — Neon PostgreSQL connection string (secret)
- `IBEX_BUSINESS_ID` — defaults in code to `4c424fea-a5fb-485f-b695-535eac647224` when omitted

Preview acceptance check:

1. Deploy this branch through the existing Cloudflare Pages Git integration.
2. Open `/api/health` on the preview deployment.
3. Expected response: `{ "ok": true, "database": "connected", ... }`.
4. Then test the documents hub and customer statement endpoint.

Do not expose `DATABASE_URL` through any `VITE_*` variable; it must remain server-side only.
