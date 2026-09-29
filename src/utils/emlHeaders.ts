/**
 * Just enough of an .eml's header block to preview it before upload — From, Subject,
 * Date. The server does the real parse (MimeKit); this only lets the owner see they
 * picked the right email. Handles folded header lines and RFC 2047 encoded words.
 */

export interface EmlPreview {
  from: string | null
  subject: string | null
  date: string | null
  /** Set for a forward: who forwarded it. from/subject/date are then the ORIGINAL message's —
   *  the same unwrapping the server does, so the preview shows what will be logged. */
  forwardedBy: string | null
}

function decodeWords(s: string): string {
  return s
    .replace(/\?=\s+=\?/g, '?==?') // adjacent encoded words join without the space
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, charset: string, enc: string, text: string) => {
      try {
        let bytes: Uint8Array
        if (enc.toUpperCase() === 'B') {
          bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
        } else {
          const q = text.replace(/_/g, ' ')
          const out: number[] = []
          for (let i = 0; i < q.length; i++) {
            if (q[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(q.slice(i + 1, i + 3))) {
              out.push(parseInt(q.slice(i + 1, i + 3), 16))
              i += 2
            } else out.push(q.charCodeAt(i))
          }
          bytes = new Uint8Array(out)
        }
        return new TextDecoder(charset).decode(bytes)
      } catch {
        return text
      }
    })
}

/** Undo quoted-printable (soft line breaks + =XX bytes, UTF-8). */
function qpDecode(s: string): string {
  const joined = s.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      const code = joined.charCodeAt(i)
      if (code < 128) bytes.push(code)
      else bytes.push(...new TextEncoder().encode(joined[i]))
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

const FORWARD_MARKER = /^\s*(-+\s*Forwarded message\s*-+|Begin forwarded message:)\s*$/im

/** The innermost forwarded message's From/Date/Subject inside the plain-text part, if any. */
function forwardedHeaders(head: string): { from: string | null; subject: string | null; date: string | null } | null {
  const text = /quoted-printable/i.test(head) ? qpDecode(head) : head
  const lines = text.split(/\r?\n/)
  let start = -1
  lines.forEach((l, i) => {
    if (FORWARD_MARKER.test(l)) start = i + 1
  })
  if (start < 0) return null
  const found: Record<string, string> = {}
  let current: string | null = null
  let i = start
  while (i < lines.length && !lines[i].trim()) i++
  for (; i < lines.length && lines[i].trim(); i++) {
    const m = /^\s*\*?(From|To|Cc|Date|Sent|Subject)\s*:\*?\s*(.*)$/i.exec(lines[i])
    if (m) {
      current = m[1].toLowerCase()
      if (!(current in found)) found[current] = m[2].trim()
    } else if (current) {
      found[current] = `${found[current]} ${lines[i].trim()}`
    }
  }
  if (!found.from && !found.subject) return null
  const clean = (v: string | undefined) => (v ? v.replace(/[\u202F\u00A0]/g, ' ').trim() || null : null)
  return { from: clean(found.from), subject: clean(found.subject), date: clean(found.date ?? found.sent) }
}

export async function readEmlPreview(file: File): Promise<EmlPreview> {
  // Headers sit at the top; 64 KB is plenty and avoids reading big attachments.
  const head = await file.slice(0, 64 * 1024).text()
  const block = head.split(/\r?\n\r?\n/)[0] ?? ''
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ')
  const get = (name: string) => {
    const m = unfolded.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'mi'))
    return m ? decodeWords(m[1].trim()) || null : null
  }
  const rawDate = get('Date')
  let date: string | null = rawDate
  if (rawDate) {
    const d = new Date(rawDate)
    if (!Number.isNaN(d.getTime()))
      date = d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  const outer = { from: get('From'), subject: get('Subject'), date }
  if (!outer.from && !outer.subject) return { ...outer, forwardedBy: null }
  const inner = forwardedHeaders(head)
  return inner ? { ...inner, forwardedBy: outer.from } : { ...outer, forwardedBy: null }
}
