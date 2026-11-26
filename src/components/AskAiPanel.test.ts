import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CaseDetail, ChatMessage, NegDocument } from '@/api/types'

const api = vi.hoisted(() => ({
  getChat: vi.fn(),
  askAi: vi.fn(),
  uploadDocument: vi.fn(),
}))
vi.mock('@/api/negotiation', () => api)

import AskAiPanel from './AskAiPanel.vue'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { provideCaseReadOnly } from '@/utils/readOnly'

const doc = (id: string, fileName: string, contentType = 'application/pdf'): NegDocument => ({
  id,
  fileName,
  contentType,
  sizeBytes: 1000,
  label: null,
  createdAt: '2026-11-20T10:00:00Z',
})

const detail = (caseId = 'case-1', documents: NegDocument[] = [doc('d1', 'valuation.pdf'), doc('d2', 'tow.zip', 'application/zip')]) =>
  ({ case: { id: caseId, status: 'Open' }, messages: [], facts: [], documents }) as unknown as CaseDetail

function mountPanel(d: CaseDetail, opts: { active?: boolean; readOnly?: boolean } = {}) {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  const Host = defineComponent({
    props: { detail: { type: Object, required: true }, active: Boolean },
    emits: ['refresh'],
    setup(props, { emit }) {
      provideCaseReadOnly(ref(opts.readOnly ?? false))
      return () =>
        h(AskAiPanel, { detail: props.detail as CaseDetail, active: props.active, onRefresh: () => emit('refresh') })
    },
  })
  return mount(Host, { props: { detail: d, active: opts.active ?? true }, attachTo: document.body })
}

const answer = (id: string, content: string): ChatMessage => ({
  id,
  role: 'Assistant',
  content,
  createdAt: '2026-11-26T10:00:00Z',
})

beforeEach(() => {
  vi.resetAllMocks()
  api.getChat.mockResolvedValue([])
})

describe('AskAiPanel', () => {
  it('loads the conversation only once the tab is on screen', async () => {
    const w = mountPanel(detail(), { active: false })
    await flushPromises()
    expect(api.getChat).not.toHaveBeenCalled()
    await w.setProps({ active: true })
    await flushPromises()
    expect(api.getChat).toHaveBeenCalledWith('shop-1', 'case-1')
    await w.setProps({ active: false })
    await w.setProps({ active: true })
    await flushPromises()
    expect(api.getChat).toHaveBeenCalledTimes(1)
  })

  it('shows earlier turns: the question as typed, the answer rendered, and the files that went with it', async () => {
    api.getChat.mockResolvedValue([
      {
        id: 'u1',
        role: 'User',
        content: '<b>Is storage owed?</b>',
        createdAt: '2026-11-26T09:00:00Z',
        attachments: [{ documentId: 'd1', fileName: 'valuation.pdf' }],
      },
      answer('a1', 'Yes. **Storage** runs until pickup.'),
    ])
    const w = mountPanel(detail())
    await flushPromises()
    const turns = w.findAll('.turn')
    expect(turns).toHaveLength(2)
    // the owner's own words are text, never HTML
    expect(turns[0].find('.turn-text').text()).toBe('<b>Is storage owed?</b>')
    expect(turns[0].find('b').exists()).toBe(false)
    expect(turns[0].find('.turn-files').text()).toContain('valuation.pdf')
    expect(turns[1].find('strong').text()).toBe('Storage')
  })

  it('offers suggestions on an empty conversation, and a pick fills the box', async () => {
    const w = mountPanel(detail())
    await flushPromises()
    const pick = w.find('.ask-suggest button')
    await pick.trigger('click')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe(pick.text())
  })

  it('asks with the chosen files and adds both turns when the answer lands', async () => {
    let resolve!: (m: ChatMessage) => void
    api.askAi.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = mountPanel(detail())
    await flushPromises()
    // the Ask button waits for words
    expect(w.find('.ask-send').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('  What should I do next?  ')
    await w.find('.af-row button').trigger('click')
    const boxes = w.findAll('.af-pick input')
    // a file the assistant can't read can't be picked
    expect(boxes[1].attributes('disabled')).toBeDefined()
    await boxes[0].trigger('change')
    await w.find('form').trigger('submit')
    expect(api.askAi).toHaveBeenCalledWith('shop-1', 'case-1', 'What should I do next?', ['d1'])
    expect(w.text()).toContain('Thinking…')
    expect(w.find('.ask-send').attributes('disabled')).toBeDefined()

    resolve(answer('a9', 'Send the demand letter.'))
    await flushPromises()
    const turns = w.findAll('.turn')
    expect(turns).toHaveLength(2)
    expect(turns[0].text()).toContain('What should I do next?')
    expect(turns[0].text()).toContain('valuation.pdf')
    expect(turns[1].text()).toContain('Send the demand letter.')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(w.find('.af-chips').exists()).toBe(false)
  })

  it('a refusal shows the API message and keeps the question to try again', async () => {
    api.askAi.mockRejectedValue(new ApiError(400, 'Attach at most 5 files at a time.'))
    const w = mountPanel(detail())
    await flushPromises()
    await w.find('textarea').setValue('Help')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toBe('Attach at most 5 files at a time.')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('Help')
    expect(w.findAll('.turn')).toHaveLength(0)
  })

  it('an answer for the case left behind lands nowhere', async () => {
    let resolve!: (m: ChatMessage) => void
    api.askAi.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = mountPanel(detail('case-1'))
    await flushPromises()
    await w.find('textarea').setValue('Question for case 1')
    await w.find('form').trigger('submit')
    await w.setProps({ detail: detail('case-2') })
    await flushPromises()
    resolve(answer('late', 'Late answer'))
    await flushPromises()
    expect(w.text()).not.toContain('Late answer')
    expect(w.text()).not.toContain('Thinking…')
    expect(api.getChat).toHaveBeenLastCalledWith('shop-1', 'case-2')
  })

  it('a failed load says so with Retry', async () => {
    api.getChat.mockRejectedValueOnce(new Error('boom'))
    const w = mountPanel(detail())
    await flushPromises()
    expect(w.text()).toContain('The conversation could not be loaded.')
    await w.find('.ask-list button').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('could not be loaded')
  })

  it('read-only: the conversation shows, but nothing can be asked', async () => {
    const w = mountPanel(detail(), { readOnly: true })
    await flushPromises()
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('.ask-suggest').exists()).toBe(false)
    expect(w.text()).toContain('No questions were asked on this case.')
  })

  it('a file uploaded from the attach panel is picked and tells the workspace to reload', async () => {
    api.uploadDocument.mockResolvedValue(doc('d3', 'email.eml', 'message/rfc822'))
    const w = mountPanel(detail())
    await flushPromises()
    await w.find('.af-row button').trigger('click')
    const input = w.find('input[type="file"]')
    const file = new File(['From: adjuster'], 'email.eml', { type: 'message/rfc822' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()
    expect(api.uploadDocument).toHaveBeenCalledWith('shop-1', 'case-1', file)
    expect(w.find('.af-chips').text()).toContain('email.eml')
    expect(w.emitted('refresh')).toHaveLength(1)
  })
})
