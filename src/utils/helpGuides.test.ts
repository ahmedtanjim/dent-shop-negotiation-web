import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP_URL, NEGOTIATOR_GUIDE, NEGOTIATOR_SECTIONS, PAGE_SECTIONS, guideUrlFor } from './helpGuides'

// The help centre's 14 guides (dentshopmanager.com/help). If the Negotiator's guide is renamed
// or removed there, this fails until the link here is changed too.
const SITE_GUIDES = [
  'getting-started', 'add-employees', 'storms', 'new-claim', 'claim-tasks', 'scope-and-invoice',
  'dashboard-and-garage', 'payroll', 'hail-map', 'training', 'negotiator', 'mobile-app',
  'plans-and-billing', 'delete-account',
]

describe('help guide links', () => {
  it('points at the help centre’s negotiator guide', () => {
    expect(HELP_URL).toBe('https://dentshopmanager.com/help')
    expect(SITE_GUIDES).toContain(NEGOTIATOR_GUIDE)
  })

  it('every page opens at a section that exists in the guide', () => {
    for (const [route, section] of Object.entries(PAGE_SECTIONS)) {
      if (section) expect(NEGOTIATOR_SECTIONS, `${route} → #${section}`).toContain(section)
    }
  })

  it('every route in the router has an entry', () => {
    const router = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
    const names = [...router.matchAll(/\bname:\s*'([^']+)'/g)].map((m) => m[1])
    expect(names.length).toBeGreaterThan(8)
    for (const name of new Set(names)) expect(PAGE_SECTIONS, `route "${name}" needs an entry in PAGE_SECTIONS`).toHaveProperty([name])
  })

  it('builds the address, with the section when there is one', () => {
    expect(guideUrlFor('no-such-route')).toBe('https://dentshopmanager.com/help/negotiator')
    expect(guideUrlFor(undefined)).toBe('https://dentshopmanager.com/help/negotiator')
    for (const [route, section] of Object.entries(PAGE_SECTIONS))
      expect(guideUrlFor(route)).toBe(`https://dentshopmanager.com/help/negotiator${section ? `#${section}` : ''}`)
  })
})
