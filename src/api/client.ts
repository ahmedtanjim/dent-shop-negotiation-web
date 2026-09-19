import { ref } from 'vue'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5080'
/** The shop system (CRM) — where billing lives and where "back to the shop" links go.
 *  In local dev it is the sibling Vite server (port 5173) unless VITE_CRM_URL says otherwise. */
export const CRM_URL = (
  import.meta.env.VITE_CRM_URL ?? (import.meta.env.DEV ? 'http://localhost:5173' : 'https://app.dentshopmanager.com')
).replace(/\/$/, '')

export const STORAGE_KEYS = {
  token: 'dsm_neg_token',
  shopId: 'dsm_neg_shop_id',
  shopName: 'dsm_neg_shop_name',
  displayName: 'dsm_neg_display_name',
  role: 'dsm_neg_role',
} as const

/** Set when a request returns 402 for a lapsed subscription. Shown as a banner in App.vue. */
export const subscriptionNotice = ref<string | null>(null)
/** Flipped when the API answers 402 `ai_required` — the shop is below the AI tier. App.vue
 *  watches it and opens the paywall instead of leaving a red line on the page. */
export const aiPlanRequired = ref(false)

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem(STORAGE_KEYS.token)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleUnauthorized(): never {
  for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key)
  if (!window.location.pathname.startsWith('/login')) {
    // Carry the current location so signing back in returns the user to the page the
    // stale token bounced them off — same contract as the router guard's ?redirect.
    const here = window.location.pathname + window.location.search
    const redirect = here && here !== '/' ? `?redirect=${encodeURIComponent(here)}` : ''
    window.location.href = `/login${redirect}`
  }
  throw new ApiError(401, 'Your session has expired. Please sign in again.')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  form?: FormData,
): Promise<T> {
  const headers: Record<string, string> = { ...authHeader() }
  let payload: BodyInit | undefined
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the API running?')
  }

  if (res.status === 401) handleUnauthorized()

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    let code: string | null = null
    try {
      const data = await res.json()
      if (data && typeof data.message === 'string') message = data.message
      if (data && typeof data.code === 'string') code = data.code
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 402) {
      if (code === 'ai_required') aiPlanRequired.value = true
      else subscriptionNotice.value = message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, undefined, form),

  /** Fetch a binary response (file download) with the bearer token attached. */
  async blob(path: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeader() })
    if (res.status === 401) handleUnauthorized()
    if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`)
    return res.blob()
  },
}
