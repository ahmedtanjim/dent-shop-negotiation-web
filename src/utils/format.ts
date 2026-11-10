const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function centsToUsd(cents: number): string {
  return usdFormat.format(cents / 100)
}

/** Format decimal dollars (the wire format for fees/invoices). */
export function usd(dollars: number): string {
  return usdFormat.format(dollars)
}

/** Format a date-only value (UTC midnight on the wire) without timezone day-shift. */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]

/** A single-line field as it should be stored: runs of spaces/tabs/newlines collapsed to
 *  one space, trimmed; empty becomes null. ("E2E-NEG  jane   doe" → "E2E-NEG jane doe") */
export function oneLine(v: string | null | undefined): string | null {
  const t = (v ?? '').replace(/\s+/g, ' ').trim()
  return t ? t : null
}

/** When the shop's daily AI allowance comes back, in the viewer's own time zone. The API
 *  resets the window at a fixed instant (`resetsAt`, midnight UTC — evening in the US), so
 *  "midnight UTC" means nothing to a shop: show the clock time it is for them, naming the day
 *  when it is not today. The phrase carries its own preposition so it drops straight into
 *  "It resets …" / "drafting resumes …": "at 7:00 PM your time", "tomorrow at 8:00 AM your
 *  time", "on Nov 6 at 8:30 AM your time". */
export function dailyResetLabel(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const dayNo = (x: Date) => Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86_400_000)
  const ahead = dayNo(d) - dayNo(now)
  if (ahead <= 0) return `at ${time} your time`
  if (ahead === 1) return `tomorrow at ${time} your time`
  return `on ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time} your time`
}
