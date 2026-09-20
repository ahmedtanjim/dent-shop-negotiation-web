import { createHandoff } from './auth'
import { CRM_URL } from './client'
import { useAuthStore } from '@/stores/auth'

/** Where new shops sign up — one account for both apps, created on the shop system.
 *  `plan=ai` preselects the AI plan there; `next=negotiator` brings them back here. */
export const SIGNUP_URL = `${CRM_URL}/signup?plan=ai&next=negotiator`

/** Open a page of the shop system already signed in: mint a hand-off code and let the
 *  CRM exchange it. Falls back to the plain URL (its own login) if minting fails. */
export async function goToCrm(path = '/', newTab = false): Promise<void> {
  const auth = useAuthStore()
  let url = `${CRM_URL}${path}`
  if (auth.shopId) {
    try {
      const { code } = await createHandoff(auth.shopId)
      url = `${CRM_URL}/auth/handoff?code=${encodeURIComponent(code)}&next=${encodeURIComponent(path)}`
    } catch {
      /* plain link — they can sign in there */
    }
  }
  if (newTab) window.open(url, '_blank', 'noopener')
  else window.location.href = url
}
