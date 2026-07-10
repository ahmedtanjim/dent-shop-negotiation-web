import { api } from './client'
import type { AuthResponse } from './types'

export function sendEmailCode(recipient: string): Promise<void> {
  return api.post<void>('/api/auth/send-email-code', { recipient })
}

export function verifyEmail(recipient: string, code: string): Promise<{ verified: boolean }> {
  return api.post<{ verified: boolean }>('/api/auth/verify-email', { recipient, code })
}

export interface RegisterPayload {
  shopName: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
  password: string
  acceptTerms: boolean
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/register', payload)
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/login', { email, password })
}
