/** Where a `?redirect=` may send someone after sign-in, hand-off or the paywall: a path on
 *  this app only. One leading "/" followed by anything but another "/" or "\" — so
 *  "//evil.test" or "/\evil.test" (which browsers read as another site) and full URLs fall
 *  back to the home page. Every ?redirect reader goes through this one rule. */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value[1] === '/' || value[1] === '\\') return '/'
  // Control characters and whitespace can smuggle a different reading past the check.
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return '/'
  return value
}
