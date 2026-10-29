import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { BillingState, CaseListItem } from '@/api/types'

const api = vi.hoisted(() => ({
  listCases: vi.fn(async (): Promise<CaseListItem[]> => []),
  listDeletedCases: vi.fn(async (): Promise<CaseListItem[]> => []),
  restoreCase: vi.fn(),
  getAiUsage: vi.fn(async () => {
    throw new Error('not needed here')
  }),
}))
vi.mock('@/api/negotiation', () => ({
  listCases: api.listCases,
  listDeletedCases: api.listDeletedCases,
  restoreCase: api.restoreCase,
}))
vi.mock('@/api/usage', () => ({ getAiUsage: api.getAiUsage }))
const tour = vi.hoisted(() => ({ seen: true, startCasesTour: vi.fn() }))
vi.mock('@/tour', () => ({ casesTourSeen: () => tour.seen, startCasesTour: tour.startCasesTour }))

import CasesView from './CasesView.vue'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'

const aCase: CaseListItem = {
  id: 'c1',
  title: 'Smith — 2021 Tahoe',
  status: 'Open',
  insurerName: 'Acme Mutual',
  insurerClaimNumber: '123',
  customerName: 'Smith',
  state: 'TX',
  invoiceTotalCents: 125000,
  messageCount: 2,
  updatedAt: '2026-10-20T10:00:00Z',
  createdAt: '2026-10-01T10:00:00Z',
  claimId: null,
  stormId: null,
  stormName: null,
  deletedAt: '2026-10-21T10:00:00Z',
}

const plan = (tier: 'Ai' | 'Free', hadAiPlan: boolean): BillingState => ({
  billingEnabled: true,
  entitlement: {
    plan: tier,
    status: tier === 'Ai' ? 'Active' : 'Canceled',
    entitled: tier === 'Ai',
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    daysLeft: null,
    tier,
  },
  hasStripeCustomer: true,
  hasLiveSubscription: tier === 'Ai',
  hadAiPlan,
})

async function mountCases(role: string, state: BillingState = plan('Ai', true)) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.token = 't'
  auth.shopId = 'shop-1'
  auth.role = role
  useEntitlementStore().state = state
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cases', name: 'cases', component: CasesView },
      { path: '/cases/:id', name: 'case', component: { render: () => null } },
    ],
  })
  await router.push('/cases')
  const wrapper = mount(CasesView, {
    global: { plugins: [router], stubs: { NewCaseModal: true, ShopRatesModal: true } },
  })
  await flushPromises()
  return { wrapper, auth }
}

const buttons = (w: Awaited<ReturnType<typeof mountCases>>['wrapper'], label: string) =>
  w.findAll('button').filter((b) => b.text().includes(label))

describe('CasesView controls follow the role and the plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    tour.seen = true
  })

  it('shows Shop rates to the owner and a manager only (the API refuses an admin)', async () => {
    for (const [role, shown] of [['Owner', true], ['Manager', true], ['Admin', false], ['Technician', false]] as const) {
      const { wrapper } = await mountCases(role)
      expect(buttons(wrapper, 'Shop rates').length, role).toBe(shown ? 1 : 0)
      wrapper.unmount()
    }
  })

  it('updates when the role changes under an open page', async () => {
    api.listCases.mockResolvedValueOnce([aCase])
    const { wrapper, auth } = await mountCases('Technician')
    expect(buttons(wrapper, 'Shop rates')).toHaveLength(0)
    expect(buttons(wrapper, 'Recently deleted')).toHaveLength(0)
    auth.role = 'Manager'
    await nextTick()
    expect(buttons(wrapper, 'Shop rates')).toHaveLength(1)
    expect(buttons(wrapper, 'Recently deleted')).toHaveLength(1)
    auth.role = 'Admin'
    await nextTick()
    expect(buttons(wrapper, 'Shop rates')).toHaveLength(0)
    expect(buttons(wrapper, 'Recently deleted')).toHaveLength(0)
  })

  it('a shop whose AI plan ended reads its cases but gets no New case or Shop rates', async () => {
    const { wrapper } = await mountCases('Owner', plan('Free', true))
    expect(useEntitlementStore().readOnly).toBe(true)
    expect(buttons(wrapper, 'New case')).toHaveLength(0) // header and empty state
    expect(buttons(wrapper, 'Shop rates')).toHaveLength(0)
    expect(api.listCases).toHaveBeenCalledWith('shop-1')
  })

  it('read-only: the empty list points at the renew banner instead of inviting a new case', async () => {
    const { wrapper } = await mountCases('Owner', plan('Free', true))
    const empty = wrapper.get('.empty.card').text()
    expect(empty).toContain('plan has ended')
    expect(empty).toContain('banner at the top')
    expect(empty).not.toMatch(/create a case/i)
  })

  it('read-only: the first-visit tour skips the New case step', async () => {
    vi.useFakeTimers()
    try {
      tour.seen = false
      await mountCases('Owner', plan('Free', true))
      vi.runAllTimers()
      expect(tour.startCasesTour).toHaveBeenCalledWith({ readOnly: true })
      tour.startCasesTour.mockClear()
      await mountCases('Owner')
      vi.runAllTimers()
      expect(tour.startCasesTour).toHaveBeenCalledWith({ readOnly: false })
    } finally {
      vi.useRealTimers()
    }
  })

  it('read-only: a deleted case is listed but Restore (a write) is off', async () => {
    api.listCases.mockResolvedValueOnce([{ ...aCase, deletedAt: null }])
    api.listDeletedCases.mockResolvedValueOnce([aCase])
    const { wrapper } = await mountCases('Owner', plan('Free', true))
    expect(wrapper.text()).toContain('Smith — 2021 Tahoe')
    await buttons(wrapper, 'Recently deleted')[0].trigger('click')
    await flushPromises()
    const restore = buttons(wrapper, 'Restore')
    expect(restore).toHaveLength(1)
    expect(restore[0].attributes('disabled')).toBeDefined()
  })

  it('an AI shop keeps both', async () => {
    const { wrapper } = await mountCases('Owner')
    expect(buttons(wrapper, 'New case')).toHaveLength(2) // header and empty state
    expect(buttons(wrapper, 'Shop rates')).toHaveLength(1)
  })
})
