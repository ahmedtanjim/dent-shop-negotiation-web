import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DraftQuestions from './DraftQuestions.vue'
import type { DraftAnswer, DraftQuestion } from '@/api/types'

const q: DraftQuestion = { question: 'Did the customer sign a work order?', why: 'w', kind: 'YesNo' }
const chip = (w: ReturnType<typeof mount>, label: string) =>
  w.findAll('.dq-chip').find((b) => b.text() === label)!
const sent = (w: ReturnType<typeof mount>) => (w.emitted('submit')![0] as [DraftAnswer[]])[0]

describe('DraftQuestions', () => {
  it('offers Not sure, and it cannot be kept for every car', async () => {
    const w = mount(DraftQuestions, { props: { questions: [q] } })
    await chip(w, 'Not sure').trigger('click')
    expect(w.find('.dq-always').exists()).toBe(false)
    await w.find('.btn-primary').trigger('click')
    expect(sent(w)[0]).toMatchObject({ answer: 'Not sure', always: false })
  })

  it('sends a yes kept for every car', async () => {
    const w = mount(DraftQuestions, { props: { questions: [q] } })
    await chip(w, 'Yes').trigger('click')
    await w.find('.dq-always input').setValue(true)
    await w.find('.btn-primary').trigger('click')
    expect(sent(w)[0]).toMatchObject({ answer: 'Yes', always: true })
  })

  it('a tick does not survive changing the answer to Not sure', async () => {
    const w = mount(DraftQuestions, { props: { questions: [q] } })
    await chip(w, 'Yes').trigger('click')
    await w.find('.dq-always input').setValue(true)
    await chip(w, 'Not sure').trigger('click')
    await w.find('.btn-primary').trigger('click')
    expect(sent(w)[0]).toMatchObject({ answer: 'Not sure', always: false })
  })
})
