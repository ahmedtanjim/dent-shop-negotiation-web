import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getBilling, syncBilling } from '@/api/billing'
import type { BillingState, PlanTier } from '@/api/types'

/** The shop's plan, read once per session (and again after Stripe). Fail-open: until it
 *  loads — or if the request fails — the shop counts as Ai, so a paying shop never sees
 *  the paywall by mistake; the API's own 402 stays the real gate. */
export const useEntitlementStore = defineStore('entitlement', () => {
  const state = ref<BillingState | null>(null)
  const loadedFor = ref<string | null>(null)
  let inflight: Promise<void> | null = null

  const entitlement = computed(() => state.value?.entitlement ?? null)
  const tier = computed<PlanTier>(() => {
    const e = entitlement.value
    if (!e) return 'Ai'
    return e.tier ?? (e.entitled ? 'Ai' : 'Free')
  })
  const isAi = computed(() => tier.value === 'Ai')
  /** A live Stripe subscription — upgrades go through the portal, not a new Checkout. */
  const canUpgradeInPlace = computed(
    () => !!state.value?.hasStripeCustomer && entitlement.value?.status === 'Active',
  )

  async function load(shopId: string, force = false): Promise<void> {
    if (!force && loadedFor.value === shopId) return
    if (inflight && !force) return inflight
    inflight = (async () => {
      try {
        state.value = await getBilling(shopId)
      } catch {
        state.value = null
      } finally {
        loadedFor.value = shopId
        inflight = null
      }
    })()
    return inflight
  }

  async function sync(shopId: string): Promise<void> {
    state.value = await syncBilling(shopId)
    loadedFor.value = shopId
  }

  function reset() {
    state.value = null
    loadedFor.value = null
  }

  return { state, entitlement, tier, isAi, canUpgradeInPlace, load, sync, reset }
})
