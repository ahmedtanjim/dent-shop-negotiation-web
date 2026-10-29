import type { InvoiceBreakdown } from '@/api/types'

/* Which Total Loss Invoice figures the invoice card and the header's recovery balance show.
   The API's invoice is the one the PDF and every letter print — storage billed through the
   SHOP's calendar day (ShopClock), tax rounded in integer cents — so it is what the screen
   shows. The card's local preview stands in only while an edit is on its way to the server. */

/** The figures the card renders (decimal dollars). */
export interface InvoiceFigures {
  days: number
  storage: number
  subtotal: number
  tax: number
  total: number
}

export interface InvoiceView {
  figures: InvoiceFigures
  /** true = the API's invoice; false = the local preview of an unsaved edit */
  fromServer: boolean
  /** The header's "Total recovery balance". */
  headerTotal: number | null
}

/**
 * - An invalid figure: nothing saves, so the header keeps the last saved balance.
 * - An edit pending (typed but not saved, a save in flight, or the save's refresh not back
 *   yet): the preview, so the numbers follow the keystrokes.
 * - Otherwise the server's invoice. The preview is used only before it has loaded.
 */
export function invoiceView(
  server: InvoiceBreakdown | null,
  preview: InvoiceFigures,
  state: { editPending: boolean; invalid: boolean },
): InvoiceView {
  const useServer = server !== null && !state.editPending
  const figures: InvoiceFigures = useServer
    ? {
        days: server.storageDays,
        storage: server.storageTotal,
        subtotal: server.subtotal,
        tax: server.tax,
        total: server.total,
      }
    : preview
  const headerTotal = state.invalid ? (server?.total ?? null) : figures.total
  return { figures, fromServer: useServer, headerTotal }
}

/** "YYYY-MM-DD…" → a whole-day number (days since 1970-01-01), or null. Calendar days only:
 *  no time zone is applied, so the 10th stays the 10th everywhere. */
export function calendarDay(date: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(t) ? null : Math.floor(t / 86400000)
}

/**
 * The day the server bills storage through (the shop's "today"), when its invoice shows it:
 * an open range — or a saved end date past today — comes back clamped, with `storageEnd`
 * set to that day. A saved end on or before it is the user's own date and says nothing about
 * today, so the answer is null and the caller falls back to the browser's date.
 */
export function serverBillingDay(server: InvoiceBreakdown | null, savedEnd: string | null): number | null {
  const billedTo = calendarDay(server?.storageEnd)
  if (billedTo === null) return null
  const saved = calendarDay(savedEnd)
  return saved === null || saved > billedTo ? billedTo : null
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/** The browser's own calendar date at `ms`, as a whole-day number (same scale as calendarDay). */
export function localDayOf(ms: number): number {
  const n = new Date(ms)
  return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS)
}

/** The UTC calendar date at `ms`, as a whole-day number. */
export function utcDayOf(ms: number): number {
  return Math.floor(ms / DAY_MS)
}

/**
 * Whether a tab left open should re-read the invoice because the shop's "today" may have moved
 * on between two clock readings. The server bills through the shop's own day — its state's US
 * zone, or UTC with no state on file (ShopClock) — and every one of those midnights falls on a
 * whole UTC hour. So a refresh is due when:
 * - the browser's date or the UTC date turned over, or
 * - a new UTC hour began while the invoice still bills an open range (`serverDay`, from
 *   serverBillingDay) through a day before the later of those two dates: the shop's midnight
 *   is still to come (a Colorado shop seen from Chicago turns over an hour after the browser).
 */
export function dayRefreshDue(beforeMs: number, nowMs: number, serverDay: number | null): boolean {
  if (localDayOf(nowMs) !== localDayOf(beforeMs) || utcDayOf(nowMs) !== utcDayOf(beforeMs)) return true
  if (serverDay === null || Math.floor(nowMs / HOUR_MS) === Math.floor(beforeMs / HOUR_MS)) return false
  return serverDay < Math.max(localDayOf(nowMs), utcDayOf(nowMs))
}
