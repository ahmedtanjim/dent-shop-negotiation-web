import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import visitScript from '../../public/welcome-assets/visit-source.js?raw'
import { ATTR_KEY, rememberVisit, withVisit } from './visitSource'

// Growth plan 2026-11-19: a tagged link (an ad, a post) or another website that brought the
// visit rides along on the sign-up link to the shop system, which saves it with the new shop.
// Same rules in the app (utils/visitSource) and on the landing (public/welcome-assets/visit-source.js).

const SIGNUP = 'https://app.dentshopmanager.com/signup?plan=ai&next=negotiator'
const NOW = Date.UTC(2026, 10, 19, 15)
const keptQuery = () => new URLSearchParams(JSON.parse(localStorage.getItem(ATTR_KEY) ?? '{"q":""}').q)

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('the app (utils/visitSource)', () => {
  it('keeps a tagged visit and adds it to the sign-up link without touching plan/next', () => {
    rememberVisit('https://ai.dentshopmanager.com/login?utm_source=pdr-college&utm_campaign=nov&gclid=Cj0-secret', '', NOW)
    expect(Object.fromEntries(keptQuery())).toEqual({
      utm_source: 'pdr-college', utm_campaign: 'nov', dsm_click: 'google-ads', dsm_landing: 'ai.dentshopmanager.com/login',
    })
    const u = new URL(withVisit(SIGNUP, NOW + 1000))
    expect(u.searchParams.get('plan')).toBe('ai')
    expect(u.searchParams.get('next')).toBe('negotiator')
    expect(u.searchParams.get('utm_source')).toBe('pdr-college')
    expect(u.searchParams.get('dsm_click')).toBe('google-ads')
    expect(u.toString()).not.toContain('Cj0-secret')
  })

  it('keeps another website only when nothing is kept, and never our own sites', () => {
    rememberVisit('https://ai.dentshopmanager.com/', 'https://dentshopmanager.com/total-loss', NOW)
    expect(localStorage.getItem(ATTR_KEY)).toBeNull()
    rememberVisit('https://ai.dentshopmanager.com/', 'https://www.youtube.com/watch?v=x', NOW)
    expect(keptQuery().get('dsm_ref')).toBe('youtube.com')
    rememberVisit('https://ai.dentshopmanager.com/', 'https://www.google.com/', NOW + 1)
    expect(keptQuery().get('dsm_ref')).toBe('youtube.com')
  })

  it('a link is left alone with nothing kept, after 30 days, or after an opt-out', () => {
    expect(withVisit(SIGNUP, NOW)).toBe(SIGNUP)
    rememberVisit('https://ai.dentshopmanager.com/?utm_source=fb', '', NOW)
    expect(withVisit(SIGNUP, NOW + 31 * 24 * 3600 * 1000)).toBe(SIGNUP)
    localStorage.setItem('dsm_analytics_optout', '1')
    expect(withVisit(SIGNUP, NOW + 1000)).toBe(SIGNUP)
    localStorage.removeItem(ATTR_KEY)
    rememberVisit('https://ai.dentshopmanager.com/?utm_source=fb', '', NOW)
    expect(localStorage.getItem(ATTR_KEY)).toBeNull()
  })
})

describe('the landing (public/welcome-assets/visit-source.js)', () => {
  function run(search: string, referrer = '') {
    const location = { search, hostname: 'ai.dentshopmanager.com', pathname: '/', href: `https://ai.dentshopmanager.com/${search}` }
    const doc = { referrer, addEventListener: document.addEventListener.bind(document) }
    new Function('location', 'document', visitScript)(location, doc)
  }

  it('keeps the tag and adds it to sign-up links when they are clicked', () => {
    document.body.innerHTML = `<a id="s" href="${SIGNUP.replace('&', '&amp;')}">Start</a><a id="o" href="https://dentshopmanager.com/pricing">Pricing</a>`
    run('?utm_source=facebook&utm_campaign=group-post&fbclid=IwAR-secret', 'https://m.facebook.com/')
    expect(Object.fromEntries(keptQuery())).toEqual({
      utm_source: 'facebook', utm_campaign: 'group-post', dsm_click: 'facebook', dsm_ref: 'm.facebook.com',
      dsm_landing: 'ai.dentshopmanager.com/',
    })
    const s = document.getElementById('s') as HTMLAnchorElement
    const o = document.getElementById('o') as HTMLAnchorElement
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('click', block)
    s.click()
    o.click()
    document.removeEventListener('click', block)
    const u = new URL(s.getAttribute('href')!)
    expect(u.searchParams.get('plan')).toBe('ai')
    expect(u.searchParams.get('utm_campaign')).toBe('group-post')
    expect(u.searchParams.get('dsm_ref')).toBe('m.facebook.com')
    expect(s.getAttribute('href')).not.toContain('IwAR-secret')
    expect(o.getAttribute('href')).toBe('https://dentshopmanager.com/pricing')
  })

  it('keeps nothing after "Turn off analytics"', () => {
    localStorage.setItem('dsm_analytics_optout', '1')
    run('?utm_source=facebook')
    expect(localStorage.getItem(ATTR_KEY)).toBeNull()
  })

  it('is on the landing page, before its other scripts', async () => {
    const html = (await import('../../public/welcome.html?raw')).default
    expect(html).toContain('<script src="/welcome-assets/visit-source.js"></script><script src="/welcome-assets/welcome-1.js">')
  })
})
