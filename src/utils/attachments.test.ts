import { describe, expect, it } from 'vitest'
import { MAX_ATTACHED_FILES, attachableKind, toggleAttached } from './attachments'

describe('attachableKind', () => {
  it('takes PDFs, photos and text files', () => {
    for (const n of ['a.pdf', 'b.JPG', 'c.jpeg', 'd.png', 'e.gif', 'f.webp', 'g.eml', 'h.txt', 'i.csv'])
      expect(attachableKind(n)).toBe(true)
    expect(attachableKind('scan', 'application/pdf')).toBe(true)
  })
  it('refuses what the assistant cannot read', () => {
    expect(attachableKind('sheet.xlsx', 'application/vnd.ms-excel')).toBe(false)
    expect(attachableKind('photo.heic', 'image/heic')).toBe(false)
    expect(attachableKind('letter.docx')).toBe(false)
  })
})

describe('toggleAttached', () => {
  it('adds and removes, never past the limit', () => {
    expect(toggleAttached([], 'a')).toEqual(['a'])
    expect(toggleAttached(['a', 'b'], 'a')).toEqual(['b'])
    const full = Array.from({ length: MAX_ATTACHED_FILES }, (_, i) => `f${i}`)
    expect(toggleAttached(full, 'x')).toEqual(full)
    expect(toggleAttached(full, 'f0')).toHaveLength(MAX_ATTACHED_FILES - 1)
  })
})
