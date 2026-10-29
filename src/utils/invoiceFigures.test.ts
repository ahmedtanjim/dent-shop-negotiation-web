import { describe, expect, it } from 'vitest'
import type { InvoiceBreakdown } from '@/api/types'
import { calendarDay, invoiceView, serverBillingDay, type InvoiceFigures } from './invoiceFigures'

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
