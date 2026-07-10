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
  tiered draft panel (escalation confirm, customer-voice authorization), copilot chat
