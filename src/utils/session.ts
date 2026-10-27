import { refreshSession } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

/** Keeps a Negotiator session alive and current, like the shop system does (corner-case #46):
 *  sessions last 7 days from sign-in, so one left open used to die mid-save on day 7 and throw
 *  the edit away. Renews once the token is a day old, and at most every 10 minutes on focus so a
 *  role change or a removal from the shop is picked up without signing out. */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000
const RECHECK_MS = 10 * 60 * 1000
let lastCheck = 0
let inFlight: Promise<void> | null = null

function issuedAt(token: string): number | null {
  try {
    const part = token.split('.')[1]
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.iat === 'number' ? json.iat * 1000 : null
  } catch {
    return null
  }
}

export function keepSessionFresh(force = false): Promise<void> {
  const auth = useAuthStore()
  if (!auth.token || inFlight) return inFlight ?? Promise.resolve()
  const now = Date.now()
  const iat = issuedAt(auth.token)
  const old = iat === null || now - iat > RENEW_AFTER_MS
  if (!force && !old && now - lastCheck < RECHECK_MS) return Promise.resolve()
  lastCheck = now
  const shopBefore = auth.shopId
  inFlight = refreshSession()
    .then((r) => {
      auth.setSession(r)
      // Taken off this shop meanwhile: the session moved to another one — reload onto it.
      if (shopBefore && r.shopId !== shopBefore) window.location.assign('/cases')
    })
    .catch(() => { /* a dead session is handled by the 401 path */ })
    .finally(() => { inFlight = null })
  return inFlight
}

/** Call once at start-up: renew on focus and every half hour while the tab is open. */
export function startSessionKeeper() {
  void keepSessionFresh()
  window.addEventListener('focus', () => void keepSessionFresh())
  setInterval(() => void keepSessionFresh(), 30 * 60 * 1000)
}
