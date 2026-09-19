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

/** Stripe Checkout for a fresh subscription (owner only). `returnUrl` must be on one of
 *  the API's configured web origins or it falls back to the CRM billing page. */
export function startCheckout(shopId: string, plan: 'ai', returnUrl: string): Promise<{ url: string }> {
  return api.post<{ url: string }>(`${base(shopId)}/checkout`, { plan, returnUrl })
}

/** Stripe customer portal, deep-linked into the confirm-upgrade flow for `upgradeToPlan`
 *  (owner only). The existing subscription is switched and prorated — no second one. */
export function openPortal(shopId: string, upgradeToPlan: 'ai', returnUrl: string): Promise<{ url: string }> {
  return api.post<{ url: string }>(`${base(shopId)}/portal`, { upgradeToPlan, returnUrl })
}

export function listMembers(shopId: string): Promise<MemberSummary[]> {
  return api.get<MemberSummary[]>(`/api/shops/${shopId}/members`)
}
