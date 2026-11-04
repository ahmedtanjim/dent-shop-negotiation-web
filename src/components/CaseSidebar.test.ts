import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CaseDetail, CustomerSearchResult } from '@/api/types'

const neg = vi.hoisted(() => ({
  linkCaseToCar: vi.fn(async () => undefined),
  updateCase: vi.fn(async () => ({})),
  deleteDocument: vi.fn(),
  downloadDocument: vi.fn(),
  uploadDocument: vi.fn(),
}))
vi.mock('@/api/negotiation', () => neg)

import CaseSidebar from './CaseSidebar.vue'
import { useAuthStore } from '@/stores/auth'

/** A case with no car yet: picking a customer fills it from their car and links it. */
const detail = {
  case: {
    id: 'case-1', title: 'Walk-in', status: 'Open', insurerName: null, insurerClaimNumber: null,
    customerName: null, state: null, invoiceTotalCents: 0, claimId: null,
  },
  adjusterName: null, adjusterEmail: null, adjusterPhone: null, vehicleDescription: null,
  storagePerDayCents: 0, notes: null, claimId: null, messages: [], facts: [], documents: [],
  hasPlaybook: true, customerId: null, adminFee: null, lotFee: null, salesTaxPercent: null,
  storageStartDate: null, storageEndDate: null,
} as unknown as CaseDetail

const nina: CustomerSearchResult = {
  id: 'cu-9', fullName: 'Nina Pickme', phone: null, email: null, vehicleLabel: '2022 Ford F-150',
  latestCar: {
    claimId: 'car-7', roNumber: 1042, insurerName: 'Progressive', claimNumber: 'PRG-7', state: 'TX',
    hasCase: false, vehicleLabel: '2022 Ford F-150',
  },
}

/** The real picker searches the API; this one just offers the "picked" event. */
const PickerStub = defineComponent({
  name: 'CustomerPicker',
  emits: ['picked', 'update:modelValue', 'update:customerId'],
  setup: () => () => h('input', { class: 'picker-stub' }),
})

function mountSidebar() {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  return mount(CaseSidebar, {
    props: { detail },
    global: { stubs: { CustomerPicker: PickerStub, CarLinkCard: true } },
  })
}

describe('CaseSidebar — the note after picking a customer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is a polite live region that is already on the page before the pick (review 2026-11-04)', async () => {
    const w = mountSidebar()
    const region = w.get('.car-note')
    expect(region.attributes('role')).toBe('status')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')

    w.findComponent(PickerStub).vm.$emit('picked', nina)
    await flushPromises()
    expect(neg.linkCaseToCar).toHaveBeenCalledWith('shop-1', 'case-1', 'car-7')
    expect(w.get('[role="status"].car-note').text())
      .toBe('Insurer, claim #, state and vehicle filled from RO-1042, and the case is linked to that car.')
  })

  it('announces a failed link too', async () => {
    neg.linkCaseToCar.mockRejectedValueOnce(new Error('offline'))
    const w = mountSidebar()
    w.findComponent(PickerStub).vm.$emit('picked', nina)
    await flushPromises()
    expect(w.get('[role="status"].car-note').text())
      .toBe('Insurer, claim #, state and vehicle filled from RO-1042. Link the car below to share its letters.')
  })
})
