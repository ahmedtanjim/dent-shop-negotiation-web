import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'

describe('auth store role gates', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  const gates = (role: string | null) => {
    const auth = useAuthStore()
    auth.role = role
    return {
      owner: auth.isOwner,
      manage: auth.canManageCases,
      del: auth.canDeleteCases,
      rates: auth.canEditShopRates,
      usage: auth.canSeeUsage,
    }
  }

  it('matches what the API allows each role', () => {
    expect(gates('Owner')).toEqual({ owner: true, manage: true, del: true, rates: true, usage: true })
    expect(gates('Manager')).toEqual({ owner: false, manage: true, del: true, rates: true, usage: true })
    // Admins see money and manage cases, but the shop profile (rates) is owner/manager only.
    expect(gates('Admin')).toEqual({ owner: false, manage: true, del: false, rates: false, usage: true })
    for (const r of ['Technician', 'SalesRep', 'FrontDesk', '', null]) {
      expect(gates(r), String(r)).toEqual({ owner: false, manage: false, del: false, rates: false, usage: false })
    }
  })

  it('follows a role change without a reload', () => {
    const auth = useAuthStore()
    auth.role = 'Technician'
    expect(auth.canEditShopRates).toBe(false)
    auth.setSession({
      token: 't',
      userId: 'u',
      shopId: 's',
      displayName: 'Pat',
      role: 'Manager',
      shops: [{ shopId: 's', shopName: 'Shop', role: 'Manager' }],
    } as Parameters<typeof auth.setSession>[0])
    expect(auth.canEditShopRates).toBe(true)
    expect(auth.canDeleteCases).toBe(true)
  })
})
