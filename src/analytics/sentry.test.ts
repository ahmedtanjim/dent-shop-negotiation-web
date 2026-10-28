import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Breadcrumb, ErrorEvent } from '@sentry/vue'
import { scrubBreadcrumb, scrubEvent } from './sentry'

// The Sentry promise (README / CLAUDE.md): error reports carry no PII — no user, no query
// strings, no headers or bodies, no typed or clicked text, emails and long numbers redacted.

const event = (): ErrorEvent =>
  ({
    type: undefined,
    message: 'Save failed for jane.doe@example.com, claim 4410-2231-88, call 555 123 4567',
    user: { id: 'u1', email: 'jane.doe@example.com' },
    extra: { body: '{"password":"x"}' },
    server_name: 'host',
    request: {
      url: 'https://ai.dentshopmanager.com/cases/1?code=secret#x',
      headers: { Authorization: 'Bearer abc' },
      cookies: { a: 'b' },
      data: '{"email":"jane.doe@example.com"}',
      query_string: 'code=secret',
    },
    exception: {
      values: [{ type: 'Error', value: 'POST https://api.dentshopmanager.com/x?token=abc failed for bob@shop.test' }],
    },
    contexts: {
      vue: { componentName: 'InvoiceCard', propsData: { customer: 'Jane' }, lifecycleHook: 'setup' },
      state: { pinia: { auth: { displayName: 'Jane' } } },
      os: { name: 'macOS' },
    },
    breadcrumbs: [
      { category: 'console', message: 'jane.doe@example.com' },
      { category: 'ui.click', message: 'button "Jane Doe"' },
      { category: 'ui.input', message: 'input[name=email]' },
      { category: 'navigation', message: 'nav', data: { from: '/login?redirect=%2Fcases', to: '/cases/1?tab=x' } },
      { category: 'fetch', message: 'GET', data: { url: 'https://api.dentshopmanager.com/api/x?q=Jane', body: 'x', response_body: 'y' } },
    ],
  }) as unknown as ErrorEvent

describe('scrubEvent', () => {
  beforeEach(() => localStorage.setItem('dsm_neg_token', 't'))
  afterEach(() => localStorage.clear())

  it('drops events from signed-out pages', () => {
    localStorage.clear()
    expect(scrubEvent(event())).toBeNull()
  })

  it('keeps no user, extras, headers, cookies, bodies or query strings', () => {
    const e = scrubEvent(event())!
    expect(e.user).toBeUndefined()
    expect(e.extra).toBeUndefined()
    expect(e.server_name).toBeUndefined()
    expect(e.request).toEqual({ url: 'https://ai.dentshopmanager.com/cases/1' })
  })

  it('redacts emails and long numbers from the message and exception values', () => {
    const e = scrubEvent(event())!
    expect(e.message).toBe('Save failed for [email], claim [number], call [number]')
    expect(e.exception!.values![0].value).toBe('POST https://api.dentshopmanager.com/x failed for [email]')
  })

  it('keeps only the component name from the Vue context, and no store state', () => {
    const e = scrubEvent(event())!
    expect(e.contexts!.vue).toEqual({ componentName: 'InvoiceCard' })
    expect(e.contexts!.state).toBeUndefined()
    expect(e.contexts!.os).toEqual({ name: 'macOS' })
  })

  it('keeps navigation and request breadcrumbs only, without queries or bodies', () => {
    const crumbs = scrubEvent(event())!.breadcrumbs!
    expect(crumbs.map((b) => b.category)).toEqual(['navigation', 'fetch'])
    expect(crumbs[0].data).toEqual({ from: 'http://localhost:3000/login', to: 'http://localhost:3000/cases/1' })
    expect(crumbs[1].data).toEqual({ url: 'https://api.dentshopmanager.com/api/x' })
    expect(crumbs.every((b) => b.message === undefined)).toBe(true)
    expect(JSON.stringify(crumbs)).not.toMatch(/Jane|jane|\?/)
  })
})

describe('scrubBreadcrumb', () => {
  it('drops console text and every ui.* crumb', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'x' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'ui.keypress', message: 'x' })).toBeNull()
  })

  it('redacts the message of any other crumb', () => {
    const b = scrubBreadcrumb({ category: 'app', message: 'sent to jane@shop.test' } as Breadcrumb)!
    expect(b.message).toBe('sent to [email]')
  })
})
