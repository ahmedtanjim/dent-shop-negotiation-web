import { api } from './client'
import type { ShopProfile } from './types'

// Shared with the CRM — the shop profile carries the default storage rate that
// prefills new negotiation cases.
export function getShopProfile(shopId: string): Promise<ShopProfile> {
  return api.get<ShopProfile>(`/api/shops/${shopId}`)
}

/** The four Total Loss invoice defaults, decimal dollars / percent. null = keep the shop's
 *  current value (the API's set-only contract); 0 clears it. */
export interface ShopRates {
  defaultStoragePerDay: number | null
  adminFee: number | null
  lotFee: number | null
  salesTaxPercent: number | null
}

/** Update just the shop's TL-invoice rates. The API's profile update also REPLACES the
 *  shop's name, phone, email, addresses, tax id and contact with whatever it is sent, so
 *  those are re-read right before the save and sent back exactly as the server has them
 *  now: a CRM edit made while the rates dialog was open is never reverted. Every other fee
 *  and default-pay field is left out, which the API reads as "unchanged". */
export async function updateShopRates(shopId: string, rates: ShopRates): Promise<ShopProfile> {
  const fresh = await getShopProfile(shopId)
  return api.put<ShopProfile>(`/api/shops/${shopId}`, {
    name: fresh.name,
    phone: fresh.phone,
    email: fresh.email,
    address: fresh.address,
    mailingAddress: fresh.mailingAddress,
    taxId: fresh.taxId,
    contactName: fresh.contactName,
    contactPhone: fresh.contactPhone,
    ...rates,
  })
}
