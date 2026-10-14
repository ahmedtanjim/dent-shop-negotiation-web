/** PKCE (RFC 7636, S256) for cross-app sign-in. The app that will RECEIVE a session keeps a
 *  random verifier in its own tab and sends only its hash (the challenge) to the app that is
 *  signed in; the code that comes back can only be exchanged together with the verifier. A
 *  sign-in link someone made in their own browser therefore can't sign you into their
 *  account — your tab doesn't hold their verifier. */

const VERIFIER_KEY = 'dsm_handoff_verifier'

function base64url(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** A fresh verifier, kept in this tab (sessionStorage — a new tab or another browser has
 *  none); returns its challenge. */
export async function newChallenge(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  return challengeOf(verifier)
}

/** The verifier this tab kept, read once (null when this tab didn't start a hand-off). */
export function takeVerifier(): string | null {
  try {
    const v = sessionStorage.getItem(VERIFIER_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
    return v
  } catch {
    return null
  }
}

export function isChallenge(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v)
}
