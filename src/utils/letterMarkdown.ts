import { PLACEHOLDER_RE } from './placeholders'

/**
 * The drafter (and the exemplars it imitates) write letters in a deliberately tiny Markdown:
 * `**bold**` headings and `- ` / `1. ` list lines. Everything else is plain text. This module
 * turns that into safe HTML for the docket and into a rich-text clipboard payload so a paste
 * into Gmail/Outlook keeps the bold headings and bullets instead of showing raw asterisks.
 *
 * Inbound emails pass through the same renderer, so every string is HTML-escaped first —
 * nothing an insurer writes can become markup.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape, then promote `**text**` to <strong>. Unbalanced markers stay as literal text.
 *  With `highlight`, bracketed blanks ([OWNER NAME], [CONFIRM: …]) become <mark>s so an
 *  unfinished letter never reads as finished on screen (the clipboard copy stays plain). */
function inline(s: string, highlight = false): string {
  const html = escapeHtml(s).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  return highlight ? html.replace(PLACEHOLDER_RE, (m) => `<mark class="blank-mark">${m}</mark>`) : html
}

const BULLET = /^\s*-\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

const P_STYLE = 'margin:0 0 1em 0'

function renderList(lines: string[], marker: RegExp, tag: 'ul' | 'ol', hl: boolean): string {
  const items: string[] = []
  for (const line of lines) {
    if (marker.test(line)) items.push(inline(line.replace(marker, ''), hl))
    else if (items.length) items[items.length - 1] += `<br>${inline(line.trim(), hl)}` // continuation line
    else items.push(inline(line.trim(), hl))
  }
  return `<${tag} style="margin:0 0 1em 1.4em;padding:0">${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`
}

/** Render a letter body to HTML: paragraphs, bold headings, bullet and numbered lists. */
export function letterToHtml(body: string, opts: { highlightBlanks?: boolean } = {}): string {
  const hl = opts.highlightBlanks ?? false
  const blocks = body.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/)
  return blocks
    .map((block) => {
      const lines = block.split('\n')
      const firstLine = lines.find((l) => l.trim().length > 0) ?? ''
      if (BULLET.test(firstLine)) return renderList(lines, BULLET, 'ul', hl)
      if (NUMBERED.test(firstLine)) return renderList(lines, NUMBERED, 'ol', hl)
      return `<p style="${P_STYLE}">${lines.map((l) => inline(l, hl)).join('<br>')}</p>`
    })
    .join('')
}

/** The same letter with the markers removed — for excerpts and the plain-text clipboard flavor. */
export function letterToPlainText(body: string): string {
  return body.replace(/\*\*([^*\n]+?)\*\*/g, '$1')
}

/**
 * Copy a letter as rich text (HTML + plain fallback). Mail clients paste the HTML flavor, so
 * headings arrive bold and lists as real bullets; plain-text fields get the marker-free text.
 * Falls back to writeText where ClipboardItem is unavailable (older Firefox, insecure origins).
 */
export async function copyLetter(subject: string | null | undefined, body: string): Promise<void> {
  const plainBody = letterToPlainText(body)
  const plain = subject ? `Subject: ${subject}\n\n${plainBody}` : plainBody
  const html =
    (subject ? `<p style="${P_STYLE}"><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : '') +
    letterToHtml(body)

  if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      /* fall through to plain text */
    }
  }
  await navigator.clipboard.writeText(plain)
}
