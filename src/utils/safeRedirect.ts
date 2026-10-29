/** Where a `?redirect=` may send someone after sign-in, hand-off or the paywall: a path on
 *  this app only. One leading "/" followed by anything but another "/" or "\" — so
 *  "//evil.test" or "/\evil.test" (which browsers read as another site) and full URLs fall
 *  back to the home page. The value is then resolved the way the browser will read it: it
 *  must stay on this origin, and a path that normalises to "//…" ("/.//evil.test") is
 *  refused too, since handing that pathname to the browser is protocol-relative again.
 *  Every ?redirect reader goes through this one rule (same rule as the CRM's redirect.ts). */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value[1] === '/' || value.includes('\\')) return '/'
  // Control characters and whitespace can smuggle a different reading past the check.
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return '/'
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname.startsWith('//')) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
