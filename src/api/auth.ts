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

/** Re-issue this session with a fresh 7-day expiry and the CURRENT role and shops — a role
 *  change or a removal shows up here (corner-case #46). */
export function refreshSession(): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/refresh', {})
}

/** Move the session to another of this user's shops (corner-case #18). */
export function switchShop(shopId: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/switch-shop', { shopId })
}

/** The signed-in user's own account (GET /api/auth/me). The session keeps no email; the
 *  Help & support modal reads it from here for the details it puts in the user's email. */
export function getMe(): Promise<{ email: string; displayName: string }> {
  return api.get<{ email: string; displayName: string }>('/api/auth/me')
}
