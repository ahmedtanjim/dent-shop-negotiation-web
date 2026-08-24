import { api } from './client'
import type { ShopProfile } from './types'

// Shared with the CRM — the shop profile carries the default storage rate that
// prefills new negotiation cases.
export function getShopProfile(shopId: string): Promise<ShopProfile> {
  return api.get<ShopProfile>(`/api/shops/${shopId}`)
}

/** Update just the shop's TL-invoice rates. The API treats null as "leave unchanged",
 * so this sends only the name (required) plus the rate fields being set. */
export function updateShopRates(
  shopId: string,
  profile: ShopProfile,
  rates: {
    defaultStoragePerDay: number
    adminFee: number
    lotFee: number
    salesTaxPercent: number
  },
): Promise<ShopProfile> {
  return api.put<ShopProfile>(`/api/shops/${shopId}`, {
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    mailingAddress: profile.mailingAddress,
    taxId: profile.taxId,
    contactName: profile.contactName,
    contactPhone: profile.contactPhone,
    ...rates,
  })
}
