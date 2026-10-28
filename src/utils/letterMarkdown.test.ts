import { describe, expect, it } from 'vitest'
import { letterToHtml, letterToPlainText } from './letterMarkdown'

/** Every element and attribute the renderer may produce. Anything else in the output means
 *  text from an insurer's email (or the AI) became markup — `v-html` would run it. */
const TAGS = new Set(['P', 'STRONG', 'BR', 'UL', 'OL', 'LI', 'MARK'])
const ATTRS = new Set(['style', 'start', 'class'])

function parse(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

function expectOnlyOwnMarkup(html: string) {
  for (const el of parse(html).querySelectorAll('*')) {
    expect(TAGS.has(el.tagName), `unexpected <${el.tagName.toLowerCase()}>`).toBe(true)
    for (const a of el.getAttributeNames()) expect(ATTRS.has(a), `unexpected ${a}=`).toBe(true)
  }
}

describe('letterToHtml', () => {
  it('escapes markup, so a <script> stays text', () => {
    const html = letterToHtml('Hello <script>alert(1)</script> & "you"')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&amp; &quot;you&quot;')
    expectOnlyOwnMarkup(html)
    expect(parse(html).textContent).toBe('Hello <script>alert(1)</script> & "you"')
  })

  it('never lets ** build an attribute or a tag', () => {
    const inputs = [
      '<img src="x" onerror="**alert(1)**">',
      '**a" onmouseover="alert(1)** and <a href="**javascript:alert(1)**">x</a>',
      '<p title="**">**</p>',
    ]
    for (const body of inputs) {
      const html = letterToHtml(body)
      expectOnlyOwnMarkup(html)
      expect(parse(html).querySelector('img, a, [onerror], [onmouseover], [href]')).toBeNull()
    }
  })

  it('keeps blanks escaped inside their highlight', () => {
    const html = letterToHtml('Signed, [OWNER NAME" onclick="alert(1)]', { highlightBlanks: true })
    expectOnlyOwnMarkup(html)
    const mark = parse(html).querySelector('mark')
    expect(mark?.getAttribute('class')).toBe('blank-mark')
    expect(mark?.textContent).toBe('[OWNER NAME" onclick="alert(1)]')
  })

  it('renders bold, paragraphs and bullets', () => {
    const html = letterToHtml('**Re: claim 123**\nLine two\n\n- one\n- two')
    const root = parse(html)
    expect(root.querySelector('p strong')?.textContent).toBe('Re: claim 123')
    expect(root.querySelector('p')?.innerHTML).toContain('<br>')
    expect([...root.querySelectorAll('ul > li')].map((li) => li.textContent)).toEqual(['one', 'two'])
  })

  it('keeps a numbered list one list across blank lines (no "1. 1. 1.")', () => {
    const root = parse(letterToHtml('1. First\n\n2. Second\n\n3. Third'))
    const lists = root.querySelectorAll('ol')
    expect(lists).toHaveLength(1)
    expect(lists[0].hasAttribute('start')).toBe(false)
    expect([...lists[0].querySelectorAll('li')].map((li) => li.textContent)).toEqual(['First', 'Second', 'Third'])
  })

  it("keeps the letter's own first number", () => {
    const root = parse(letterToHtml('Intro paragraph.\n\n3. Third point\n4. Fourth point'))
    const ol = root.querySelector('ol')!
    expect(ol.getAttribute('start')).toBe('3')
    expect(ol.querySelectorAll('li')).toHaveLength(2)
  })

  it('a list interrupted by a paragraph continues at its own number', () => {
    const root = parse(letterToHtml('1. One\n\nA paragraph between.\n\n2. Two'))
    const lists = root.querySelectorAll('ol')
    expect(lists).toHaveLength(2)
    expect(lists[0].hasAttribute('start')).toBe(false)
    expect(lists[1].getAttribute('start')).toBe('2')
  })
})

describe('letterToPlainText', () => {
  it('drops the bold markers only', () => {
    expect(letterToPlainText('**Re:** claim <b>1</b>')).toBe('Re: claim <b>1</b>')
  })
})
