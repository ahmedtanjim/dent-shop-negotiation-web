import { ref } from 'vue'

/** "Turn off analytics" — remembered per browser. Global Privacy Control counts
 *  as the same choice without the visitor having to click anything. */
const OPT_OUT_KEY = 'dsm_neg_analytics_opt_out'

function readOptOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export const gpcEnabled = typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true
export const optedOut = ref(readOptOut() || gpcEnabled)

export function optOutOfSharing() {
  optedOut.value = true
  try {
    localStorage.setItem(OPT_OUT_KEY, '1')
  } catch {
    /* storage blocked — the in-memory flag still stops analytics for this visit */
  }
}

/** Strip query string and fragment: page URLs never carry search terms, tokens or ids to
 *  an analytics vendor (the hand-off link carries a one-time code in ?code=). */
export function withoutQuery(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url, window.location.origin)
    return `${u.origin}${u.pathname}`
  } catch {
    return url.split(/[?#]/)[0]
  }
}
