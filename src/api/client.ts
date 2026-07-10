import { ref } from 'vue'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5080'

export const STORAGE_KEYS = {
  token: 'dsm_neg_token',
  shopId: 'dsm_neg_shop_id',
  displayName: 'dsm_neg_display_name',
} as const

/** Set when a mutating request returns 402 (subscription lapsed). Shown as a banner in App.vue. */
export const subscriptionNotice = ref<string | null>(null)

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
  localStorage.removeItem(STORAGE_KEYS.token)
  localStorage.removeItem(STORAGE_KEYS.shopId)
  localStorage.removeItem(STORAGE_KEYS.displayName)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
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
    try {
      const data = await res.json()
      if (data && typeof data.message === 'string') message = data.message
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 402) subscriptionNotice.value = message
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
