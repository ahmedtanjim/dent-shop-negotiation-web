import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { STORAGE_KEYS } from '@/api/client'
import type { AuthResponse } from '@/api/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(STORAGE_KEYS.token))
  const shopId = ref<string | null>(localStorage.getItem(STORAGE_KEYS.shopId))
  const shopName = ref<string | null>(localStorage.getItem(STORAGE_KEYS.shopName))
  const displayName = ref<string | null>(localStorage.getItem(STORAGE_KEYS.displayName))
  const role = ref<string | null>(localStorage.getItem(STORAGE_KEYS.role))

  const isAuthed = computed(() => !!token.value && !!shopId.value)
  /** Only the owner can change the shop's plan (the API enforces it too). */
  const isOwner = computed(() => role.value?.toLowerCase() === 'owner')

  function setSession(auth: AuthResponse) {
    token.value = auth.token
    shopId.value = auth.shopId
    shopName.value = auth.shops?.find((s) => s.shopId === auth.shopId)?.shopName ?? null
    displayName.value = auth.displayName
    role.value = auth.role
    localStorage.setItem(STORAGE_KEYS.token, auth.token)
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
    for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key)
  }

  return { token, shopId, shopName, displayName, role, isAuthed, isOwner, setSession, logout }
})
