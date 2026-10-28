import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safeRedirect'

describe('safeRedirect', () => {
  it('keeps paths on this app', () => {
    expect(safeRedirect('/cases')).toBe('/cases')
    expect(safeRedirect('/cases/3f2a?tab=letters#draft')).toBe('/cases/3f2a?tab=letters#draft')
    expect(safeRedirect('/upgrade?redirect=%2Fcases%2F1')).toBe('/upgrade?redirect=%2Fcases%2F1')
    expect(safeRedirect('/')).toBe('/')
  })

  it('refuses other sites', () => {
    for (const v of [
      '//evil.test',
      '//evil.test/cases',
      '/\\evil.test',
      '/\\/evil.test',
      '/.\\/evil.test',
      'https://evil.test/cases',
      'javascript:alert(1)',
      'cases',
    ]) {
      expect(safeRedirect(v), v).toBe('/')
    }
  })

  it('refuses a path that normalises to a protocol-relative one', () => {
    // new URL('/.//evil.test', origin) keeps this origin, but its pathname is '//evil.test'.
    expect(safeRedirect('/.//evil.test')).toBe('/')
    expect(safeRedirect('/..//evil.test')).toBe('/')
    expect(safeRedirect('/cases/..//evil.test')).toBe('/')
    expect(safeRedirect('/%2e//evil.test')).toBe('/')
  })

  it('refuses control characters and whitespace', () => {
    for (const v of ['/\t/evil.test', '/\n/evil.test', '/ /evil.test', '/cases\u0000', '/cases\u007f', '/cases x']) {
      expect(safeRedirect(v), JSON.stringify(v)).toBe('/')
    }
  })

  it('refuses anything that is not a single string', () => {
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect(null)).toBe('/')
    expect(safeRedirect(['/cases'])).toBe('/')
    expect(safeRedirect(42)).toBe('/')
    expect(safeRedirect('')).toBe('/')
  })
})
