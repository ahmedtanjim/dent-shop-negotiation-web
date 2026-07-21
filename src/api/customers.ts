import { api } from './client'
import type { CustomerSearchResult } from './types'

// Shared with the CRM — /customers, not /negotiation/... — same tenant-scoped
// Customer/Vehicle records the CRM's claim intake writes.
export function searchCustomers(shopId: string, query: string): Promise<CustomerSearchResult[]> {
  const q = query.trim()
  const suffix = q ? `?q=${encodeURIComponent(q)}` : ''
  return api.get<CustomerSearchResult[]>(`/api/shops/${shopId}/customers${suffix}`)
}
