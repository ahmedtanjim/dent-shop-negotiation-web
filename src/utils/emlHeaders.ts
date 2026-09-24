/**
 * Just enough of an .eml's header block to preview it before upload — From, Subject,
 * Date. The server does the real parse (MimeKit); this only lets the owner see they
 * picked the right email. Handles folded header lines and RFC 2047 encoded words.
 */

export interface EmlPreview {
  from: string | null
  subject: string | null
  date: string | null
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
  return { from: get('From'), subject: get('Subject'), date }
}
