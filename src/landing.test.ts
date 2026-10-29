import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import welcomeHtml from '../public/welcome.html?raw'
import formScript from '../public/welcome-assets/welcome-2.js?raw'

// The training form on the public landing (public/welcome.html at ai.dentshopmanager.com/):
// a sign-up is stored through the API's lead endpoint, and the visitor reaches the video
// whatever the API answers.

const LEADS_URL = 'https://api.dentshopmanager.com/api/public/leads'

/** The landing's own form, run under its own script, with fetch and location stubbed. */
function setUp(fetchImpl: (url: string, init: RequestInit) => Promise<unknown>) {
  const page = new DOMParser().parseFromString(welcomeHtml, 'text/html')
  const form = page.querySelector<HTMLFormElement>('form[data-webflow-form]')!
  document.body.innerHTML = form.outerHTML
  const fetch = vi.fn(fetchImpl)
  const location = { href: 'https://ai.dentshopmanager.com/', pathname: '/' }
  new Function('window', 'location', 'fetch', formScript)({ fetch, AbortController }, location, fetch)
  const live = document.querySelector<HTMLFormElement>('form[data-webflow-form]')!
  const fill = (name: string, value: string) => {
    live.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value
  }
  const submit = () => live.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  return { form: live, fetch, location, fill, submit }
}

describe('landing training form', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('carries the honeypot, the consent line and its source', () => {
    const { form } = setUp(async () => ({ ok: true }))
    expect(form.getAttribute('data-source')).toBe('ai-home')
    expect(form.getAttribute('data-redirect')).toBe('https://dentshopmanager.com/total-loss-watch')
    const honeypot = form.querySelector<HTMLInputElement>('input[name="website"]')!
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(form.querySelector('[data-consent]')?.textContent).toBe(
      "We'll email you the training and a few follow-ups. Unsubscribe anytime.",
    )
  })

  it('POSTs the lead, then opens the video', async () => {
    let answer!: () => void
    const { fetch, location, fill, submit } = setUp(() => new Promise((r) => (answer = () => r({ ok: true }))))
    fill('Name', '  Pat Doe ')
    fill('Email', 'pat@shop.test')
    fill('Phone', '555-0100')
    fill('Shop', 'Pat’s PDR')
    submit()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(LEADS_URL)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Pat Doe',
      email: 'pat@shop.test',
      shop: 'Pat’s PDR',
      phone: '555-0100',
      source: 'ai-home',
      consent: "We'll email you the training and a few follow-ups. Unsubscribe anytime.",
      website: '',
    })
    // Still waiting on the API: the visitor hasn't left yet.
    expect(location.href).toBe('https://ai.dentshopmanager.com/')
    answer()
    await vi.runAllTimersAsync()
    expect(location.href).toBe('https://dentshopmanager.com/total-loss-watch')
  })

  it('sends a filled honeypot as is (the API drops it)', () => {
    const { fetch, fill, submit } = setUp(async () => ({ ok: true }))
    fill('Email', 'bot@spam.test')
    fill('website', 'http://spam.test')
    submit()
    expect(JSON.parse(fetch.mock.calls[0][1].body as string).website).toBe('http://spam.test')
  })

  it('a failed call (e.g. CORS) still opens the video', async () => {
    const { location, fill, submit } = setUp(async () => {
      throw new TypeError('Failed to fetch')
    })
    fill('Email', 'pat@shop.test')
    submit()
    await vi.runAllTimersAsync()
    expect(location.href).toBe('https://dentshopmanager.com/total-loss-watch')
  })

  it('a slow API never holds the video back more than 3 s', async () => {
    const { location, fill, submit } = setUp(() => new Promise(() => {}))
    fill('Email', 'pat@shop.test')
    submit()
    await vi.advanceTimersByTimeAsync(2999)
    expect(location.href).toBe('https://ai.dentshopmanager.com/')
    await vi.advanceTimersByTimeAsync(1)
    expect(location.href).toBe('https://dentshopmanager.com/total-loss-watch')
  })

  it('a second submit sends nothing more', () => {
    const { fetch, fill, submit } = setUp(() => new Promise(() => {}))
    fill('Email', 'pat@shop.test')
    submit()
    submit()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
