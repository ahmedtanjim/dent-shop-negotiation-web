import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CaseDetail, DraftResult, NegMessage } from '@/api/types'

const api = vi.hoisted(() => ({
  streamDraft: vi.fn(),
  streamRevise: vi.fn(),
  getDraftQuestions: vi.fn(),
  deleteMessage: vi.fn(),
  extractPaste: vi.fn(),
  intakeEml: vi.fn(),
  intakeMessage: vi.fn(),
  markSent: vi.fn(),
  saveStandingPreference: vi.fn(),
  setMessageKind: vi.fn(),
}))
vi.mock('@/api/negotiation', () => api)

import TimelinePanel from './TimelinePanel.vue'
import DraftFeedback from './DraftFeedback.vue'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { provideCaseReadOnly } from '@/utils/readOnly'
import { draftPreview } from '@/utils/draftPreview'
import { everyCaseWishes, savedForEveryCaseVersion } from '@/utils/savedForEveryCase'

const msg = (id: string, kind: NegMessage['kind'], createdAt: string, body = `Body of ${id}`): NegMessage => ({
  id,
  kind,
  tone: kind === 'Inbound' ? null : 'Firm',
  voice: kind === 'Inbound' ? null : 'Shop',
  customerAuthorized: false,
  fromName: kind === 'Inbound' ? 'Mark Adjuster' : null,
  fromEmail: null,
  tactic: 'None',
  subject: `Subject of ${id}`,
  body,
  analysisSummary: null,
  occurredAt: null,
  createdAt,
})

const inbound = msg('in-1', 'Inbound', '2026-11-10T15:00:00Z')
const sent = msg('sent-1', 'Sent', '2026-11-11T15:00:00Z')
const draft = msg('draft-1', 'Draft', '2026-11-12T15:00:00Z')

const detail = (messages: NegMessage[], status = 'Open') =>
  ({
    case: { id: 'case-1', status, insurerName: 'Allstate' },
    messages,
    facts: [],
    documents: [],
  }) as unknown as CaseDetail

function mountPanel(d: CaseDetail, opts: { readOnly?: boolean; externalDrafting?: boolean } = {}) {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  // The workspace provides read-only; a host does the same here.
  const Host = defineComponent({
    props: { detail: { type: Object, required: true }, externalDrafting: Boolean },
    emits: ['refresh', 'counsel'],
    setup(props, { emit }) {
      provideCaseReadOnly(ref(opts.readOnly ?? false))
      return () =>
        h(TimelinePanel, {
          detail: props.detail as CaseDetail,
          externalDrafting: props.externalDrafting,
          onRefresh: () => emit('refresh'),
          onCounsel: () => emit('counsel'),
        })
    },
  })
  return mount(Host, { props: { detail: d, externalDrafting: opts.externalDrafting ?? false }, attachTo: document.body })
}

const card = (w: ReturnType<typeof mount>, id: string) => w.find(`#msg-${id}`)
const box = (w: ReturnType<typeof mount>, id: string) => card(w, id).findComponent(DraftFeedback)

/** A rewrite that stays "being written" until the test finishes it. */
function pendingRewrite() {
  let finish!: (r: DraftResult) => void
  let fail!: (e: unknown) => void
  let onText!: (t: string) => void
  api.streamRevise.mockImplementation(
    (_shop: string, _case: string, _id: string, _feedback: string, cb: (t: string) => void) => {
      onText = cb
      return new Promise<DraftResult>((res, rej) => {
        finish = res
        fail = rej
      })
    },
  )
  return { finish: (r: DraftResult) => finish(r), fail: (e: unknown) => fail(e), text: (t: string) => onText(t) }
}

async function ask(w: ReturnType<typeof mount>, id: string, feedback: string) {
  await box(w, id).find('textarea').setValue(feedback)
  await box(w, id).find('.df-send').trigger('click')
}

describe('TimelinePanel — feedback on a draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draftPreview.value = ''
    document.body.innerHTML = ''
  })

  it('every unsent draft has the box; received emails and sent letters do not', () => {
    const older = msg('draft-0', 'Draft', '2026-11-09T15:00:00Z')
    const w = mountPanel(detail([inbound, sent, draft, older]))
    expect(box(w, 'draft-1').exists()).toBe(true)
    expect(box(w, 'draft-0').exists()).toBe(true)
    expect(box(w, 'sent-1').exists()).toBe(false)
    expect(box(w, 'in-1').exists()).toBe(false)
  })

  it('a shop whose plan ended, and a case in litigation, get no box', () => {
    expect(box(mountPanel(detail([draft]), { readOnly: true }), 'draft-1').exists()).toBe(false)
    expect(box(mountPanel(detail([draft], 'Litigation')), 'draft-1').exists()).toBe(false)
  })

  it('sends the words for that draft, shows the letter as it is written, then reloads the case', async () => {
    const rewrite = pendingRewrite()
    const w = mountPanel(detail([inbound, draft]))
    await ask(w, 'draft-1', 'You left out the $150 tow bill.')

    expect(api.streamRevise).toHaveBeenCalledTimes(1)
    expect(api.streamRevise.mock.calls[0].slice(0, 4)).toEqual(['shop-1', 'case-1', 'draft-1', 'You left out the $150 tow bill.'])
    // no files picked: none sent
    expect(api.streamRevise.mock.calls[0][5]).toEqual([])
    // The letter being written sits at the top; the draft it replaces waits underneath.
    expect(w.find('.drafting-note').text()).toBe('Writing the letter again with your changes…')
    rewrite.text('Dear Mark,')
    await flushPromises()
    expect(w.find('.drafting-text').text()).toBe('Dear Mark,')
    expect(card(w, 'draft-1').find('.msg').classes()).toContain('revising')
    expect(box(w, 'draft-1').props('busy')).toBe(true)
    // Discarding it or marking it sent would race the rewrite: both wait.
    const buttons = card(w, 'draft-1').findAll('.msg-actions button')
    expect(buttons.find((b) => b.attributes('aria-label') === 'Discard draft')!.attributes('disabled')).toBeDefined()
    expect(buttons.find((b) => b.text().includes('Mark as sent'))!.attributes('disabled')).toBeDefined()
    expect(w.emitted('refresh')).toBeUndefined()

    rewrite.finish({ draft: msg('draft-2', 'Draft', '2026-11-12T15:01:00Z'), recommendsCounsel: false, note: 'I added the $150.00 tow bill.' })
    await flushPromises()
    expect(w.emitted('refresh')).toHaveLength(1)
    expect(w.emitted('counsel')).toBeUndefined()
    expect(w.find('.drafting-note').exists()).toBe(false)
    expect(draftPreview.value).toBe('')
  })

  it('the rewritten draft says what the assistant changed', async () => {
    const rewrite = pendingRewrite()
    const w = mountPanel(detail([inbound, draft]))
    await ask(w, 'draft-1', 'You left out the $150 tow bill.')
    const rewritten = msg('draft-2', 'Draft', '2026-11-12T15:01:00Z', 'The $150.00 tow bill is included.')
    rewrite.finish({ draft: rewritten, recommendsCounsel: false, note: 'I added the $150.00 tow bill to what they owe.' })
    await flushPromises()
    // The workspace reloads the case: the old draft is gone, the rewrite is there.
    await w.setProps({ detail: detail([inbound, rewritten]) })

    expect(card(w, 'draft-1').exists()).toBe(false)
    const note = card(w, 'draft-2').find('.revised-note')
    expect(note.text()).toContain('Rewritten from your feedback')
    expect(note.text()).toContain('I added the $150.00 tow bill to what they owe.')
    // A fresh box for the next round, and the buttons are back.
    expect((box(w, 'draft-2').find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(card(w, 'draft-2').findAll('.msg-actions button').find((b) => b.text().includes('Mark as sent'))!.attributes('disabled')).toBeUndefined()
  })

  it('a rewrite with nothing to report shows no note, and a counsel flag is passed on', async () => {
    const rewrite = pendingRewrite()
    const w = mountPanel(detail([draft]))
    await ask(w, 'draft-1', 'Fix the typo.')
    const rewritten = msg('draft-2', 'Draft', '2026-11-12T15:01:00Z')
    rewrite.finish({ draft: rewritten, recommendsCounsel: true, note: null })
    await flushPromises()
    await w.setProps({ detail: detail([rewritten]) })

    expect(w.emitted('counsel')).toHaveLength(1)
    expect(card(w, 'draft-2').find('.revised-note').exists()).toBe(false)
  })

  it('a refusal leaves the draft, the words and a reason, and nothing is reloaded', async () => {
    const rewrite = pendingRewrite()
    const w = mountPanel(detail([draft]))
    await ask(w, 'draft-1', 'Cite ORC 1333.41.')
    rewrite.fail(new ApiError(400, 'Draft rejected by the citation check.'))
    await flushPromises()

    expect(box(w, 'draft-1').find('.df-error').text()).toBe('Draft rejected by the citation check.')
    expect((box(w, 'draft-1').find('textarea').element as HTMLTextAreaElement).value).toBe('Cite ORC 1333.41.')
    expect(w.emitted('refresh')).toBeUndefined()
    expect(w.find('.drafting-note').exists()).toBe(false)
    expect(card(w, 'draft-1').find('.msg').classes()).not.toContain('revising')

    // Something that isn't the API's own message gets a plain one.
    const again = pendingRewrite()
    await box(w, 'draft-1').find('.df-send').trigger('click')
    again.fail(new Error('boom'))
    await flushPromises()
    expect(box(w, 'draft-1').find('.df-error').text()).toBe('The letter could not be rewritten. Try again.')
  })

  it('one letter at a time: a second draft waits while the first is rewritten', async () => {
    const older = msg('draft-0', 'Draft', '2026-11-09T15:00:00Z')
    const rewrite = pendingRewrite()
    const w = mountPanel(detail([draft, older]))
    await ask(w, 'draft-1', 'Fix the date.')

    expect(box(w, 'draft-0').props('blocked')).toBe(true)
    await ask(w, 'draft-0', 'Shorter.')
    expect(api.streamRevise).toHaveBeenCalledTimes(1)

    rewrite.finish({ draft: msg('draft-2', 'Draft', '2026-11-12T15:01:00Z'), recommendsCounsel: false })
    await flushPromises()
    expect(box(w, 'draft-0').props('blocked')).toBe(false)
  })

  it('a letter being written from the side panel holds the rewrite too', async () => {
    const w = mountPanel(detail([draft]), { externalDrafting: true })
    expect(box(w, 'draft-1').props('blocked')).toBe(true)
    await ask(w, 'draft-1', 'Fix the date.')
    expect(api.streamRevise).not.toHaveBeenCalled()
  })

  // ── what the rewrite kept for later letters (owner 2026-11-22) ───────────────

  const torres = { factId: 'f-1', text: 'The adjuster is Mike Torres, not Anne Gill.', everyLetter: false }
  const signature = { factId: 'f-2', text: 'Sign letters as Fariha Khan, Office Manager.', everyLetter: true }

  async function rewritten(result: Partial<DraftResult>) {
    everyCaseWishes.value = null // what the shop keeps for every case is shared by the two panels
    const rewrite = pendingRewrite()
    const w = mountPanel(detail([inbound, draft]))
    await ask(w, 'draft-1', "It's Mike Torres now. Always sign as Fariha.")
    const next = msg('draft-2', 'Draft', '2026-11-12T15:01:00Z')
    rewrite.finish({ draft: next, recommendsCounsel: false, ...result })
    await flushPromises()
    await w.setProps({ detail: detail([inbound, next]) })
    return w
  }

  it('lists what was saved for the case; only a wish about every letter can go to every case', async () => {
    const w = await rewritten({ note: 'I changed the name and the signature.', remembered: [torres, signature] })
    const note = card(w, 'draft-2').find('.revised-note')
    expect(note.text()).toContain('I changed the name and the signature.')
    expect(note.find('.kept-title').text()).toBe("Saved for this case, so you don't have to say it again:")
    const rows = note.findAll('.kept li')
    expect(rows.map((r) => r.find('.kept-text').text())).toEqual([torres.text, signature.text])
    expect(rows[0].find('button').exists()).toBe(false) // a fact of this claim stays on this claim
    expect(rows[1].find('button').text()).toBe('Save for every case')
    expect(api.saveStandingPreference).not.toHaveBeenCalled() // nothing is shop-wide on its own
  })

  it('"Save for every case" keeps the wish for the whole shop and says so', async () => {
    api.saveStandingPreference.mockResolvedValue({ id: 's-1', question: signature.text, answer: '', createdAt: 'x', kind: 'Preference' })
    const before = savedForEveryCaseVersion.value
    const w = await rewritten({ note: 'Done.', remembered: [torres, signature] })
    const row = () => card(w, 'draft-2').findAll('.kept li')[1]

    await row().find('button').trigger('click')
    await flushPromises()

    expect(api.saveStandingPreference).toHaveBeenCalledWith('shop-1', signature.text)
    expect(row().find('button').exists()).toBe(false)
    expect(row().find('.kept-done').text()).toBe('Saved for every case')
    expect(savedForEveryCaseVersion.value).toBe(before + 1) // the draft panel's list reloads
  })

  it('a wish that could not be saved says why and can be tried again', async () => {
    api.saveStandingPreference.mockRejectedValue(new ApiError(400, 'A shop can keep up to 25 things for every case. Remove one first.'))
    const before = savedForEveryCaseVersion.value
    const w = await rewritten({ note: null, remembered: [signature] })
    const note = card(w, 'draft-2').find('.revised-note')
    expect(note.exists()).toBe(true) // nothing to say about the letter, but something was saved

    await note.find('.kept li button').trigger('click')
    await flushPromises()

    expect(note.find('.error-text').text()).toBe('A shop can keep up to 25 things for every case. Remove one first.')
    expect(note.find('.kept li button').attributes('disabled')).toBeUndefined()
    expect(savedForEveryCaseVersion.value).toBe(before)
  })

  it('a sentence removed from the case, or a wish no longer kept for every case, leaves the note too', async () => {
    api.saveStandingPreference.mockResolvedValue({ id: 's-1', question: signature.text, answer: '', createdAt: 'x', kind: 'Preference' })
    const w = await rewritten({ note: 'Done.', remembered: [torres, signature] })
    const rows = () => card(w, 'draft-2').findAll('.kept li')
    const next = msg('draft-2', 'Draft', '2026-11-12T15:01:00Z')
    const fact = (id: string, text: string) => ({ id, factDate: 'x', assertion: `Shop owner's feedback — ${text}`, sourceMessageId: null, documentId: null, createdAt: 'x' })
    const withFacts = (facts: unknown[]) => ({ ...detail([inbound, next]), facts }) as unknown as CaseDetail

    // The case reloads with both on its fact list: both rows stay.
    await w.setProps({ detail: withFacts([fact('f-1', torres.text), fact('f-2', signature.text)]) })
    expect(rows()).toHaveLength(2)
    await rows()[1].find('button').trigger('click')
    await flushPromises()
    expect(rows()[1].find('.kept-done').text()).toBe('Saved for every case')
    // The label takes the keyboard focus the button had.
    expect(rows()[1].find('.kept-done').attributes('tabindex')).toBe('-1')

    // The owner removes the Torres line in the draft panel: it is gone from the note as well.
    await w.setProps({ detail: withFacts([fact('f-2', signature.text)]) })
    expect(rows().map((r) => r.find('.kept-text').text())).toEqual([signature.text])

    // ...and takes the wish off "Saved for every case" there: the offer is back here.
    everyCaseWishes.value = new Set()
    await flushPromises()
    expect(rows()[0].find('.kept-done').exists()).toBe(false)
    expect(rows()[0].find('button').text()).toBe('Save for every case')

    // Everything removed: the note keeps what it says about the letter, without the list.
    await w.setProps({ detail: withFacts([]) })
    expect(card(w, 'draft-2').find('.revised-note').text()).toContain('Done.')
    expect(card(w, 'draft-2').find('.kept-title').exists()).toBe(false)
  })

  it('an API that reports nothing saved shows the note alone', async () => {
    const w = await rewritten({ note: 'I tightened the opening.', remembered: [] })
    const note = card(w, 'draft-2').find('.revised-note')
    expect(note.text()).toContain('I tightened the opening.')
    expect(note.find('.kept').exists()).toBe(false)
    expect(note.find('.kept-title').exists()).toBe(false)
  })
})
