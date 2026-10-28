import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { STORAGE_KEYS } from '@/api/client'
import type { AuthResponse } from '@/api/types'

/** Membership roles as the API names them (lower-cased for comparison). */
export type Role = 'owner' | 'manager' | 'admin' | 'technician' | 'salesrep' | 'frontdesk'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(STORAGE_KEYS.token))
  const shopId = ref<string | null>(localStorage.getItem(STORAGE_KEYS.shopId))
  const shopName = ref<string | null>(localStorage.getItem(STORAGE_KEYS.shopName))
  const displayName = ref<string | null>(localStorage.getItem(STORAGE_KEYS.displayName))
  const role = ref<string | null>(localStorage.getItem(STORAGE_KEYS.role))
  const userId = ref<string | null>(localStorage.getItem(STORAGE_KEYS.userId))
  /** Every shop this login is on — the top-bar switcher lists them. */
  const shops = ref<{ shopId: string; shopName: string; role: string }[]>(readShops())

  function readShops() {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEYS.shops) ?? '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }

  const isAuthed = computed(() => !!token.value && !!shopId.value)
  /** The role in this shop, lower-cased; null when signed out or unknown. Every gate below
   *  is a computed on it, so a role the session refresh brings in shows at once. These only
   *  hide controls — the API enforces each rule itself. */
  const roleKey = computed<Role | null>(() => (role.value ? (role.value.toLowerCase() as Role) : null))
  const hasRole = (...roles: Role[]) => computed(() => !!roleKey.value && roles.includes(roleKey.value))
  /** Only the owner can change the shop's plan. */
  const isOwner = hasRole('owner')
  /** Case status and other case-level management. */
  const canManageCases = hasRole('owner', 'manager', 'admin')
  /** Deleting and restoring cases. */
  const canDeleteCases = hasRole('owner', 'manager')
  /** The shop's TL-invoice rates live on the shop profile, which only the owner or a manager
   *  may edit (`[ShopOwnerOrManager]`; an Admin gets 403). */
  const canEditShopRates = hasRole('owner', 'manager')
  /** The fair-use AI usage meter. */
  const canSeeUsage = hasRole('owner', 'manager', 'admin')

  function setSession(auth: AuthResponse) {
    token.value = auth.token
    shopId.value = auth.shopId
    shopName.value = auth.shops?.find((s) => s.shopId === auth.shopId)?.shopName ?? null
    displayName.value = auth.displayName
    role.value = auth.role
    userId.value = auth.userId
    shops.value = Array.isArray(auth.shops) ? auth.shops : []
    localStorage.setItem(STORAGE_KEYS.shops, JSON.stringify(shops.value))
    localStorage.setItem(STORAGE_KEYS.token, auth.token)
    localStorage.setItem(STORAGE_KEYS.userId, auth.userId)
    localStorage.setItem(STORAGE_KEYS.shopId, auth.shopId)
    localStorage.setItem(STORAGE_KEYS.displayName, auth.displayName)
    localStorage.setItem(STORAGE_KEYS.role, auth.role ?? '')
    if (shopName.value) localStorage.setItem(STORAGE_KEYS.shopName, shopName.value)
    else localStorage.removeItem(STORAGE_KEYS.shopName)
  }

  function logout() {
    token.value = null
    shopId.value = null
    shopName.value = null
    displayName.value = null
    role.value = null
    userId.value = null
    shops.value = []
    for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key)
  }

  return {
    token, shopId, shopName, displayName, role, userId, shops, isAuthed,
    isOwner, canManageCases, canDeleteCases, canEditShopRates, canSeeUsage,
    setSession, logout,
  }
})
