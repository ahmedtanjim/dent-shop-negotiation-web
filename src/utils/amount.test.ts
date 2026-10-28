import { describe, expect, it } from 'vitest'
import { parseMoney, parsePercent } from './amount'

describe('parseMoney', () => {
  it('takes a figure exactly as typed', () => {
    expect(parseMoney('1,234.50', 'Fee')).toEqual({ value: 1234.5, error: null })
    expect(parseMoney('$1,250.50', 'Fee')).toEqual({ value: 1250.5, error: null })
    expect(parseMoney(' 75 ', 'Fee')).toEqual({ value: 75, error: null })
    expect(parseMoney(40, 'Fee')).toEqual({ value: 40, error: null })
    expect(parseMoney('0', 'Fee')).toEqual({ value: 0, error: null })
  })

  it('treats an empty field as no value, not zero', () => {
    expect(parseMoney('', 'Fee')).toEqual({ value: null, error: null })
    expect(parseMoney(null, 'Fee')).toEqual({ value: null, error: null })
    expect(parseMoney(undefined, 'Fee')).toEqual({ value: null, error: null })
  })

  it('never turns a bad figure into a different number', () => {
    expect(parseMoney('-50', 'Fee')).toEqual({ value: null, error: "Fee can't be negative." })
    expect(parseMoney('1e6', 'Fee').value).toBeNull()
    expect(parseMoney('1e6', 'Fee').error).toMatch(/plain number/)
    expect(parseMoney('12abc', 'Fee').value).toBeNull()
    expect(parseMoney('.', 'Fee').value).toBeNull()
    expect(parseMoney('1.2.3', 'Fee').value).toBeNull()
  })

  it('allows cents but not fractions of a cent', () => {
    expect(parseMoney('19.99', 'Fee').value).toBe(19.99)
    expect(parseMoney('19.999', 'Fee')).toEqual({ value: null, error: 'Fee: use at most 2 decimal places (1250.00).' })
  })

  it('caps at $1,000,000', () => {
    expect(parseMoney('1,000,000', 'Fee').value).toBe(1_000_000)
    expect(parseMoney('1000000.01', 'Fee').error).toMatch(/over \$1,000,000/)
  })
})

describe('parsePercent', () => {
  it('takes 0 … 100 with up to three decimals', () => {
    expect(parsePercent('7.25', 'Tax')).toEqual({ value: 7.25, error: null })
    expect(parsePercent('7.25 %', 'Tax')).toEqual({ value: 7.25, error: null })
    expect(parsePercent('8.125', 'Tax').value).toBe(8.125)
    expect(parsePercent('100', 'Tax').value).toBe(100)
  })

  it('refuses negatives, exponents, extra decimals and anything over 100', () => {
    expect(parsePercent('-50', 'Tax').error).toBe("Tax can't be negative.")
    expect(parsePercent('1e6', 'Tax').value).toBeNull()
    expect(parsePercent('8.1255', 'Tax').error).toMatch(/3 decimal places/)
    expect(parsePercent('100.5', 'Tax').error).toBe('Tax must be between 0 and 100%.')
  })
})
