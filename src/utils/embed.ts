import { CRM_URL } from '@/api/client'

/** DSM Negotiator inside the shop system's car page (the black "DSM Negotiator" tab on
 *  app.dentshopmanager.com/claims/:id/negotiator, owner 2026-11-26: "the whole negotiator page
 *  rests inside that tab on desktop, that way users don't have to switch between systems").
 *
 *  Only the shop system may frame this app (staticwebapp.config.json `frame-ancestors`). While
 *  framed:
 *  - the session lives in sessionStorage, never localStorage, so the frame signs in as whoever
 *    the shop system's tab is signed in as without moving the session of a Negotiator tab open
 *    elsewhere in the same browser (another shop, another person);
 *  - sign-in is the PKCE hand-off over postMessage (`/embed`, EmbedView): this frame keeps the
 *    verifier and sends only the challenge to its parent; the parent mints the code with its own
 *    session and posts it back; this frame exchanges code + verifier. The shop system is never
 *    framed and no token crosses the window boundary;
 *  - the top bar is hidden (the shop system's page is the chrome) and anything that would leave
 *    the app (Stripe, the shop system's pages) opens in a new tab.
 *
 *  Message types are a versioned contract shared with dent-shop-web `src/data/negotiatorEmbed.ts`
 *  — change both together. */

export const MSG = {
  /** frame → parent: `{ type, v: 1, challenge }` — please mint a hand-off code for this challenge. */
  handoffRequest: 'dsm-negotiator:handoff-request',
  /** parent → frame: `{ type, v: 1, code }` or `{ type, v: 1, error }`. */
  handoffCode: 'dsm-crm:handoff-code',
  /** parent → frame: `{ type, v: 1, theme: 'light' | 'dark' }` — follow the shop system's theme. */
  theme: 'dsm-crm:theme',
  /** frame → parent: `{ type, v: 1, path }` — where the frame is now (the parent's "Open in new
   *  window" link follows it). */
  location: 'dsm-negotiator:location',
} as const

let cached: boolean | null = null

/** True when this page runs inside another page (the shop system's car tab). */
export function isEmbedded(): boolean {
  if (cached !== null) return cached
  try {
    cached = window.self !== window.top
  } catch {
    cached = true // a cross-origin parent can make even the comparison throw in old browsers
  }
  return cached
}

/** For tests. */
export function resetEmbedCache(value: boolean | null = null): void {
  cached = value
}

/** Where the session is kept: this frame's own sessionStorage when embedded, else the
 *  browser-wide localStorage as before. */
export function sessionStore(): Storage {
  return isEmbedded() ? window.sessionStorage : window.localStorage
}

/** The parent window, but only for messages to the shop system's own origin. */
export function postToParent(msg: Record<string, unknown>): void {
  if (!isEmbedded()) return
  try {
    window.parent.postMessage({ v: 1, ...msg }, CRM_URL)
  } catch {
    /* the parent went away */
  }
}

/** Whether a message really comes from the shop system that frames us. */
export function fromParent(e: MessageEvent): boolean {
  return e.origin === CRM_URL && e.source === window.parent && !!e.data && typeof e.data === 'object'
}

/** Leave the app for another site: a new tab when embedded (Stripe and the shop system's pages
 *  refuse to be framed, and the car page should stay where it is), else this tab. */
export function leaveTo(url: string, newTab = false): void {
  if (newTab || isEmbedded()) window.open(url, '_blank', 'noopener')
  else window.location.href = url
}
