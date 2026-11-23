// The DSM Negotiator guide on the public help centre (dentshopmanager.com/help, repo
// dent_shop_home), and which part of it each page opens from the (?) menu → "Guide for this page".
//
// NEGOTIATOR_SECTIONS is a copy of that guide's section anchors that this app links to; the unit
// test checks every link below against it, so a typo can't ship. The help centre keeps the other
// side: its build fails if a guide or section listed in its src/help/app-links.ts disappears. If
// one is renamed on purpose, change it here and there in the same release.

/** The help centre's address — the only place it is written in this app. */
export const HELP_URL = 'https://dentshopmanager.com/help'

/** This app's guide on the help centre. */
export const NEGOTIATOR_GUIDE = 'negotiator'

/** Heading anchors in the negotiator guide that pages below link to. */
export const NEGOTIATOR_SECTIONS: readonly string[] = [
  'who-can-do-this',
  '1-open-dsm-negotiator',
  '3-create-a-case',
  '6-add-the-adjusters-email',
]

/**
 * Route name → the section of the guide that page opens at ('' = the top of the guide). Every
 * route in src/router must be listed, so a new page can't be forgotten (the test reads the file).
 */
export const PAGE_SECTIONS: Record<string, string> = {
  welcome: '',
  login: '1-open-dsm-negotiator',
  register: '',
  'handoff-start': '',
  'handoff-out': '',
  handoff: '',
  paywall: 'who-can-do-this',
  cases: '3-create-a-case',
  case: '6-add-the-adjusters-email',
  terms: '',
  privacy: '',
  pricing: '',
  'not-found': '',
}

/** The guide's address for a page, at its section when it has one. */
export function guideUrlFor(routeName: unknown): string {
  const section = typeof routeName === 'string' ? (PAGE_SECTIONS[routeName] ?? '') : ''
  return `${HELP_URL}/${NEGOTIATOR_GUIDE}${section ? `#${section}` : ''}`
}
