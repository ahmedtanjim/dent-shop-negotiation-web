import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CaseDetail, DraftRequest } from '@/api/types'

const api = vi.hoisted(() => ({
  getStandingAnswers: vi.fn(),
  deleteStandingAnswer: vi.fn(),
  getDraftQuestions: vi.fn(),
  streamDraft: vi.fn(),
}))
vi.mock('@/api/negotiation', () => api)

import DraftPanel from './DraftPanel.vue'
import { useAuthStore } from '@/stores/auth'

const detail = (state: string | null = 'TX') =>
  ({
    case: { id: 'case-1', status: 'Open', state },
    messages: [],
    facts: [],
    documents: [],
    hasPlaybook: state === 'TX',
    playbookPendingReview: false,
  }) as unknown as CaseDetail

function mountPanel(state: string | null = 'TX') {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  return mount(DraftPanel, { props: { detail: detail(state) }, global: { stubs: { RouterLink: true } } })
}

const question = { question: 'Did the customer sign a work order?', why: 'w', kind: 'YesNo' }
const written = () => api.streamDraft.mock.calls.at(-1)![2] as DraftRequest

describe('DraftPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getStandingAnswers.mockResolvedValue([])
    api.streamDraft.mockResolvedValue({ recommendsCounsel: false })
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
})
