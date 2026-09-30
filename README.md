# DSM Negotiator — web app

The standalone web client for the AI insurance-negotiation platform. Talks to the central
`dent_shop_api` backend (all business logic, AI drafting, and legal guardrails live there —
never in this client).

## Stack

Vite 6 · Vue 3.5 · TypeScript · pinia · vue-router 4 — same stack as `dent_shop_manager_web`
(the CRM web app), but a separate product with its own branding and its own repo.

## Develop

```bash
npm install
npm run dev        # http://localhost:5174 (the API's dev CORS allows this origin)
npm run build      # vue-tsc type-check + production build
```

The API must be running at `http://localhost:5080` (`dotnet run` in `dent_shop_api`;
see that repo's CLAUDE.md). Override the API base URL with `VITE_API_BASE`.

In local dev the backend uses a deterministic fake AI assistant unless `Anthropic:ApiKey`
is configured — every flow works, drafts are labeled placeholders. Email OTP codes for
registration are printed to the API console.

## Layout

- `src/api/` — typed fetch wrapper (bearer injection, 401 → login, 402 → subscription
  banner) + endpoint clients mirroring `/api/auth` and `/api/shops/{shopId}/negotiation`
- `src/stores/auth.ts` — session (localStorage-persisted)
- `src/views/` — login, 3-step register (terms acceptance), cases list, case workspace
- `src/components/` — case sidebar (facts/documents/status), correspondence timeline,
  draft panel (customer-voice authorization), generated letters + Total Loss invoice

## Analytics & error reporting (dormant until configured)

Both are off unless their build-time variable is set; nothing loads and the production CSP
stays strict. The Vite build adds only the hosts that are actually configured to the built
`staticwebapp.config.json` CSP (see `vite.config.ts`).

| Variable | Where to set it (GitHub → repo Settings) | What it does |
| --- | --- | --- |
| `VITE_GA_MEASUREMENT_ID` | Variables (`vars.`) | GA4 (`G-…`) on **public pages only** (`/welcome`, `/login`): a `page_view` per public route and a `sign_up_click` event on the sign-up buttons. Never inside the signed-in app (GA's kill switch is set there). Not loaded when the browser sends Global Privacy Control or the visitor clicked "Do not sell or share my info" (footer of the public pages). `allow_google_signals` and ad personalization off, no user id, page URLs without query strings. |
| `VITE_SENTRY_DSN` | Secrets (`secrets.`) | Sentry error reports for the **signed-in app** (`@sentry/vue`, loaded as its own chunk). No PII (`sendDefaultPii: false`, no `setUser`, no component props), no replay, `tracesSampleRate: 0`; `beforeSend` strips query strings, headers (Authorization), request bodies and cookies and redacts emails/long numbers. Tags: app version, role, plan status. |
| `VITE_RELEASE` | Variables (optional) | Release tag sent to Sentry. The deploy workflow falls back to the commit SHA. |

Local test: `VITE_GA_MEASUREMENT_ID=G-XXXX VITE_SENTRY_DSN=https://…@….ingest.sentry.io/… npm run build`
and check `dist/staticwebapp.config.json`.

