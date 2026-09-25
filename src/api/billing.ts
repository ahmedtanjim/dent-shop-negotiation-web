import { api } from './client'
import type { BillingState, MemberSummary } from './types'

const base = (shopId: string) => `/api/shops/${shopId}/billing`

export function getBilling(shopId: string): Promise<BillingState> {
  return api.get<BillingState>(base(shopId))
}

/** Re-reads the subscription straight from Stripe — used when the browser comes back
 *  from Checkout / the portal so activation doesn't wait on webhook timing. */
export function syncBilling(shopId: string): Promise<BillingState> {
  return api.post<BillingState>(`${base(shopId)}/sync`)
}

/** The 409 `charge_confirmation_required` body: the change would charge the card right
 *  away (e.g. a trialing Monthly/Annual shop adding the AI plan ends its trial now), so the
 *  API refuses it until the owner confirms and the call is repeated with `confirmCharge`. */
export interface ChargeConfirmation {
  message: string
  plan: string | null
  amountCents: number | null
  currency: string
  trialEndsNow: boolean
}

export const CHARGE_CONFIRMATION_REQUIRED = 'charge_confirmation_required'

/** The confirmation details from a 409 body, tolerant of missing fields. */
export function readChargeConfirmation(message: string, body: Record<string, unknown> | null): ChargeConfirmation {
  const b = body ?? {}
  return {
    message,
    plan: typeof b.plan === 'string' ? b.plan : null,
    amountCents: typeof b.amountCents === 'number' && Number.isFinite(b.amountCents) ? b.amountCents : null,
    currency: typeof b.currency === 'string' && b.currency ? b.currency : 'usd',
    trialEndsNow: b.trialEndsNow === true,
  }
}

/** Stripe Checkout for a fresh subscription (owner only). `returnUrl` must be on one of
 *  the API's configured web origins or it falls back to the CRM billing page. When the shop
 *  already has a live subscription the API may change it in place instead; a change that
 *  would charge at once needs `confirmCharge` (see {@link ChargeConfirmation}). */
export function startCheckout(shopId: string, plan: 'ai', returnUrl: string, confirmCharge = false): Promise<{ url: string }> {
  return api.post<{ url: string }>(`${base(shopId)}/checkout`, {
    plan,
    returnUrl,
    ...(confirmCharge ? { confirmCharge: true } : {}),
  })
}

/** Stripe customer portal, deep-linked into the confirm-upgrade flow for `upgradeToPlan`
 *  (owner only). The existing subscription is switched and prorated — no second one. Same
 *  `confirmCharge` rule as {@link startCheckout}. */
export function openPortal(shopId: string, upgradeToPlan: 'ai', returnUrl: string, confirmCharge = false): Promise<{ url: string }> {
  return api.post<{ url: string }>(`${base(shopId)}/portal`, {
    upgradeToPlan,
    returnUrl,
    ...(confirmCharge ? { confirmCharge: true } : {}),
  })
}

export function listMembers(shopId: string): Promise<MemberSummary[]> {
  return api.get<MemberSummary[]>(`/api/shops/${shopId}/members`)
}
