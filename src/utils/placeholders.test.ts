import { describe, expect, it } from 'vitest'
import { findBlanks } from './placeholders'

describe('findBlanks', () => {
  it('lists each blank once, shop-profile blanks first', () => {
    const blanks = findBlanks(
      'Vehicle arrived [DATE VEHICLE ARRIVED AT SHOP]. Call [SHOP PHONE].',
      'Sincerely, [OWNER NAME]\n[SHOP PHONE]',
      null,
      undefined,
    )
    expect(blanks.map((b) => b.text)).toEqual(['[SHOP PHONE]', '[OWNER NAME]', '[DATE VEHICLE ARRIVED AT SHOP]'])
    expect(blanks.map((b) => b.profile)).toEqual([true, true, false])
    expect(blanks[0].label).toBe('shop phone')
    expect(blanks[1].label).toBe('owner / point-of-contact name')
  })

  it('reads CONFIRM blanks as questions, never as profile fields', () => {
    const [b] = findBlanks('[CONFIRM: the shop address on file]')
    expect(b.profile).toBe(false)
    expect(b.label).toBe('confirm: the shop address on file')
    expect(findBlanks('[Confirm whether the tow was billed]')[0].label).toBe('confirm: whether the tow was billed')
  })

  it('tells the mailing address from the shop address', () => {
    expect(findBlanks('[MAILING ADDRESS]')[0].label).toBe('mailing address for payments')
    expect(findBlanks('[SHOP ADDRESS]')[0].label).toBe('shop address')
  })

  it('ignores editorial brackets and dev notes', () => {
    expect(findBlanks('"[t]he insurer shall" and [dev placeholder] and [a]')).toEqual([])
  })

  it('shortens a long blank for the list', () => {
    const long = `[CONFIRM: ${'x'.repeat(200)}]`
    const [b] = findBlanks(long)
    expect(b.text).toBe(long)
    expect(b.label.length).toBeLessThanOrEqual(91)
    expect(b.label.endsWith('…')).toBe(true)
  })
})
