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
  /** Set by a 402 ai_required until the plan has been re-read: the API has the final word. */
  const refused = ref(false)
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
  const isAi = computed(() => tier.value === 'Ai' && !refused.value)
  /** Never subscribed: the account exists but no plan was ever chosen — typically an owner
   *  who created the shop from the Negotiator's sign-up and left before paying. (The API
   *  keeps no sign-up intent, so a Free shop from the shop system reads the same; for it,
   *  "finish setting up the Negotiator" is still the one step left.) A lapsed or canceled
   *  plan is not this — that shop keeps the regular upgrade screen. */
  const unfinishedSignup = computed(
    () =>
      tier.value === 'Free' &&
      entitlement.value?.status === 'Free' &&
      !state.value?.hasLiveSubscription,
  )
  /** A live Stripe subscription — upgrades go through the portal, not a new Checkout. */
  const canUpgradeInPlace = computed(
    () => !!state.value?.hasStripeCustomer && entitlement.value?.status === 'Active',
  )

  async function load(shopId: string, force = false): Promise<void> {
    // A refresh in flight always wins over the cached answer: after a 402 the plan is
    // being re-read, and answering from the stale "AI plan" state bounced the paywall
    // straight back to the page that had just been refused (NEG-7).
    if (inflight && !force) return inflight
    if (!force && loadedFor.value === shopId) return
    inflight = (async () => {
      try {
        state.value = await getBilling(shopId)
        failed.value = false
        refused.value = false
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
    refused.value = false
    loadedFor.value = shopId
  }

  /** The API just refused the AI plan (402 ai_required): the cached state is stale. Drop it
   *  and re-read — until the answer lands, nobody may treat the shop as on the AI plan. */
  function invalidate(shopId: string): Promise<void> {
    loadedFor.value = null
    refused.value = true
    return load(shopId, true)
  }

  function reset() {
    state.value = null
    loadedFor.value = null
    failed.value = false
    refused.value = false
  }

  return { state, entitlement, known, failed, tier, isAi, unfinishedSignup, canUpgradeInPlace, load, invalidate, sync, reset }
})
