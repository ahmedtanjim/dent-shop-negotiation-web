import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { InvoiceBreakdown } from '@/api/types'
import {
  calendarDay,
  dayRefreshDue,
  invoiceView,
  localDayOf,
  serverBillingDay,
  type InvoiceFigures,
} from './invoiceFigures'

/** The API's invoice: storage billed through the shop's day (2026-10-29 here). */
const server: InvoiceBreakdown = {
  adminFee: 150,
  lotFee: 75,
  storageStart: '2026-10-20',
  storageEnd: '2026-10-29',
  storageDays: 10,
  storagePerDay: 50,
  storageTotal: 500,
  taxPercent: 8.25,
  tax: 59.81,
  subtotal: 725,
  total: 784.81,
}
/** The card's local math for an edit — one day more (the browser is already on the 30th). */
const preview: InvoiceFigures = { days: 11, storage: 550, subtotal: 775, tax: 63.94, total: 838.94 }

describe('invoiceView', () => {
  it('nothing pending: the server figures and the server total', () => {
    const v = invoiceView(server, preview, { editPending: false, invalid: false })
    expect(v.fromServer).toBe(true)
    expect(v.figures).toEqual({ days: 10, storage: 500, subtotal: 725, tax: 59.81, total: 784.81 })
    expect(v.headerTotal).toBe(784.81)
  })

  it('an edit pending: the preview, and the header follows it', () => {
    const v = invoiceView(server, preview, { editPending: true, invalid: false })
    expect(v.fromServer).toBe(false)
    expect(v.figures).toBe(preview)
    expect(v.headerTotal).toBe(838.94)
  })

  it('an invalid figure: the header keeps the last saved total', () => {
    const v = invoiceView(server, preview, { editPending: true, invalid: true })
    expect(v.figures).toBe(preview)
    expect(v.headerTotal).toBe(784.81)
  })

  it('no invoice loaded yet: the preview (and no saved total to fall back on)', () => {
    const v = invoiceView(null, preview, { editPending: false, invalid: false })
    expect(v.fromServer).toBe(false)
    expect(v.figures).toBe(preview)
    expect(v.headerTotal).toBe(838.94)
    expect(invoiceView(null, preview, { editPending: false, invalid: true }).headerTotal).toBeNull()
  })
})

describe('calendarDay', () => {
  it('a plain date is its day number', () => {
    expect(calendarDay('1970-01-02')).toBe(1)
    expect(calendarDay('2026-10-29')! - calendarDay('2026-10-20')!).toBe(9)
  })

  it('a date-time keeps its calendar date, whatever the zone', () => {
    expect(calendarDay('2026-10-29T23:30:00-05:00')).toBe(calendarDay('2026-10-29'))
    expect(calendarDay('2026-10-29T00:30:00+09:00')).toBe(calendarDay('2026-10-29'))
  })

  it('empty, null and junk are null', () => {
    for (const v of ['', null, undefined, 'soon', '10/29/2026']) expect(calendarDay(v), String(v)).toBeNull()
  })
})

describe('serverBillingDay', () => {
  const billedTo = calendarDay('2026-10-29')

  it('an open range: the server billed through its own day', () => {
    expect(serverBillingDay(server, null)).toBe(billedTo)
  })

  it('a saved end after that day was clamped to it: the server day', () => {
    expect(serverBillingDay(server, '2026-10-30')).toBe(billedTo)
  })

  it('a saved end on or before it is the user date, not "today": unknown', () => {
    expect(serverBillingDay(server, '2026-10-29')).toBeNull()
    expect(serverBillingDay(server, '2026-10-25')).toBeNull()
  })

  it('no end date on the invoice, or no invoice: unknown', () => {
    expect(serverBillingDay({ ...server, storageEnd: null }, null)).toBeNull()
    expect(serverBillingDay(null, null)).toBeNull()
  })
})

describe('dayRefreshDue', () => {
  // A Chicago browser in late October (UTC-5): its midnight is 05:00 UTC.
  const savedTz = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/Chicago'
  })
  afterAll(() => {
    if (savedTz === undefined) delete process.env.TZ
    else process.env.TZ = savedTz
  })
  const at = (iso: string) => new Date(iso).getTime()
  const oct29 = calendarDay('2026-10-29')
  const oct30 = calendarDay('2026-10-30')

  it('the browser and UTC day numbers', () => {
    expect(localDayOf(at('2026-10-30T04:59:00Z'))).toBe(oct29) // 11:59 pm in Chicago
    expect(localDayOf(at('2026-10-30T05:00:00Z'))).toBe(oct30)
  })

  it("the browser's date turns over: due, whatever the invoice says", () => {
    expect(dayRefreshDue(at('2026-10-30T04:59:30Z'), at('2026-10-30T05:00:30Z'), null)).toBe(true)
  })

  it('the UTC date turns over while the browser is still on its day (a shop with no state): due', () => {
    expect(dayRefreshDue(at('2026-10-29T23:59:30Z'), at('2026-10-30T00:00:30Z'), null)).toBe(true)
  })

  it("a Colorado shop seen from Chicago: due at Denver's midnight, an hour after the browser's", () => {
    // The refresh at Chicago midnight still came back on Denver's 29th.
    expect(dayRefreshDue(at('2026-10-30T05:59:30Z'), at('2026-10-30T06:00:30Z'), oct29)).toBe(true)
  })

  it('a new UTC hour once the server is on the later date: not due', () => {
    expect(dayRefreshDue(at('2026-10-30T05:59:30Z'), at('2026-10-30T06:00:30Z'), oct30)).toBe(false)
  })

  it('a new UTC hour with no open range (or no invoice yet): not due', () => {
    expect(dayRefreshDue(at('2026-10-30T05:59:30Z'), at('2026-10-30T06:00:30Z'), null)).toBe(false)
  })

  it('a tick inside the same UTC hour, even with the server behind: not due', () => {
    expect(dayRefreshDue(at('2026-10-30T05:30:00Z'), at('2026-10-30T05:31:00Z'), oct29)).toBe(false)
  })

  it('a tab woken after hours: due when the server is behind the date now', () => {
    expect(dayRefreshDue(at('2026-10-30T05:10:00Z'), at('2026-10-30T09:00:00Z'), oct29)).toBe(true)
  })
})
