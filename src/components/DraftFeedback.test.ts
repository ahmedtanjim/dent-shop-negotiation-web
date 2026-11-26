import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { NegDocument } from '@/api/types'
import DraftFeedback from './DraftFeedback.vue'

const mountBox = (props: Record<string, unknown> = {}) => mount(DraftFeedback, { props: { id: 'm1', ...props } })
const button = (w: ReturnType<typeof mount>) => w.find('.df-send')
const sent = (w: ReturnType<typeof mount>) => w.emitted('submit')?.map((e) => e[0])

describe('DraftFeedback', () => {
  it('asks what is wrong or missing and waits for words before it can send', async () => {
    const w = mountBox()
    expect(w.find('.df-title').text()).toBe('Something wrong or missing in this letter?')
    expect(w.find('.df-hint').text()).toContain("The new one takes this draft's place.")
    expect(button(w).text()).toBe('Rewrite letter')
    expect(button(w).attributes('disabled')).toBeDefined()

    await w.find('textarea').setValue('   ')
    expect(button(w).attributes('disabled')).toBeDefined()
    await button(w).trigger('click')
    expect(sent(w)).toBeUndefined()
  })

  it('sends the feedback without the spaces around it', async () => {
    const w = mountBox()
    await w.find('textarea').setValue('  You left out the $150 tow bill.\n')
    expect(button(w).attributes('disabled')).toBeUndefined()
    await button(w).trigger('click')
    expect(sent(w)).toEqual(['You left out the $150 tow bill.'])
  })

  it('Ctrl+Enter and ⌘+Enter send too', async () => {
    const w = mountBox()
    await w.find('textarea').setValue('Wrong adjuster name.')
    await w.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await w.find('textarea').trigger('keydown', { key: 'Enter', metaKey: true })
    expect(sent(w)).toEqual(['Wrong adjuster name.', 'Wrong adjuster name.'])
    // a plain Enter is a new line in the box, not a send
    await w.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(sent(w)).toHaveLength(2)
  })

  it('while the letter is being rewritten the box and the button wait and say so', async () => {
    const w = mountBox()
    await w.find('textarea').setValue('Fix the date.')
    await w.setProps({ busy: true })
    expect(button(w).text()).toBe('Rewriting…')
    expect(button(w).attributes('disabled')).toBeDefined()
    expect(w.find('textarea').attributes('disabled')).toBeDefined()
    expect(w.find('.df-hint').text()).toContain('Writing the letter again with your changes…')
    await button(w).trigger('click')
    expect(sent(w)).toBeUndefined()
  })

  it('another letter being written holds the send but the words can still be typed', async () => {
    const w = mountBox({ blocked: true })
    await w.find('textarea').setValue('Fix the date.')
    expect(w.find('textarea').attributes('disabled')).toBeUndefined()
    expect(button(w).attributes('disabled')).toBeDefined()
    expect(w.find('.df-hint').text()).toContain('Another letter is being written.')
    await w.setProps({ blocked: false })
    expect(button(w).attributes('disabled')).toBeUndefined()
  })

  it('a refusal is shown and the words are kept to try again', async () => {
    const w = mountBox()
    await w.find('textarea').setValue('Cite ORC 1333.41.')
    await w.setProps({ error: 'Draft rejected by the citation check.' })
    expect(w.find('.df-error').text()).toBe('Draft rejected by the citation check.')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('Cite ORC 1333.41.')
    expect(button(w).attributes('disabled')).toBeUndefined()
  })

  it('stops at the 2,000 characters the server takes and counts down near the end', async () => {
    const w = mountBox()
    expect(w.find('textarea').attributes('maxlength')).toBe('2000')
    await w.find('textarea').setValue('x'.repeat(1700))
    expect(w.find('.df-left').exists()).toBe(false)
    await w.find('textarea').setValue('x'.repeat(1850))
    expect(w.find('.df-left').text()).toBe('150 characters left.')
  })

  it('ties its label and hint to its own box, so two drafts on a page do not clash', () => {
    const w = mountBox({ id: 'abc' })
    expect(w.find('label').attributes('for')).toBe('df-box-abc')
    expect(w.find('textarea').attributes('id')).toBe('df-box-abc')
    expect(w.find('textarea').attributes('aria-describedby')).toBe('df-hint-abc')
  })

  it('without the case documents there is no Attach button, and nothing is attached', async () => {
    const w = mountBox()
    expect(w.find('.df-files').exists()).toBe(false)
    await w.find('textarea').setValue('Fix the date.')
    await button(w).trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual(['Fix the date.', []])
  })

  it('sends the case files the owner picked with the feedback', async () => {
    setActivePinia(createPinia())
    const documents: NegDocument[] = [
      { id: 'd1', fileName: 'valuation.pdf', contentType: 'application/pdf', sizeBytes: 9, label: null, createdAt: '' },
      { id: 'd2', fileName: 'photo.jpg', contentType: 'image/jpeg', sizeBytes: 9, label: null, createdAt: '' },
    ]
    const w = mountBox({ documents, caseId: 'case-1' })
    expect(w.find('.df-files').exists()).toBe(true)
    await w.find('.df-files .af-row button').trigger('click')
    await w.findAll('.af-pick input')[1].trigger('change')
    expect(w.find('.af-chips').text()).toContain('photo.jpg')
    await w.find('textarea').setValue('Use the valuation in this photo.')
    await button(w).trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual(['Use the valuation in this photo.', ['d2']])
  })
})
