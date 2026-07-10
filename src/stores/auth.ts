import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { STORAGE_KEYS } from '@/api/client'
import type { AuthResponse } from '@/api/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(STORAGE_KEYS.token))
  const shopId = ref<string | null>(localStorage.getItem(STORAGE_KEYS.shopId))
  const displayName = ref<string | null>(localStorage.getItem(STORAGE_KEYS.displayName))

  const isAuthed = computed(() => !!token.value && !!shopId.value)

  function setSession(auth: AuthResponse) {
    token.value = auth.token
    shopId.value = auth.shopId
    displayName.value = auth.displayName
    localStorage.setItem(STORAGE_KEYS.token, auth.token)
    localStorage.setItem(STORAGE_KEYS.shopId, auth.shopId)
    localStorage.setItem(STORAGE_KEYS.displayName, auth.displayName)
  }

  function logout() {
    token.value = null
    shopId.value = null
    displayName.value = null
    localStorage.removeItem(STORAGE_KEYS.token)
    localStorage.removeItem(STORAGE_KEYS.shopId)
    localStorage.removeItem(STORAGE_KEYS.displayName)
  }

  return { token, shopId, displayName, isAuthed, setSession, logout }
})
