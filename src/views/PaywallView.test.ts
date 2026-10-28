import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { BillingState } from '@/api/types'

const billing = vi.hoisted(() => ({
  startCheckout: vi.fn(),
  openPortal: vi.fn(),
  listMembers: vi.fn(async () => []),
  getBilling: vi.fn(),
  syncBilling: vi.fn(),
}))
vi.mock('@/api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/billing')>()),
  ...billing,
}))
vi.mock('@/router', () => ({ setTitle: vi.fn() }))
vi.mock('@/api/handoff', () => ({ FINISH_SETUP_PATH: '/billing?plan=ai', goToCrm: vi.fn() }))

import PaywallView from './PaywallView.vue'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { ApiError } from '@/api/client'

/** Active comp (granted plan) that also has a Stripe customer — a legacy-imported Stripe
 *  shop, or one that abandoned a Checkout and was comped afterwards. No live subscription. */
const compWithStripeCustomer: BillingState = {
  billingEnabled: true,
  entitlement: {
    plan: 'Annual',
    status: 'Active',
    entitled: true,
    trialEndsAt: null,
    currentPeriodEnd: '2027-01-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    daysLeft: null,
    tier: 'Annual',
  },
  hasStripeCustomer: true,
  hasLiveSubscription: false,
  hadAiPlan: false,
}
const onAi: BillingState = {
  ...compWithStripeCustomer,
  entitlement: { ...compWithStripeCustomer.entitlement, plan: 'Ai', tier: 'Ai' },
}

async function mountPaywall(state: BillingState) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.token = 't'
  auth.shopId = 'shop-1'
  auth.role = 'Owner'
  useEntitlementStore().state = state
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'welcome', component: { render: () => null } },
      { path: '/upgrade', name: 'paywall', component: PaywallView },
      { path: '/cases/:id', name: 'case', component: { render: () => null } },
    ],
  })
  await router.push('/upgrade?redirect=%2Fcases%2F7')
  const wrapper = mount(PaywallView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const addButton = (w: Awaited<ReturnType<typeof mountPaywall>>['wrapper']) =>
  w.findAll('button').find((b) => b.text().includes('Add DSM Negotiator'))!

describe('PaywallView — buying the AI plan', () => {
  /** Where the page sent the browser (window.location.href = …), without navigating. */
  let href: ReturnType<typeof vi.fn<(url: string) => void>>
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    href = vi.fn<(url: string) => void>()
    vi.spyOn(window.location, 'href', 'set').mockImplementation(href)
  })

  it('a comp shop with a Stripe customer goes through Checkout, never the plain portal', async () => {
    billing.startCheckout.mockResolvedValue({ url: 'https://checkout.stripe.test/c/1', action: 'checkout', plan: 'ai', trialDays: null })
    const { wrapper } = await mountPaywall(compWithStripeCustomer)

    await addButton(wrapper).trigger('click')
    await flushPromises()

    expect(billing.startCheckout).toHaveBeenCalledWith(
      'shop-1',
      'ai',
      `${window.location.origin}/upgrade?redirect=${encodeURIComponent('/cases/7')}`,
      false,
    )
    expect(billing.openPortal).not.toHaveBeenCalled()
    expect(href).toHaveBeenCalledWith('https://checkout.stripe.test/c/1')
  })

  it('follows whatever page the API picked (portal, switch, unchanged)', async () => {
    billing.startCheckout.mockResolvedValue({ url: 'https://billing.stripe.test/p/1', action: 'portal', plan: 'ai', trialDays: null })
    const { wrapper } = await mountPaywall({ ...compWithStripeCustomer, hasLiveSubscription: true })
    await addButton(wrapper).trigger('click')
    await flushPromises()
    expect(billing.openPortal).not.toHaveBeenCalled()
    expect(href).toHaveBeenCalledWith('https://billing.stripe.test/p/1')
  })

  it('asks before an immediate charge, then repeats the same call with confirmCharge', async () => {
    billing.startCheckout
      .mockRejectedValueOnce(
        new ApiError(409, 'This charges your card now.', 'charge_confirmation_required', {
          amountCents: 199900,
          currency: 'usd',
          trialEndsNow: true,
        }),
      )
      .mockResolvedValueOnce({ url: 'http://localhost:3000/upgrade?status=success', action: 'switched', plan: 'ai', trialDays: null })
    const { wrapper } = await mountPaywall({
      ...compWithStripeCustomer,
      hasLiveSubscription: true,
      entitlement: { ...compWithStripeCustomer.entitlement, status: 'Trialing', tier: 'Annual' },
    })

    await addButton(wrapper).trigger('click')
    await flushPromises()
    expect(href).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Your free trial ends now and your card will be charged $1,999.00 today.')

    await wrapper.findAll('button').find((b) => b.text().startsWith('Yes, charge'))!.trigger('click')
    await flushPromises()
    expect(billing.startCheckout).toHaveBeenLastCalledWith('shop-1', 'ai', expect.any(String), true)
    expect(href).toHaveBeenCalledWith('http://localhost:3000/upgrade?status=success')
  })

  it('with no page to open, re-reads the plan and goes on to the page it was opening', async () => {
    billing.startCheckout.mockResolvedValue({ url: null, action: 'unchanged', plan: 'ai', trialDays: null })
    billing.syncBilling.mockResolvedValue(onAi)
    const { wrapper, router } = await mountPaywall(compWithStripeCustomer)

    await addButton(wrapper).trigger('click')
    await flushPromises()

    expect(billing.syncBilling).toHaveBeenCalledWith('shop-1')
    expect(href).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/cases/7')
  })
})
