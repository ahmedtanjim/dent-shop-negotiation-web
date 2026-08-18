import { api } from './client'
import type { ShopProfile } from './types'

// Shared with the CRM — the shop profile carries the default storage rate that
// prefills new negotiation cases.
export function getShopProfile(shopId: string): Promise<ShopProfile> {
  return api.get<ShopProfile>(`/api/shops/${shopId}`)
}
