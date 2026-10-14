import { api } from './client'
import type { AuthResponse } from './types'

export function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/login', { email, password })
}

/** Cross-app sign-in (shop system ⇄ Negotiator): mint a one-time, 60-second code for
 *  this shop, bound to the receiving tab's PKCE challenge; the other app exchanges it, with
 *  its verifier, for its own session (see utils/pkce). */
export function createHandoff(shopId: string, challenge: string): Promise<{ code: string; expiresAt: string }> {
  return api.post<{ code: string; expiresAt: string }>('/api/auth/handoff', { shopId, challenge })
}

export function exchangeHandoff(code: string, verifier: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/handoff/exchange', { code, verifier })
}
