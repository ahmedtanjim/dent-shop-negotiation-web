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

/** What `POST …/billing/checkout` did. `url` is where the browser goes next: Stripe
 *  Checkout, the portal's confirm-upgrade flow, or `returnUrl` with `?status=success` /
 *  `?status=unchanged` when the plan was switched, resumed or already right. */
export interface CheckoutResult {
  url: string | null
  action: 'checkout' | 'portal' | 'switched' | 'unchanged' | 'resumed' | (string & {})
  plan: string | null
  trialDays: number | null
}

/** Buy a plan (owner only). The API picks the route from the shop's live Stripe
 *  subscription — a new Checkout when there is none (a comp or a bare Stripe customer
 *  included), otherwise a change of that subscription, never a second one — so callers
 *  never choose between Checkout and the portal themselves. `returnUrl` must be on one of
 *  the API's configured web origins or it falls back to the CRM billing page. A change that
 *  would charge at once needs `confirmCharge` (see {@link ChargeConfirmation}). */
export function startCheckout(shopId: string, plan: 'ai', returnUrl: string, confirmCharge = false): Promise<CheckoutResult> {
  return api.post<CheckoutResult>(`${base(shopId)}/checkout`, {
    plan,
    returnUrl,
    ...(confirmCharge ? { confirmCharge: true } : {}),
  })
}

export function listMembers(shopId: string): Promise<MemberSummary[]> {
  return api.get<MemberSummary[]>(`/api/shops/${shopId}/members`)
}
