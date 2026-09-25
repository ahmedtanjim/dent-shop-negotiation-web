import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getBilling, syncBilling } from '@/api/billing'
import type { BillingState, PlanTier } from '@/api/types'

/** The shop's plan, read once per session (and again after Stripe). A failed lookup is
 *  "unknown" — never mistaken for the AI plan. The router still lets an unknown shop
 *  through to its cases (the API's own 402 stays the real gate, so a paying shop never
 *  sees the paywall because of a blip), but the paywall itself shows a retry instead of
 *  claiming "AI plan active". */
export const useEntitlementStore = defineStore('entitlement', () => {
  const state = ref<BillingState | null>(null)
  const loadedFor = ref<string | null>(null)
  /** The last lookup failed and nothing is known about the plan. */
  const failed = ref(false)
  let inflight: Promise<void> | null = null

  const entitlement = computed(() => state.value?.entitlement ?? null)
  /** Whether the plan has actually been read (vs failed / not loaded yet). */
  const known = computed(() => !!entitlement.value)
  /** The shop's tier, or null while it is unknown. */
  const tier = computed<PlanTier | null>(() => {
    const e = entitlement.value
    if (!e) return null
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
        failed.value = false
        loadedFor.value = shopId
      } catch {
        // Unknown, not "Ai". loadedFor stays unset so the next navigation tries again.
        state.value = null
        failed.value = true
        loadedFor.value = null
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  async function sync(shopId: string): Promise<void> {
    state.value = await syncBilling(shopId)
    failed.value = false
    loadedFor.value = shopId
  }

  function reset() {
    state.value = null
    loadedFor.value = null
    failed.value = false
  }

  return { state, entitlement, known, failed, tier, isAi, canUpgradeInPlace, load, sync, reset }
})
