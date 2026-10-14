import { CRM_URL } from './client'
import { useAuthStore } from '@/stores/auth'

/** Where new shops sign up — one account for both apps, created on the shop system.
 *  `plan=ai` preselects the AI plan there; `next=negotiator` brings them back here. */
export const SIGNUP_URL = `${CRM_URL}/signup?plan=ai&next=negotiator`

/** Where an owner who signed up but left before paying finishes: the shop system's Billing
 *  with the AI plan picked, which brings them back here once it's on. */
export const FINISH_SETUP_PATH = '/billing?plan=ai&next=negotiator'

/** Open a page of the shop system already signed in. The shop system starts the hand-off
 *  itself (its /auth/handoff/start keeps a PKCE verifier in its tab and asks our
 *  /auth/handoff/out for a code bound to it), so a code can't be redeemed anywhere else.
 *  Signed out here: the plain URL (its own login). */
export function goToCrm(path = '/', newTab = false): void {
  const auth = useAuthStore()
  const url = auth.isAuthed
    ? `${CRM_URL}/auth/handoff/start?next=${encodeURIComponent(path)}`
    : `${CRM_URL}${path}`
  if (newTab) window.open(url, '_blank', 'noopener')
  else window.location.href = url
}
