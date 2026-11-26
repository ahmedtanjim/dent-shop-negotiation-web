import { afterEach, describe, expect, it, vi } from 'vitest'
import { CRM_URL } from '@/api/client'
import { fromParent, isEmbedded, leaveTo, resetEmbedCache, sessionStore } from './embed'

describe('embed (the Negotiator inside the shop system’s car page)', () => {
  afterEach(() => {
    resetEmbedCache()
    vi.restoreAllMocks()
  })

  it('is not embedded in its own tab', () => {
    expect(isEmbedded()).toBe(false)
    expect(sessionStore()).toBe(window.localStorage)
  })

  it('keeps the session in this frame’s sessionStorage when framed', () => {
    resetEmbedCache(true)
    expect(sessionStore()).toBe(window.sessionStorage)
  })

  it('trusts only messages from the shop system’s own origin and the parent window', () => {
    const ok = new MessageEvent('message', { origin: CRM_URL, source: window.parent, data: { type: 'x' } })
    expect(fromParent(ok)).toBe(true)
    const otherOrigin = new MessageEvent('message', { origin: 'https://evil.example', source: window.parent, data: { type: 'x' } })
    expect(fromParent(otherOrigin)).toBe(false)
    const noData = new MessageEvent('message', { origin: CRM_URL, source: window.parent, data: 'x' })
    expect(fromParent(noData)).toBe(false)
  })

  it('opens other sites in a new tab when framed', () => {
    resetEmbedCache(true)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    leaveTo('https://checkout.stripe.com/x')
    expect(open).toHaveBeenCalledWith('https://checkout.stripe.com/x', '_blank', 'noopener')
  })
})
