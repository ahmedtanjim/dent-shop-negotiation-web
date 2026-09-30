import type { App } from 'vue'
import type { ErrorEvent, Breadcrumb } from '@sentry/vue'
import { withoutQuery } from './privacy'

/**
 * Error reporting for the SIGNED-IN app — dormant unless VITE_SENTRY_DSN is set at build
 * time (then @sentry/vue loads as its own chunk, once signed in). Privacy rules:
 *  - no PII: sendDefaultPii off, never setUser, component props not attached;
 *  - no session replay, no performance tracing (tracesSampleRate 0);
 *  - beforeSend drops request bodies, headers (Authorization included), cookies, query
 *    strings, extra data, and redacts emails / long numbers from messages;
 *  - breadcrumbs keep navigation + request URLs (query stripped) only — no console text,
 *    no clicked-element text, no typed input;
 *  - events from signed-out pages are dropped;
 *  - tags: app version, role, plan status. Nothing else.
 */
const DSN = import.meta.env.VITE_SENTRY_DSN?.trim() || ''
const RELEASE = import.meta.env.VITE_RELEASE?.trim() || undefined
const TOKEN_KEY = 'dsm_neg_token'

type SentryModule = typeof import('@sentry/vue')
let sentry: SentryModule | null = null
const pendingTags: Record<string, string> = {}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const LONG_NUMBER = /\b\d[\d -]{6,}\d\b/g
const URL_WITH_QUERY = /(https?:\/\/[^\s?#"']+)[?#][^\s"']*/gi

export function scrubText(s: string | undefined): string | undefined {
  if (!s) return s
  return s.replace(URL_WITH_QUERY, '$1').replace(EMAIL, '[email]').replace(LONG_NUMBER, '[number]')
}

function signedIn(): boolean {
  try {
    return !!localStorage.getItem(TOKEN_KEY)
  } catch {
    return false
  }
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (!signedIn()) return null
  delete event.user
  delete event.extra
  delete event.server_name
  if (event.request) {
    event.request = { url: event.request.url ? withoutQuery(event.request.url) : undefined }
  }
  event.message = scrubText(event.message)
  for (const ex of event.exception?.values ?? []) ex.value = scrubText(ex.value)
  if (event.contexts) {
    // Vue's context can carry component props / route params; keep only the component name.
    const vue = event.contexts.vue as Record<string, unknown> | undefined
    event.contexts = { ...event.contexts, vue: vue ? { componentName: vue.componentName } : undefined }
    delete (event.contexts as Record<string, unknown>).state
  }
  event.breadcrumbs = (event.breadcrumbs ?? []).map(scrubBreadcrumb).filter((b): b is Breadcrumb => !!b)
  return event
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  const category = b.category ?? ''
  if (category === 'console' || category.startsWith('ui.')) return null
  const data = b.data ? { ...b.data } : undefined
  if (data) {
    for (const k of ['url', 'from', 'to']) if (typeof data[k] === 'string') data[k] = withoutQuery(data[k] as string)
    delete data.body
    delete data.request_body
    delete data.response_body
  }
  return { ...b, message: category === 'navigation' || category === 'fetch' || category === 'xhr' ? undefined : scrubText(b.message), data }
}

let starting: Promise<void> | null = null

/** Loads @sentry/vue (its own ~150 KB chunk) the first time a signed-in page is shown.
 *  Events from signed-out pages are dropped anyway, so the landing and sign-in pages never
 *  download it. Safe to call on every navigation. */
export function initSentry(app: App): Promise<void> {
  if (!DSN || !signedIn()) return Promise.resolve()
  return (starting ??= start(app))
}

async function start(app: App): Promise<void> {
  const S = await import('@sentry/vue')
  S.init({
    app,
    dsn: DSN,
    release: RELEASE,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    // SDK v10+ spells the same rule per category (and ignores sendDefaultPii when this is
    // set): collect none of it. beforeSend below scrubs again regardless.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    attachProps: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendClientReports: false,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
  })
  if (RELEASE) S.setTag('app_version', RELEASE)
  for (const [k, v] of Object.entries(pendingTags)) S.setTag(k, v)
  sentry = S
}

/** Role and plan status only — never who the user is. */
export function setSentryTags(tags: { role?: string | null; plan?: string | null }) {
  for (const [k, v] of Object.entries(tags)) {
    const value = v ?? 'unknown'
    pendingTags[k] = value
    sentry?.setTag(k, value)
  }
}

export const sentryConfigured = !!DSN
