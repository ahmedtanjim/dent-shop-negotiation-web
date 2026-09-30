import type { RouteLocationNormalized } from 'vue-router'
import { optedOut, withoutQuery } from './privacy'

/**
 * Google Analytics 4 — PUBLIC pages only (the landing page and the sign-in page), and
 * dormant unless VITE_GA_MEASUREMENT_ID is set at build time. Never loads for a visitor
 * with Global Privacy Control on or who used "Turn off analytics". No user id,
 * no PII, no Google signals / ad personalization, and page URLs without query strings.
 * Inside the signed-in app the GA kill switch (window['ga-disable-<id>']) is set, so not
 * even GA's automatic history page views fire on case pages.
 */
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || ''

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    [key: `ga-disable-${string}`]: boolean | undefined
  }
}

let loaded = false

function allowed(): boolean {
  return !!GA_ID && !optedOut.value
}

function setDisabled(disabled: boolean) {
  if (GA_ID) window[`ga-disable-${GA_ID}`] = disabled
}

function load() {
  if (loaded) return
  loaded = true
  window.dataLayer = window.dataLayer || []
  // gtag must push the `arguments` object itself — GA ignores plain arrays.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, {
    send_page_view: false, // page views are sent explicitly, for public routes only
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: withoutQuery(window.location.href),
    page_referrer: withoutQuery(document.referrer),
  })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(s)
}

/** Called after every navigation: a public route sends one page_view; any other route
 *  switches GA off entirely. */
export function trackRoute(to: RouteLocationNormalized) {
  const isPublic = !!to.meta.public
  if (!isPublic || !allowed()) {
    setDisabled(true)
    return
  }
  load()
  setDisabled(false)
  window.gtag?.('event', 'page_view', {
    page_location: withoutQuery(window.location.href),
    page_path: to.path,
    page_title: document.title,
  })
}

/** The landing page's sign-up buttons. `placement` names which one (hero, nav, pricing…). */
export function trackSignUpClick(placement: string) {
  if (!loaded || !allowed()) return
  window.gtag?.('event', 'sign_up_click', { placement })
}

/** "Turn off analytics" was just chosen: stop now, not on the next load. */
export function stopAnalytics() {
  setDisabled(true)
}

export const analyticsConfigured = !!GA_ID
