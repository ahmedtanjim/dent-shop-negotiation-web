/* Strict parsing for typed money and percentages. A figure is taken exactly as typed or
   not at all: "$1,250.50" is fine, but "-50" or "1e6" is an error shown to the user —
   never silently turned into 50 or 16. `value` null = the field is empty. */

export interface Parsed {
  value: number | null
  error: string | null
}

export function parseAmount(v: string | number | null | undefined, label: string, maxDecimals: number, example: string): Parsed {
  const t = String(v ?? '').trim().replace(/^\$\s*/, '').replace(/,/g, '').replace(/\s*%$/, '')
  if (t === '') return { value: null, error: null }
  if (t.startsWith('-')) return { value: null, error: `${label} can't be negative.` }
  if (!/^\d*\.?\d*$/.test(t) || t === '.')
    return { value: null, error: `${label}: type a plain number, like ${example}.` }
  const decimals = t.split('.')[1]?.length ?? 0
  if (decimals > maxDecimals)
    return { value: null, error: `${label}: use at most ${maxDecimals} decimal places (${example}).` }
  return { value: Number(t), error: null }
}

const MONEY_MAX = 1_000_000

/** Dollars and cents, 0 … $1,000,000. */
export function parseMoney(v: string | number | null | undefined, label: string): Parsed {
  const p = parseAmount(v, label, 2, '1250.00')
  if (p.value !== null && p.value > MONEY_MAX)
    return { value: null, error: `${label} is over $1,000,000 — check the figure.` }
  return p
}

/** A percentage, 0 … 100, up to three decimals. */
export function parsePercent(v: string | number | null | undefined, label: string): Parsed {
  const p = parseAmount(v, label, 3, '7.25')
  if (p.value !== null && p.value > 100)
    return { value: null, error: `${label} must be between 0 and 100%.` }
  return p
}
