/** "Help & support": the details we need to diagnose an account, packed into the user's
 *  OWN email draft (mailto:) or clipboard. Nothing here is sent anywhere by the app, and a
 *  password is never part of it. Pure functions — the dialog supplies the values. */

export interface SupportInfo {
  name?: string | null
  email?: string | null
  role?: string | null
  shopName?: string | null
  shopId?: string | null
  /** e.g. "Annual (Active)" — omitted while the plan is unknown. */
  plan?: string | null
  app: string
  version: string
  /** Route path only — never the query string (join / hand-off links carry secrets). */
  page: string
  signedIn: boolean
  userAgent: string
  screen?: string
  /** Defaults to now. */
  at?: Date
}

/** Browser + OS in a few words, e.g. "Chrome 141 on macOS". */
export function shortBrowser(ua: string): string {
  const m = (re: RegExp) => ua.match(re)?.[1]
  // Order matters: Edge/Opera/Samsung also say "Chrome", Chrome also says "Safari".
  const browsers: [string, RegExp][] = [
    ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+(?:\.\d+)?).*Safari\//],
  ]
  const hit = browsers.find(([, re]) => re.test(ua))
  const browser = hit ? `${hit[0]} ${m(hit[1])}` : 'Unknown browser'
  const os = /iPhone|iPad|iPod/.test(ua)
    ? `iOS ${(m(/OS (\d+(?:_\d+)?)/) ?? '').replace('_', '.')}`.trim()
    : /Android/.test(ua)
      ? `Android ${m(/Android (\d+(?:\.\d+)?)/) ?? ''}`.trim()
      : /CrOS/.test(ua)
        ? 'ChromeOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'unknown OS'
  return `${browser} on ${os}`
}

/** Local time with its zone, plus UTC for matching server logs. */
export function stampWithZone(d: Date): string {
  const local = d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  })
  let zone = ''
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* old browser */ }
  const utc = d.toISOString().slice(0, 16).replace('T', ' ')
  return `${local}${zone ? ` (${zone})` : ''} · ${utc} UTC`
}

const HEADER = 'Support details (please keep):'

/** The details block (header + "Label: value" lines). `uaMax` trims the raw user agent;
 *  0 drops it (the short browser/OS line always stays). */
export function supportDetails(info: SupportInfo, uaMax = Infinity): string {
  const lines: [string, string | null | undefined][] = info.signedIn
    ? [
        ['Name', info.name],
        ['Email', info.email],
        ['Role', info.role],
        ['Shop', info.shopName],
        ['Shop ID', info.shopId],
        ['Plan', info.plan],
      ]
    : [['Signed in', 'no']]
  lines.push(
    ['App', info.app],
    ['App version', info.version],
    ['Page', info.page],
    ['Browser', shortBrowser(info.userAgent)],
    ['Screen', info.screen],
    ['Time', stampWithZone(info.at ?? new Date())],
  )
  if (uaMax > 0) {
    const ua = info.userAgent.length > uaMax ? `${info.userAgent.slice(0, Math.max(uaMax - 1, 0))}…` : info.userAgent
    lines.push(['User agent', ua])
  }
  // Short fields are capped; the user agent is whole unless uaMax says otherwise.
  const clip = (k: string, v: string) => (k !== 'User agent' && v.length > 160 ? `${v.slice(0, 159)}…` : v)
  return [HEADER, ...lines.filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => `${k}: ${clip(k, String(v).trim())}`)].join('\n')
}

export function supportSubject(product: string, shopName?: string | null): string {
  const shop = shopName?.trim().slice(0, 80)
  return shop ? `${product} help — ${shop}` : `${product} help`
}

/** A mailto: link with the subject and a body of a blank "What happened:" section, then the
 *  details block. Kept under `maxLen` characters (some mail clients drop longer links):
 *  the raw user agent is trimmed first, then dropped, then the body is cut. */
export function supportMailto(to: string, subject: string, info: SupportInfo, maxLen = 1800): string {
  const build = (details: string) => {
    // RFC 6068: line breaks in a mailto body are CRLF.
    const body = ['What happened:', '', '', '', '---', details].join('\n').replace(/\n/g, '\r\n')
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  let url = build(supportDetails(info))
  for (let ua = info.userAgent.length; url.length > maxLen && ua > 0; ) {
    ua = ua > 80 ? Math.floor(ua * 0.7) : 0
    url = build(supportDetails(info, ua))
  }
  if (url.length > maxLen) {
    // Still too long (an absurd shop/user name): drop whole lines from the end.
    const lines = supportDetails(info, 0).split('\n')
    while (url.length > maxLen && lines.length > 1) {
      lines.pop()
      url = build(lines.join('\n'))
    }
  }
  return url
}

/** Copies text, falling back to a hidden textarea where the async clipboard is missing or
 *  blocked (http origins, older Safari). Resolves false when both fail. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
