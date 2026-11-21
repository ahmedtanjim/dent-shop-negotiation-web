import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CaseDetail, DraftRequest, Fact } from '@/api/types'

const api = vi.hoisted(() => ({
  getStandingAnswers: vi.fn(),
  deleteStandingAnswer: vi.fn(),
  deleteFact: vi.fn(),
  getDraftQuestions: vi.fn(),
  streamDraft: vi.fn(),
}))
vi.mock('@/api/negotiation', () => api)

import DraftPanel from './DraftPanel.vue'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { savedForEveryCaseVersion } from '@/utils/savedForEveryCase'

const detail = (state: string | null = 'TX', facts: Fact[] = []) =>
  ({
    case: { id: 'case-1', status: 'Open', state },
    messages: [],
    facts,
    documents: [],
    hasPlaybook: state === 'TX',
    playbookPendingReview: false,
  }) as unknown as CaseDetail

/** Every panel a test mounted: taken down afterwards, as leaving the page does (a panel left
 *  mounted would keep answering the shared "saved for every case" signal). */
const mounted: { unmount: () => void }[] = []

function mountPanel(state: string | null = 'TX', facts: Fact[] = []) {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  const w = mount(DraftPanel, { props: { detail: detail(state, facts) }, global: { stubs: { RouterLink: true } } })
  mounted.push(w)
  return w
}

const fact = (id: string, assertion: string, createdAt = '2026-11-21T18:00:00Z'): Fact => ({
  id,
  factDate: '2026-11-21T12:00:00Z',
  assertion,
  sourceMessageId: null,
  documentId: null,
  createdAt,
})

const question = { question: 'Did the customer sign a work order?', why: 'w', kind: 'YesNo' }
const written = () => api.streamDraft.mock.calls.at(-1)![2] as DraftRequest

describe('DraftPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getStandingAnswers.mockResolvedValue([])
    api.streamDraft.mockResolvedValue({ recommendsCounsel: false })
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
  })

  it('names the letter it will write on the button', async () => {
    const w = mountPanel()
    expect(w.find('.generate').text()).toBe('Generate shop letter')
    await w.find('input[value="Customer"]').setValue(true)
    expect(w.find('.generate').text()).toBe('Generate customer-voice letter')
  })

  it('a voice switched while the questions are open is the voice the letter is written in', async () => {
    api.getDraftQuestions.mockResolvedValue([question])
    const w = mountPanel()
    await w.find('.generate').trigger('click')
    await flushPromises()
    expect(api.getDraftQuestions.mock.calls[0][2]).toMatchObject({ voice: 'Shop' })

    await w.find('input[value="Customer"]').setValue(true)
    const write = w.find('.dq-actions .btn-primary')
    expect(write.text()).toBe('Skip and write the customer-voice letter')
    expect(write.attributes('disabled')).toBeDefined() // not authorized yet

    await w.find('.authz input').setValue(true)
    expect(write.attributes('disabled')).toBeUndefined()
    await write.trigger('click')
    await flushPromises()
    expect(written()).toMatchObject({ voice: 'Customer', customerAuthorized: true })
  })

  it('without questions the letter is written in the chosen voice straight away', async () => {
    api.getDraftQuestions.mockResolvedValue([])
    const w = mountPanel()
    await w.find('input[value="Customer"]').setValue(true)
    await w.find('.authz input').setValue(true)
    await w.find('.generate').trigger('click')
    await flushPromises()
    expect(written()).toMatchObject({ voice: 'Customer', customerAuthorized: true })
  })

  it('a case with no state says to set it, not that the state has no citations', () => {
    expect(mountPanel(null).find('.no-playbook').text()).toContain('no state yet')
    expect(mountPanel('WY').find('.no-playbook').text()).toContain('No attorney-reviewed citations for WY')
    expect(mountPanel('TX').find('.no-playbook').exists()).toBe(false)
  })

  // ── what the assistant remembers (owner 2026-11-22) ──────────────────────────

  const said = [
    fact('f-email', 'Adjuster requested an itemized breakdown.'), // read from an email: not the owner's words
    fact('f-answer', "Shop owner's answer — Did the customer sign a direction to pay? Yes"),
    fact('f-feedback', "Shop owner's feedback — The adjuster is Mike Torres, not Anne Gill."),
  ]

  it('lists what the owner told the assistant about this case, in their words', () => {
    const w = mountPanel('TX', said)
    const list = w.find('.said-on-case')
    expect(list.find('summary').text()).toBe('Saved for this case (2)')
    expect(list.findAll('li span').map((x) => x.text())).toEqual([
      'Did the customer sign a direction to pay? Yes',
      'The adjuster is Mike Torres, not Anne Gill.',
    ])
    // Nothing saved: no list at all.
    expect(mountPanel('TX', [said[0]]).find('.said-on-case').exists()).toBe(false)
  })

  it('lists them in the order they were said, whatever order the API sends', () => {
    const w = mountPanel('TX', [
      fact('f-3', "Shop owner's feedback — Third.", '2026-11-21T18:00:03Z'),
      fact('f-1', "Shop owner's answer — First? Yes", '2026-11-21T18:00:01Z'),
      fact('f-2', "Shop owner's feedback — Second.", '2026-11-21T18:00:02Z'),
    ])
    expect(w.findAll('.said-on-case li span').map((x) => x.text())).toEqual(['First? Yes', 'Second.', 'Third.'])
  })

  it('removing one forgets it and reloads the case', async () => {
    api.deleteFact.mockResolvedValue(undefined)
    const w = mountPanel('TX', said)
    await w.findAll('.said-on-case li button')[1].trigger('click')
    await flushPromises()
    expect(api.deleteFact).toHaveBeenCalledWith('shop-1', 'case-1', 'f-feedback')
    expect(w.emitted('refresh')).toHaveLength(1)
  })

  it('a removal that fails says why and reloads nothing', async () => {
    api.deleteFact.mockRejectedValue(new ApiError(403, 'Only owner/manager/admin can manage negotiations.'))
    const w = mountPanel('TX', said)
    await w.findAll('.said-on-case li button')[0].trigger('click')
    await flushPromises()
    expect(w.find('.error-text').text()).toBe('Only owner/manager/admin can manage negotiations.')
    expect(w.emitted('refresh')).toBeUndefined()
  })

  it('the every-case list shows an answer with its question and a wish as one sentence', async () => {
    api.getStandingAnswers.mockResolvedValue([
      { id: 's-1', question: 'Does every customer sign a direction to pay?', answer: 'Yes', createdAt: 'x', kind: 'Answer' },
      { id: 's-2', question: 'Sign letters as Fariha Khan, Office Manager.', answer: '', createdAt: 'x', kind: 'Preference' },
    ])
    const w = mountPanel()
    await flushPromises()
    const list = w.find('.standing:not(.said-on-case)')
    expect(list.find('summary').text()).toBe('Saved for every case (2)')
    const rows = list.findAll('li')
    expect(rows[0].find('span').text()).toBe('Does every customer sign a direction to pay? Yes')
    expect(rows[1].find('span').text()).toBe('Sign letters as Fariha Khan, Office Manager.')
    expect(rows[1].find('strong').exists()).toBe(false)

    api.deleteStandingAnswer.mockResolvedValue(undefined)
    await rows[1].find('button').trigger('click')
    await flushPromises()
    expect(api.deleteStandingAnswer).toHaveBeenCalledWith('shop-1', 's-2')
    expect(w.find('.standing:not(.said-on-case) summary').text()).toBe('Saved for every case (1)')
  })

  it('reloads the every-case list when something is saved for every case from a rewritten draft', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(api.getStandingAnswers).toHaveBeenCalledTimes(1)
    expect(w.find('.standing').exists()).toBe(false)

    api.getStandingAnswers.mockResolvedValue([
      { id: 's-2', question: 'Sign letters as Fariha Khan, Office Manager.', answer: '', createdAt: 'x', kind: 'Preference' },
    ])
    savedForEveryCaseVersion.value++
    await flushPromises()
    expect(api.getStandingAnswers).toHaveBeenCalledTimes(2)
    expect(w.find('.standing summary').text()).toBe('Saved for every case (1)')
  })
})
