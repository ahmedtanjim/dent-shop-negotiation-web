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
/** Set when the API answers 429 `ai_cap_daily` / `ai_cap_monthly` — the shop has used its
 *  fair-use AI allowance. App.vue shows it as a banner with the reset time. */
export const aiCapNotice = ref<{ message: string; scope: string; resetsAt: string | null } | null>(null)

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** machine-readable reason when the API sends one (e.g. `shop_profile_incomplete`) */
    public readonly code: string | null = null,
    /** the parsed JSON error body, for callers that need more than the message */
    public readonly body: Record<string, unknown> | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Read an error response's JSON body ({ message, code, … }); tolerant of non-JSON. */
async function readError(res: Response, fallback: string): Promise<{ message: string; code: string | null; body: Record<string, unknown> | null }> {
  try {
    const data = await res.json()
    if (data && typeof data === 'object') {
      return {
        message: typeof data.message === 'string' ? data.message : fallback,
        code: typeof data.code === 'string' ? data.code : null,
        body: data as Record<string, unknown>,
      }
    }
  } catch {
    /* non-JSON error body */
  }
  return { message: fallback, code: null, body: null }
}

/** The file name from a Content-Disposition header (RFC 5987 filename* first). Readable
 *  cross-origin only when the API exposes the header (CORS WithExposedHeaders). */
function dispositionFileName(header: string | null): string | null {
  if (!header) return null
  const star = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* fall through */
    }
  }
  const plain = header.match(/filename\s*=\s*("?)([^";]+)\1/)
  return plain ? plain[2].trim() : null
}

const NETWORK_ERROR = "Can't reach Dent Shop Manager right now. Check your internet connection and try again."

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

/** Endpoints that establish a session — a 401 from them is a bad credential, not an expired token. */
function isSignInPath(path: string): boolean {
  return path.startsWith('/api/auth/login') || path.startsWith('/api/auth/handoff/exchange')
}

export interface RequestOptions {
  /** Let the request outlive the page (a save flushed as the tab closes). Bodies ≤ 64 KB. */
  keepalive?: boolean
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  form?: FormData,
  opts: RequestOptions = {},
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
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, keepalive: opts.keepalive })
  } catch {
    throw new ApiError(0, NETWORK_ERROR)
  }

  // A 401 only means "your session is stale" when we actually sent a session. Sign-in
  // calls (password login, hand-off exchange) carry no token, so their 401 is a plain
  // wrong-credentials answer and falls through to show the API's own message.
  if (res.status === 401 && headers.Authorization && !isSignInPath(path)) handleUnauthorized()

  if (!res.ok) {
    const { message, code, body } = await readError(res, `Request failed (${res.status})`)
    const resetsAt = typeof body?.resetsAt === 'string' ? body.resetsAt : null
    if (res.status === 402) {
      if (code === 'ai_required') aiPlanRequired.value = true
      else subscriptionNotice.value = message
    }
    if (res.status === 429 && code?.startsWith('ai_cap_')) {
      aiCapNotice.value = { message, scope: code.slice('ai_cap_'.length), resetsAt }
    }
    throw new ApiError(res.status, message, code, body)
  }

  // Always drain the body (even a 204's empty one): an unread response is reported by
  // the browser as a cancelled request (net::ERR_ABORTED) on every autosave.
  const text = await res.text()
  if (res.status === 204) return undefined as T
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, undefined, opts),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, undefined, form),

  /** Fetch a file with the bearer token attached. A failed download surfaces the API's
   *  own message and code (e.g. `shop_profile_incomplete`), not just "Download failed". */
  async download(path: string): Promise<{ blob: Blob; filename: string | null }> {
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, { headers: authHeader() })
    } catch {
      throw new ApiError(0, NETWORK_ERROR)
    }
    if (res.status === 401) handleUnauthorized()
    if (!res.ok) {
      const { message, code, body } = await readError(res, `Download failed (${res.status}).`)
      throw new ApiError(res.status, message, code, body)
    }
    return { blob: await res.blob(), filename: dispositionFileName(res.headers.get('Content-Disposition')) }
  },
}
