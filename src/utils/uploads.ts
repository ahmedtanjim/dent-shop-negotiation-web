/** The API's per-file upload limit (NegotiationController / EmlParser: 25 MB). Checked in
 *  the browser first so a big file fails in a second with a clear message instead of after
 *  a long upload. */
export const MAX_UPLOAD_MB = 25
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

export function tooLargeMessage(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null
  const mb = (file.size / (1024 * 1024)).toFixed(1)
  return `That file is ${mb} MB — the limit is ${MAX_UPLOAD_MB} MB. Compress it or split it and try again.`
}

/** A best-effort "is this an email file" check by name/type — the preview then checks the
 *  headers, and the server's parse is the final word. */
export function looksLikeEmlName(file: File): boolean {
  return /\.eml$/i.test(file.name) || file.type === 'message/rfc822'
}
