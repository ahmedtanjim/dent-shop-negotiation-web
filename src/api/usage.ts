import { api } from './client'
import type { AiUsageSummary } from './types'

/** What the shop has spent of its AI allowance today / this month (any member may read). */
export function getAiUsage(shopId: string): Promise<AiUsageSummary> {
  return api.get<AiUsageSummary>(`/api/shops/${shopId}/ai-usage`)
}
