/** How a visit reached us — a tagged link (utm_*), an ad click, or another website — carried to
 *  the shop system's sign-up page (growth plan 2026-11-19), where it is saved with the new shop.
 *  First-party only: kept in this browser (localStorage `dsm_attr`, shared with the landing's
 *  public/welcome-assets/visit-source.js, which follows the same rules) for up to 30 days and
 *  sent nowhere but the sign-up link. Nothing is kept for a visitor who turned analytics off or
 *  whose browser sends Global Privacy Control. */

export const ATTR_KEY = 'dsm_attr'
const TTL_MS = 30 * 24 * 3600 * 1000
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const CLICK_IDS: Record<string, string> = { gclid: 'google-ads', fbclid: 'facebook', msclkid: 'microsoft-ads' }

interface Kept {
  q: string
  at: number
}

function optedOut(): boolean {
  if ((navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return true
  try {
    return localStorage.getItem('dsm_analytics_optout') === '1'
  } catch {
    return true
  }
}

function kept(now: number): Kept | null {
  try {
    const k = JSON.parse(localStorage.getItem(ATTR_KEY) ?? 'null') as Kept | null
    return k && typeof k.q === 'string' && typeof k.at === 'number' && now - k.at <= TTL_MS && now >= k.at ? k : null
  } catch {
    return null
  }
}

/** Keeps this visit's tag, or the outside website that sent it (only when nothing is kept yet). */
export function rememberVisit(href = location.href, referrer = document.referrer, now = Date.now()): void {
  if (optedOut()) return
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return
  }
  const out = new URLSearchParams()
  let tagged = false
  for (const k of UTM) {
    const v = url.searchParams.get(k)?.trim()
    if (v) {
      out.set(k, v.slice(0, 100))
      tagged = true
    }
  }
  const click = Object.keys(CLICK_IDS).find((k) => url.searchParams.get(k))
  if (click) {
    out.set('dsm_click', CLICK_IDS[click])
    tagged = true
  }
  let ref = ''
  try {
    ref = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : ''
  } catch {
    ref = ''
  }
  // Our own sites aren't "another website".
  if (ref && !/(^|\.)dentshopmanager\.com$/.test(ref) && ref !== url.hostname) out.set('dsm_ref', ref)
  if (!tagged && !(out.get('dsm_ref') && !kept(now))) return
  out.set('dsm_landing', `${url.hostname.replace(/^www\./, '')}${url.pathname}`.slice(0, 200))
  try {
    localStorage.setItem(ATTR_KEY, JSON.stringify({ q: out.toString(), at: now }))
  } catch {
    /* storage blocked: sign-up links just carry nothing */
  }
}

/** A sign-up link with the kept visit added (only what the link doesn't already say). */
export function withVisit(signupUrl: string, now = Date.now()): string {
  const k = optedOut() ? null : kept(now)
  if (!k) return signupUrl
  try {
    const u = new URL(signupUrl)
    new URLSearchParams(k.q).forEach((v, key) => {
      if (!u.searchParams.has(key)) u.searchParams.set(key, v)
    })
    return u.toString()
  } catch {
    return signupUrl
  }
}
