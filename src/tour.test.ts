import { beforeEach, describe, expect, it, vi } from 'vitest'

type Step = { element?: string; popover: { title: string } }
const driverJs = vi.hoisted(() => ({ steps: [] as Step[] }))
vi.mock('driver.js', () => ({
  driver: (config: { steps: Step[] }) => {
    driverJs.steps = config.steps
    return { drive: vi.fn(), destroy: vi.fn() }
  },
}))

import { startCasesTour } from './tour'

describe('cases tour', () => {
  beforeEach(() => {
    driverJs.steps = []
  })

  it('walks New case, the list and help for a shop on the plan', () => {
    startCasesTour()
    expect(driverJs.steps.map((s) => s.element)).toEqual([
      undefined,
      '[data-tour="new-case"]',
      '[data-tour="case-list"]',
      '[data-tour="help"]',
    ])
  })

  it('skips the New case step in a read-only shop (that button is hidden)', () => {
    startCasesTour({ readOnly: true })
    expect(driverJs.steps.map((s) => s.element)).toEqual([undefined, '[data-tour="case-list"]', '[data-tour="help"]'])
  })
})
