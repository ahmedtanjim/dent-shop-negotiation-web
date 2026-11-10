import { describe, expect, it } from 'vitest'
import { dailyResetLabel } from './format'

// Built from local-time parts, so the expectations hold in whatever zone the test runs in.
describe('dailyResetLabel', () => {
  const now = new Date(2026, 10, 3, 10, 0)

  it('shows the reset as a clock time in the viewer’s zone, never UTC', () => {
    const label = dailyResetLabel(new Date(2026, 10, 3, 19, 0).toISOString(), now)
    expect(label).toBe('at 7:00 PM your time')
    expect(label).not.toMatch(/UTC|midnight/)
  })

  it('names tomorrow when the reset falls after the viewer’s midnight', () => {
    expect(dailyResetLabel(new Date(2026, 10, 4, 8, 0).toISOString(), now)).toBe('tomorrow at 8:00 AM your time')
  })

  it('names the date when the reset is further out', () => {
    expect(dailyResetLabel(new Date(2026, 10, 6, 8, 30).toISOString(), now)).toBe('on Nov 6 at 8:30 AM your time')
  })

  it('is null without a usable instant', () => {
    expect(dailyResetLabel(null, now)).toBeNull()
    expect(dailyResetLabel('not a date', now)).toBeNull()
  })
})
