# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**DSM Negotiator** — the standalone web app for the AI insurance-negotiation product of Dent Shop
Manager (hail/PDR auto-body shops). Live at https://ai.dentshopmanager.com. GitHub:
`ahmedtanjim/dent-shop-negotiation-web`.

- **A thin client over `dent_shop_api`** (`../dent_shop_api`, .NET). All AI drafting, tactic
  analysis, legal citations/guardrails, the Total Loss Invoice math, billing and entitlements live
  in the API. This app only renders and posts. Never add legal reasoning, prompt text, money math
  or plan gating logic here; if the client needs it, the API should return it.
- **One account with the CRM** (`../dent_shop_manager_web`, app.dentshopmanager.com). Sign-up and
  billing live on the CRM: `/register` redirects to `${CRM_URL}/signup?plan=ai&next=negotiator`.
  The two apps do **not** share a session (this app uses `localStorage` keys `dsm_neg_*`); they hand
  the user across with a one-time code bound to the receiving tab (PKCE, `src/utils/pkce.ts`):
  - CRM → here: the CRM opens `/auth/handoff/start?redirect=…` (`HandoffStartView`), which keeps a
    verifier in this tab and sends its challenge to `${CRM_URL}/auth/handoff/out`; the CRM mints the
    code and returns to `/auth/handoff?code=…&redirect=…` (`HandoffView`), which calls
    `POST /api/auth/handoff/exchange` with code + verifier (asks before switching to a different
    account). A link minted in another browser fails here — that's the point.
  - Here → CRM: `goToCrm(path)` opens `${CRM_URL}/auth/handoff/start?next=…`; the CRM's tab keeps the
    verifier and calls our `/auth/handoff/out` (`HandoffOutView`), which mints with
    `POST /api/auth/handoff {shopId, challenge}` — straight on when it came from the CRM, otherwise
    after a "Continue" — and sends the code back. Signed out here: the plain CRM URL.
- `/terms` and `/privacy` hop to the CRM's pages (one policy for both apps).

## Commands

```bash
npm install
npm run dev       # Vite on http://localhost:5174 (the API's dev CORS allows 5173 + 5174)
npm test          # Vitest unit tests (happy-dom), once; `npm run test:watch` re-runs on save
npm run build     # vue-tsc -b (type-check, tests included) + vite build -> dist/
npm run preview   # serve dist/ (the landing at /welcome.html; `/` is the SWA rewrite in production)
```

`npm test` then `npm run build` is the CI gate. There is no `build:all`, `build:site` or lint script
on `main` (see Marketing site).
Locally the API must run on `http://localhost:5080` (`dotnet run --project src/DentShop.Presentation`
in `dent_shop_api`). Without `Anthropic:ApiKey` the API uses a deterministic fake assistant, so
every flow works with placeholder drafts. "Back to the shop" links go to `http://localhost:5173`
(the CRM dev server) unless `VITE_CRM_URL` is set.

## Structure

Vue 3.5 + TypeScript + Vite 6 + Pinia 2 + vue-router 4; `lucide-vue-next` icons, `driver.js`
tours, `@sentry/vue` (lazy). `@/` aliases `src/`. No markdown or UI library.

- `src/main.ts` — app bootstrap; reload-once on `vite:preloadError`; `watchForNewBuild`; lazy Sentry.
- `src/App.vue` — top bar, theme toggle, help (?) menu (replay walkthrough / Help & support), 402
  subscription banner, 429 fair-use banner, paywall watcher; mounts `HelpSupportModal`.
- `src/router/index.ts` — routes + the auth/plan guard; `setTitle`, SEO and GA per route.
- `src/api/` — `client.ts` (fetch wrapper: bearer, 401 → `/login?redirect=`, 402/429 handling,
  `ApiError{status, code, body}`, `download()`), `auth`, `handoff`, `billing`, `usage`,
  `negotiation` (all case endpoints under `/api/shops/{shopId}/negotiation`), `customers`,
  `shops`, `support` (support address from the public `GET /api/app/contact`, API setting
  `App:SupportEmail`; fallback `dentshopmanager@gmail.com`; loaded in `main.ts`), `types.ts`
  (wire DTOs — keep in step with the API's `Dtos/`).
- `src/stores/` — `auth` (session in `localStorage`), `entitlement` (the shop's plan; "unknown" is
  never treated as the AI plan).
- `src/views/` — `LoginView`, `HandoffView`,
  `PaywallView` (`/upgrade`), `CasesView` (`/cases`), `CaseWorkspaceView` (`/cases/:id`), `NotFoundView`.
- `src/components/` — `TimelinePanel` (the correspondence docket: paste/.eml intake, tactic read,
  mark-sent), `DraftPanel` + `DraftQuestions` (drafting), `CaseSidebar` (case fields, facts,
  documents), `InvoiceCard` (Total Loss Invoice + PDF), `LetterColumns` (generated letters),
  `BlanksNotice`, `NewCaseModal`, `CustomerPicker` (CRM customers), `ShopRatesModal`,
  `HelpSupportModal` (Help & support), `DateField`,
  `StatusPill`, `TacticBadge`, `PrivacyChoicesLink`.
- Unit tests sit next to the code as `*.test.ts` (Vitest + happy-dom + `@vue/test-utils`,
  `vitest.config.ts`).
- `src/utils/` — `letterMarkdown` (letter renderer + rich clipboard), `placeholders` (blank
  detection), `theme`, `format` (cents/dollars/dates), `amount` (strict money parsing),
  `safeRedirect` (the one `?redirect` / `?next` rule), `freshBuild`, `seo`, `uploads` (25 MB limit), `caseBody`, `emlHeaders`, `flushOnLeave`, `escapeToClose`,
  `help` (`openHelp()`), `supportReport` (support details / mailto builder; same file as the CRM's).
- `src/analytics/` — `ga.ts`, `sentry.ts`, `privacy.ts` (opt-out + Global Privacy Control).
- `src/tour.ts` + `src/styles/tour.css` — driver.js tours on `[data-tour]` anchors.
- `public/staticwebapp.config.json` — SWA routing fallback, cache headers, security headers + CSP.
- `public/welcome.html` + `public/welcome-assets/` — the public landing page at `/` (SWA
  rewrite, with its own CSP allowing Webflow's image/video hosts). It is a static copy of the
  Webflow page "AI site home", rendered through `dent_shop_home`'s `Webflow.astro` layout, with
  inline scripts moved to `welcome-assets/welcome-N.js` (CSP) and relative links made absolute to
  dentshopmanager.com. To update it: export the Webflow page (dent_shop_home `webflow-export/SPEC.md`),
  build it there as a temporary page, and redo those steps. `/welcome` 301s to `/`; `welcome-0.js` sends a signed-in visitor to `/cases`. The SPA's `/` route (`welcome`) goes to the cases when signed in and otherwise leaves the SPA for it.

## Key flows

1. **Case** — `NewCaseModal` → `createCase`; the list (`CasesView`) and workspace load via `getCase`.
2. **Correspondence** — `TimelinePanel`: paste an adjuster email (`extractPaste` pre-fills
   sender, subject and date) or drop an `.eml` (`intakeEml`); the API saves it and returns its **tactic** and an
   AI read (`analysisSummary`), shown as `TacticBadge` + "AI read". Letters the shop sent are logged
   without analysis. Newest first.
3. **Questions before drafting** — `DraftPanel.generate()` first calls `POST …/drafts/questions`
   (at most 3; `DraftQuestions` renders them, every one skippable), then `POST …/drafts` with the
   answers. 400/402/403/429 from the questions call is shown as the refusal; any other failure
   drafts without questions. No tone picker: the API picks the rung and returns it as a badge.
   Customer-voice drafts require the authorization checkbox; litigation cases cannot draft.
4. **No `[BLANKS]` in letters** (owner rule 2026-10-03). The API writes around missing facts and
   returns them as `missing`; `BlanksNotice` lists them (profile items link to CRM Settings).
   `placeholders.ts` / `<mark class="blank-mark">` exist only for older letters that still carry one.
5. **Documents** — `getGeneratedDocs` (invoice breakdown + ready-made letters + `missing`),
   `downloadInvoicePdf`, case document upload/download/delete, the fact ledger (`addFact`/`deleteFact`).
   `getChat`/`sendChat` (copilot) exist in `api/negotiation.ts` but no UI calls them yet.
6. **Paywall / AI plan** — the router guard loads the entitlement once per shop; below the AI tier
   every signed-in page redirects to `/upgrade`. A mid-session 402 `ai_required` sets
   `aiPlanRequired` and `App.vue` re-reads the plan and opens the paywall. Other 402s show the
   subscription banner. A failed plan lookup leaves pages open (the API's 402 is the real gate).
   Checkout/portal go through `api/billing.ts`; a 409 `charge_confirmation_required` must be
   confirmed and re-sent with `confirmCharge`. Only the owner changes the plan.
7. **Fair-use caps** — 429 `ai_cap_daily` / `ai_cap_monthly` sets `aiCapNotice` (banner with reset
   time). `CasesView` shows a monthly usage meter (`GET /api/shops/{id}/ai-usage`) to
   owner/manager/admin; a failed read just hides it.

## Conventions

- **Help & support** (help (?) menu in the top bar, "Need help?" on `/login`): a `mailto:` to the
  support address with a blank "What happened:" section and a "Support details" block (name, email
  from `GET /api/auth/me`, role, shop name + id, plan, app, `VITE_RELEASE`, route **path only**,
  browser/OS, time + zone), or a copy of that block. Nothing is sent by the app; never add a
  password or query string. mailto stays ≤ 1,800 chars (user agent trimmed first).

- **Colours come from theme tokens in `src/style.css`** (`--bg`, `--panel`, `--text`, `--accent`,
  `--danger`, …). `:root` is the dark default; `:root[data-theme='light']` overrides; `utils/theme.ts`
  sets `data-theme` on `<html>` (stored as `dsm_neg_theme`). A print block forces the light palette.
  Never hard-code a colour in a component; derive tints with `color-mix(in srgb, var(--accent) N%, transparent)`.
  Check every UI change in **both** themes (a hard-coded dark navy nav and lilac badge made the
  welcome page unreadable in light mode).
- **Letters render through `utils/letterMarkdown`** (tiny Markdown: `**bold**`, `- `/`1. ` lists),
  which HTML-escapes everything first (inbound emails pass through it too) and builds the rich-text
  clipboard copy. Don't add a markdown library or `v-html` raw API text.
- **Money:** fees and invoices travel as decimal dollars (`usd()`), cent fields as integers
  (`centsToUsd()`); typed money is parsed strictly (`utils/amount`). The client never computes totals
  the API owns.
- **In-app copy never says "playbook" or a state count** (identifiers like `hasPlaybook` are fine).
  Say "attorney-reviewed citations". The product name is "DSM Negotiator".
- Use `ApiError.code` for branching, not message text. New endpoints go in the matching `src/api/*.ts`
  with types in `types.ts`.

## Env vars (build-time, `import.meta.env`, declared in `env.d.ts`)

| Var | Purpose |
| --- | --- |
| `VITE_API_BASE` | API origin. Default `http://localhost:5080`. Deploy: repo secret. |
| `VITE_CRM_URL` | CRM origin. Default `http://localhost:5173` in dev, `https://app.dentshopmanager.com` in prod. Not set by the workflow. |
| `VITE_GA_MEASUREMENT_ID` | GA4, public pages (`/`, `/login`) only; off under GPC/opt-out. Repo variable. |
| `VITE_SENTRY_DSN` | Sentry for the signed-in app; no PII. Repo secret. |
| `VITE_RELEASE` | Sentry release tag; workflow falls back to the commit SHA. |

All analytics is dormant when unset. `vite.config.ts`'s `analyticsCsp` plugin adds GA/Sentry hosts
to the **built** `dist/staticwebapp.config.json` CSP only when those vars are set. Deploy also uses
the secret `AZURE_SWA_TOKEN`. Never commit values.

## Marketing site (`site/`)

On `main`, `site/` is only a stub: `site/src/pages/index.astro` plus a committed `.astro/` cache. It
imports `../layouts/Base.astro`, which is not on `main`, and there is no `site/package.json`, so it is
neither built nor deployed. The public landing that ships today is `public/welcome.html` at `/` (the cases list is `/cases`; `/pricing` signed out goes to dentshopmanager.com/pricing). The full Astro site, `build:site`/`build:all`
(`scripts/merge-dist.mjs`) and moving the Vue app under `/app/` exist only on the unmerged branch
`feat/ai-paywall`. **Today the app is served at the root in both dev and production** (no Vite
`base`, `createWebHistory()` with no base, hard-coded `/login` in `client.ts`).

## Deploy

`.github/workflows/deploy-web.yml` ("Deploy Web") runs on **push to `main`** and `workflow_dispatch`.
Job `test`: Node 20, `npm ci`, `npm test`, `npm run build`. Job `deploy` (needs `test`) targets the
GitHub Environment **`dev`**, which has a required-reviewer approval gate, then
`Azure/static-web-apps-deploy@v1` builds with the env vars above and uploads `dist` to the Static Web App `dentshop-negotiator-dev`.
Approving that gate is a deploy: only on the owner's explicit "deploy".

## Testing / verification

`npm test` (Vitest, `*.test.ts` next to the code) and `npm run build` must pass before
committing. Security- and money-critical helpers (the letter renderer before `v-html`,
`safeRedirect`, `amount`, the Sentry scrubbers, PKCE) have suites; add a test with every fix to a
helper, store or view rule. For UI changes, also run the app against the local API, exercise the
flow, and check light + dark and a phone width. The draft quality rules (no blanks, citations) are
tested in the API's eval harness, not here.

## Gotchas

- `../dent_shop_api/clients/negotiation-web/` is a stale old copy of this app. Don't edit it.
- The CSP `connect-src` in `public/staticwebapp.config.json` lists the API host. If `VITE_API_BASE`
  moves off `dentshop-api-dev.azurewebsites.net` / `*.dentshopmanager.com`, update the CSP or every
  call fails in production only.
- Stale tabs: `main.ts` reloads once on a missing chunk, and `freshBuild.ts` compares the hashed entry
  script with the live `index.html` (every 10 min). Keep the entry script under `/assets/`.
- A 401 only logs out when a token was sent; `/api/auth/login` and `/handoff/exchange` 401s are
  wrong-credential answers.
- Always drain response bodies (see `request()`): an unread 204 shows up as `net::ERR_ABORTED`.

## Workflow

- Branch off `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`. `npm test` and `npm run build` pass before any push.
- Nothing is pushed to `main` or deployed (and the `dev` gate is never approved) without the owner's
  explicit "deploy" for that change. Pushing `main` starts a deploy.
- Merge and push `main` from a dedicated worktree
  (`git worktree add ../.dsm-worktrees/<name> origin/main`); the main checkout may hold another
  session's branch and WIP.
- Any change that alters structure, commands, env vars or deploy updates this CLAUDE.md in the same commit.
