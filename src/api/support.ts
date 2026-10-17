import { ref } from 'vue'
import { api } from './client'

// The support address lives in ONE place: the API setting App:SupportEmail (App Service
// App__SupportEmail), read from the public GET /api/app/contact. This fallback only shows
// until that answers, or if it can't. (Same module as the shop system's data/support.ts.)
export const FALLBACK_SUPPORT_EMAIL = 'dentshopmanager@gmail.com'

/** The current support address — reactive, so text using it updates once the API answers. */
export const supportEmail = ref(FALLBACK_SUPPORT_EMAIL)

let loading: Promise<void> | null = null

/** Fetches the address once per page load (main.ts calls it at startup); safe to call again. */
export function loadSupportEmail(): Promise<void> {
  loading ??= api
    .get<{ supportEmail?: string }>('/api/app/contact')
    .then((r) => {
      if (r?.supportEmail?.includes('@')) supportEmail.value = r.supportEmail
    })
    .catch(() => {})
  return loading
}
