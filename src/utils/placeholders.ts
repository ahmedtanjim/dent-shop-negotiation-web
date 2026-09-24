/**
 * Letters and AI drafts leave a bracketed ALL-CAPS blank — `[OWNER NAME]`, `[SHOP ADDRESS]`,
 * `[DATE VEHICLE ARRIVED AT SHOP]`, `[CONFIRM: …]` — wherever a fact is missing. The UI never
 * shows those as if they were finished text: they are highlighted in the letter and listed
 * above it, and the ones that come from the shop profile point to where they are set.
 */

/** A blank opens with two capitals ("[OWNER NAME]") or a fill-in verb ("[Confirm whether …]");
 *  "[dev …]" and editorial brackets in quotes ("[t]he insurer") are not blanks. */
export const PLACEHOLDER_RE = /\[(?=[A-Z]{2}|(?:Confirm|Insert|Enter|Add|Date)\b)[^\]\n]{2,600}\]/g

export interface Blank {
  text: string
  /** true when the value comes from the shop profile (fixed once in Settings) */
  profile: boolean
  /** a short plain-English name for the list */
  label: string
}

const PROFILE: [RegExp, string][] = [
  [/OWNER|CONTACT NAME|SIGNATURE|YOUR NAME/, 'owner / point-of-contact name'],
  [/MAILING ADDRESS|CORPORATE ADDRESS/, 'mailing address for payments'],
  [/SHOP ADDRESS|ADDRESS/, 'shop address'],
  [/PHONE/, 'shop phone'],
  [/EMAIL/, 'shop email'],
  [/TAX ID|EIN/, 'tax ID'],
]

function describe(text: string): Blank {
  const inner = text.slice(1, -1).trim()
  const upper = inner.toUpperCase()
  if (!upper.startsWith('CONFIRM') && !upper.startsWith('DATE')) {
    for (const [re, label] of PROFILE) if (re.test(upper)) return { text, profile: true, label }
  }
  const label = inner.replace(/^CONFIRM\s*[:—-]?\s*/i, 'confirm: ')
  return { text, profile: false, label: label.length > 90 ? `${label.slice(0, 90).trimEnd()}…` : label }
}

/** Every distinct blank in the given texts, profile blanks first. */
export function findBlanks(...texts: (string | null | undefined)[]): Blank[] {
  const seen = new Map<string, Blank>()
  for (const t of texts) {
    if (!t) continue
    for (const m of t.matchAll(PLACEHOLDER_RE)) if (!seen.has(m[0])) seen.set(m[0], describe(m[0]))
  }
  return [...seen.values()].sort((a, b) => Number(b.profile) - Number(a.profile))
}
