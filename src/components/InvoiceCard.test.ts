import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CaseDetail, InvoiceBreakdown } from '@/api/types'

const neg = vi.hoisted(() => ({ updateCase: vi.fn(async () => ({})), downloadInvoicePdf: vi.fn() }))
vi.mock('@/api/negotiation', () => neg)
vi.mock('@/api/handoff', () => ({ goToCrm: vi.fn() }))

import InvoiceCard from './InvoiceCard.vue'
import { useAuthStore } from '@/stores/auth'

// A US browser (UTC-5 in late October): its day turns over five hours after UTC's.
const savedTz = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/Chicago'
})
afterAll(() => {
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
})

const detail = {
  case: {
    id: 'case-1',
    title: 'Smith — 2021 Tahoe',
    status: 'Open',
    insurerName: null,
    insurerClaimNumber: null,
    customerName: 'Smith',
    state: null,
    invoiceTotalCents: 0,
  },
  adjusterName: null,
  adjusterEmail: null,
  adjusterPhone: null,
  vehicleDescription: null,
  storagePerDayCents: 5000,
  notes: null,
  customerId: null,
  adminFee: null,
  lotFee: null,
  salesTaxPercent: null,
  storageStartDate: '2026-10-20',
  storageEndDate: null,
} as unknown as CaseDetail

/** The API's invoice: 10 days through the shop's day, no tax. */
const server: InvoiceBreakdown = {
  adminFee: 100,
  lotFee: 0,
  storageStart: '2026-10-20',
  storageEnd: '2026-10-29',
  storageDays: 10,
  storagePerDay: 50,
  storageTotal: 500,
  taxPercent: 0,
  tax: 0,
  subtotal: 600,
  total: 600,
}

function mountCard(invoice: InvoiceBreakdown = server, caseDetail: CaseDetail = detail) {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  return mount(InvoiceCard, {
    props: { detail: caseDetail, invoice, refreshError: null },
    global: { stubs: { DateField: true } },
  })
}
const total = (w: ReturnType<typeof mountCard>) => w.get('.line.total .val').text()

describe('InvoiceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake the clock and timers, but not setImmediate (flushPromises needs it).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks for a refresh when the UTC day turns over, even though the browser is still on its day', () => {
    vi.setSystemTime(new Date('2026-10-29T23:59:30Z')) // 6:59 pm in Chicago
    const w = mountCard()
    vi.advanceTimersByTime(60_000) // 00:00:30 UTC, 7:00 pm in Chicago
    expect(new Date().getDate()).toBe(29) // the browser's own date has not moved
    expect(w.emitted('refresh')).toHaveLength(1)
  })

  it("a shop west of the browser: refreshes at the shop's midnight, not only the browser's", () => {
    // 12:59 am in Chicago, 11:59 pm in Denver: the refresh at Chicago midnight came back with a
    // Colorado shop's invoice still billed through the 29th.
    vi.setSystemTime(new Date('2026-10-30T05:59:30Z'))
    const w = mountCard()
    vi.advanceTimersByTime(60_000) // midnight in Denver
    expect(w.emitted('refresh')).toHaveLength(1)
    vi.advanceTimersByTime(30 * 60_000) // the rest of the hour: nothing more
    expect(w.emitted('refresh')).toHaveLength(1)
  })

  it('no hourly refresh once the server is on the date, or for a closed range', () => {
    vi.setSystemTime(new Date('2026-10-30T05:59:30Z'))
    const caughtUp = mountCard({ ...server, storageEnd: '2026-10-30', storageDays: 11 })
    const closed = mountCard({ ...server, storageEnd: '2026-10-25', storageDays: 6 }, {
      ...detail,
      storageEndDate: '2026-10-25',
    })
    vi.advanceTimersByTime(60_000)
    expect(caughtUp.emitted('refresh')).toBeUndefined()
    expect(closed.emitted('refresh')).toBeUndefined()
  })

  it('shows the server invoice, the preview while an edit saves, and the server invoice again when the reload fails', async () => {
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'))
    const w = mountCard()
    expect(total(w)).toBe('$600.00')

    await w.get('input[aria-label="Admin fee, dollars"]').setValue('150')
    expect(total(w)).toBe('$650.00') // preview follows the keystrokes
    vi.advanceTimersByTime(800) // the debounced save
    await flushPromises()
    expect(neg.updateCase).toHaveBeenCalledTimes(1)
    expect(w.emitted('refresh')).toHaveLength(1)
    expect(total(w)).toBe('$650.00') // waiting for the refreshed invoice

    await w.setProps({ refreshError: 'Could not generate the documents.' })
    expect(total(w)).toBe('$600.00') // no new invoice is coming: back to the server's
  })
})
