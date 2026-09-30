import type { RouteLocationNormalized } from 'vue-router'

/** The public origin the canonical/og URLs point at. */
export const PUBLIC_ORIGIN = 'https://ai.dentshopmanager.com'

function ensureMeta(name: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  return el
}

/** Only the landing page is for search engines: it keeps its canonical; the sign-in page
 *  points at itself; everything behind sign-in is noindex. (index.html ships the /welcome
 *  tags statically for link-preview scrapers, which don't run JavaScript.) */
export function applyRouteSeo(to: RouteLocationNormalized) {
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  const indexable = to.name === 'welcome'
  if (canonical) canonical.href = `${PUBLIC_ORIGIN}${indexable ? '/welcome' : to.path}`
  ensureMeta('robots').content = indexable ? 'index, follow' : 'noindex'
}
