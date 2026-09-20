import { api } from './client'
import type { AuthResponse } from './types'

export function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/login', { email, password })
}

/** Cross-app sign-in (shop system ⇄ Negotiator): mint a one-time, 60-second code for
 *  this shop; the other app exchanges it for its own session. */
export function createHandoff(shopId: string): Promise<{ code: string; expiresAt: string }> {
  return api.post<{ code: string; expiresAt: string }>('/api/auth/handoff', { shopId })
}

export function exchangeHandoff(code: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/handoff/exchange', { code })
}
