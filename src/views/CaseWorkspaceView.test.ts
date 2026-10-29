import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { CaseDetail, GeneratedDocs, InvoiceBreakdown } from '@/api/types'

const api = vi.hoisted(() => ({
  getCase: vi.fn(),
  getGeneratedDocs: vi.fn(),
  deleteCase: vi.fn(),
  setCaseStatus: vi.fn(),
}))
vi.mock('@/api/negotiation', () => api)
vi.mock('@/router', () => ({ setTitle: vi.fn() }))
vi.mock('@/tour', () => ({ workspaceTourSeen: () => true, startWorkspaceTour: vi.fn() }))

import CaseWorkspaceView from './CaseWorkspaceView.vue'
import CaseSidebar from '@/components/CaseSidebar.vue'
import DraftPanel from '@/components/DraftPanel.vue'
import InvoiceCard from '@/components/InvoiceCard.vue'
import LetterColumns from '@/components/LetterColumns.vue'
import TimelinePanel from '@/components/TimelinePanel.vue'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const detail = {
  case: {
    id: 'case-1',
    title: 'Smith — 2021 Tahoe',
    status: 'Open',
    insurerName: null,
    insurerClaimNumber: null,
    customerName: 'Smith',
    state: null,
    invoiceTotalCents: 0,
  },
  messages: [],
  facts: [],
  documents: [],
  storagePerDayCents: 5000,
  storageStartDate: '2026-10-20',
  storageEndDate: null,
} as unknown as CaseDetail

/** Documents whose invoice totals `total` — enough to tell one reload's result from another. */
const docsWith = (total: number): GeneratedDocs => ({
  invoice: { total, storageEnd: '2026-10-29' } as InvoiceBreakdown,
  documents: [],
})

/** A promise the test settles by hand, so reloads can land in any order. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** `errors` collects what the view throws (an event handler's rejection) instead of failing the run. */
async function mountWorkspace(errors?: unknown[]) {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'cases', component: { render: () => null } },
      { path: '/cases/:id', name: 'case', component: { render: () => null } },
    ],
  })
  await router.push('/cases/case-1')
  const config = errors ? { errorHandler: (e: unknown) => void errors.push(e) } : {}
  const wrapper = shallowMount(CaseWorkspaceView, { props: { id: 'case-1' }, global: { plugins: [router], config } })
  await flushPromises()
  const card = () => wrapper.getComponent(InvoiceCard)
  return { wrapper, router, card }
}

/** Another case, as the app opens it: RouterView hands the view the new id, then the route
 *  changes (the view re-reads on the route's id). */
async function openCase(wrapper: VueWrapper, router: Router, id: string) {
  await wrapper.setProps({ id })
  await router.push(`/cases/${id}`)
}

/** The case `id` titled `title` — the same case as `detail` otherwise. */
const caseWith = (id: string, title: string): CaseDetail => ({ ...detail, case: { ...detail.case, id, title } })
const caseB = caseWith('case-2', 'Jones — 2019 F-150')

describe('CaseWorkspaceView documents reloads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getCase.mockResolvedValue(detail)
  })

  it('a slower earlier reload never puts back an older invoice', async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { card } = await mountWorkspace()
    expect(card().props('invoice')?.total).toBe(100)

    const first = deferred<GeneratedDocs>()
    const second = deferred<GeneratedDocs>()
    api.getGeneratedDocs.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    card().vm.$emit('refresh')
    await flushPromises()
    card().vm.$emit('refresh')
    await flushPromises()

    second.resolve(docsWith(300))
    await flushPromises()
    expect(card().props('invoice')?.total).toBe(300)
    first.resolve(docsWith(200)) // lands last, but it is the older reload
    await flushPromises()
    expect(card().props('invoice')?.total).toBe(300)
  })

  it("an earlier reload's failure is not reported while a newer one is on its way", async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { card } = await mountWorkspace()

    // Save 1's refresh reads the case and starts on the documents…
    const firstDocs = deferred<GeneratedDocs>()
    api.getGeneratedDocs.mockReturnValueOnce(firstDocs.promise)
    card().vm.$emit('refresh')
    await flushPromises()
    // …save 2's refresh is still reading the case when save 1's documents fail.
    const secondCase = deferred<CaseDetail>()
    api.getCase.mockReturnValueOnce(secondCase.promise)
    card().vm.$emit('refresh')
    await flushPromises()
    firstDocs.reject(new Error('network'))
    await flushPromises()
    expect(card().props('refreshError')).toBeNull()

    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(300))
    secondCase.resolve(detail)
    await flushPromises()
    expect(card().props('invoice')?.total).toBe(300)
    expect(card().props('refreshError')).toBeNull()
  })

  it('the newest reload failing is reported to the invoice card', async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { card } = await mountWorkspace()
    api.getGeneratedDocs.mockRejectedValueOnce(new Error('network'))
    card().vm.$emit('refresh')
    await flushPromises()
    expect(card().props('refreshError')).toBe('Could not generate the documents.')
    expect(card().props('invoice')?.total).toBe(100)
  })
})

describe('CaseWorkspaceView case reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getCase.mockResolvedValue(detail)
    // A documents read nobody expects shows up as 999.
    api.getGeneratedDocs.mockResolvedValue(docsWith(999))
  })

  it("the previous case's slower read never lands under the case opened after it", async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { wrapper, router, card } = await mountWorkspace()
    expect(wrapper.get('h1').text()).toBe('Smith — 2021 Tahoe')

    // Case A's refresh (after a save) is still reading when the user opens case B.
    const aRead = deferred<CaseDetail>()
    const bRead = deferred<CaseDetail>()
    api.getCase.mockReturnValueOnce(aRead.promise).mockReturnValueOnce(bRead.promise)
    card().vm.$emit('refresh')
    await flushPromises()
    await openCase(wrapper, router, 'case-2')
    expect(api.getCase).toHaveBeenLastCalledWith('shop-1', 'case-2')

    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(300))
    bRead.resolve(caseB)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
    aRead.resolve(detail) // case A's read lands last
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
    expect(wrapper.getComponent(CaseSidebar).props('detail').case.id).toBe('case-2')
    expect(card().props('detail').case.id).toBe('case-2')
    expect(card().props('invoice')?.total).toBe(300)
    expect(api.getGeneratedDocs).toHaveBeenLastCalledWith('shop-1', 'case-2')
  })

  it('a slower earlier read never puts back the case as it was before a save', async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { wrapper } = await mountWorkspace()
    const sidebar = () => wrapper.getComponent(CaseSidebar)

    // An edit's refresh starts reading; a save lands and its refresh reads again.
    const beforeSave = deferred<CaseDetail>()
    const afterSave = deferred<CaseDetail>()
    api.getCase.mockReturnValueOnce(beforeSave.promise).mockReturnValueOnce(afterSave.promise)
    sidebar().vm.$emit('refresh')
    await flushPromises()
    sidebar().vm.$emit('refresh')
    await flushPromises()

    afterSave.resolve(caseWith('case-1', 'Smith — 2021 Tahoe (total loss)'))
    await flushPromises()
    beforeSave.resolve(detail) // the earlier read lands last, with the old title
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Smith — 2021 Tahoe (total loss)')
    expect(sidebar().props('detail').case.title).toBe('Smith — 2021 Tahoe (total loss)')
  })

  it("an earlier read's failure never replaces the case a newer read brought", async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { wrapper } = await mountWorkspace()

    const first = deferred<CaseDetail>()
    api.getCase.mockReturnValueOnce(first.promise).mockResolvedValueOnce(detail)
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(300))
    wrapper.getComponent(CaseSidebar).vm.$emit('refresh')
    await flushPromises()
    wrapper.getComponent(CaseSidebar).vm.$emit('refresh')
    await flushPromises()
    first.reject(new ApiError(404, 'Not found'))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Case not found')
    expect(wrapper.get('h1').text()).toBe('Smith — 2021 Tahoe')
    expect(wrapper.getComponent(InvoiceCard).props('invoice')?.total).toBe(300)
  })

  it("another case never shows the previous case's documents while its own load", async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { wrapper, router, card } = await mountWorkspace()
    expect(wrapper.text()).toContain('$100.00')

    const bDocs = deferred<GeneratedDocs>()
    api.getCase.mockResolvedValueOnce(caseB)
    api.getGeneratedDocs.mockReturnValueOnce(bDocs.promise)
    await openCase(wrapper, router, 'case-2')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
    expect(card().props('invoice')).toBeNull()
    expect(wrapper.getComponent(LetterColumns).props()).toMatchObject({ docs: null, loading: true })
    expect(wrapper.text()).not.toContain('$100.00')

    bDocs.resolve(docsWith(300))
    await flushPromises()
    expect(card().props('invoice')?.total).toBe(300)
    expect(wrapper.getComponent(LetterColumns).props('loading')).toBe(false)
  })

  it('an earlier read landing first keeps the spinner until the opened case arrives', async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { wrapper, router, card } = await mountWorkspace()

    // Case A's refresh is still reading when the user opens case B; A's read lands first.
    const aRead = deferred<CaseDetail>()
    const bRead = deferred<CaseDetail>()
    api.getCase.mockReturnValueOnce(aRead.promise).mockReturnValueOnce(bRead.promise)
    card().vm.$emit('refresh')
    await flushPromises()
    await openCase(wrapper, router, 'case-2')
    aRead.resolve(detail)
    await flushPromises()
    expect(wrapper.text()).toContain('Loading case…')
    expect(wrapper.find('h1').exists()).toBe(false)

    bRead.resolve(caseB)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Loading case…')
    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
  })

  it("the previous case's counsel banner, status error and running draft don't carry over", async () => {
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(100))
    const { wrapper, router } = await mountWorkspace()
    useAuthStore().role = 'Owner' // the status picker shows
    await flushPromises()

    wrapper.getComponent(TimelinePanel).vm.$emit('counsel')
    wrapper.getComponent(DraftPanel).vm.$emit('drafting', true)
    api.setCaseStatus.mockRejectedValueOnce(new ApiError(409, 'Status not changed.'))
    await wrapper.get('select').setValue('Settled')
    await flushPromises()
    expect(wrapper.find('.counsel-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('Status not changed.')
    expect(wrapper.getComponent(TimelinePanel).props('externalDrafting')).toBe(true)

    // Case A's draft panel unmounts with A, so it never reports its draft ending.
    api.getCase.mockResolvedValueOnce(caseB)
    api.getGeneratedDocs.mockResolvedValueOnce(docsWith(300))
    await openCase(wrapper, router, 'case-2')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
    expect(wrapper.find('.counsel-banner').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Status not changed.')
    expect(wrapper.getComponent(TimelinePanel).props('externalDrafting')).toBe(false)
  })
})

describe('CaseWorkspaceView requests still running when another case opens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getCase.mockResolvedValue(detail)
    api.getGeneratedDocs.mockResolvedValue(docsWith(999))
    vi.stubGlobal('confirm', () => true)
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Case A's workspace as its owner, so the status picker and Delete show. */
  async function asOwner(errors?: unknown[]) {
    const mounted = await mountWorkspace(errors)
    useAuthStore().role = 'Owner'
    await flushPromises()
    return mounted
  }
  const deleteButton = (wrapper: VueWrapper) => wrapper.get<HTMLButtonElement>('.delete-case')

  it("the previous case's failing status change shows nothing on the case opened after it", async () => {
    const errors: unknown[] = []
    const { wrapper, router } = await asOwner(errors)
    const change = deferred<void>()
    api.setCaseStatus.mockReturnValueOnce(change.promise)
    await wrapper.get('select').setValue('Settled')
    expect(wrapper.get('select').element.disabled).toBe(true)

    // Case B is still loading when A's status change fails.
    const bRead = deferred<CaseDetail>()
    api.getCase.mockReturnValueOnce(bRead.promise)
    await openCase(wrapper, router, 'case-2')
    change.reject(new ApiError(409, 'Status not changed.'))
    await flushPromises()
    bRead.resolve(caseB)
    await flushPromises()

    expect(errors).toEqual([])
    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
    expect(wrapper.text()).not.toContain('Status not changed.')
    expect(wrapper.get('select').element.value).toBe('Open')
    expect(wrapper.get('select').element.disabled).toBe(false)
  })

  it.each([
    ['goes through', (d: ReturnType<typeof deferred<void>>) => d.resolve()],
    ['fails', (d: ReturnType<typeof deferred<void>>) => d.reject(new ApiError(500, 'Delete failed.'))],
  ])("the previous case's delete that %s never reaches the case opened after it", async (_, settle) => {
    const errors: unknown[] = []
    const { wrapper, router } = await asOwner(errors)
    const del = deferred<void>()
    api.deleteCase.mockReturnValueOnce(del.promise)
    await deleteButton(wrapper).trigger('click')
    expect(deleteButton(wrapper).text()).toBe('Deleting…')

    api.getCase.mockResolvedValueOnce(caseB)
    await openCase(wrapper, router, 'case-2')
    await flushPromises()
    expect(deleteButton(wrapper).text()).toBe('Delete case')
    expect(deleteButton(wrapper).element.disabled).toBe(false)

    settle(del)
    await flushPromises()
    expect(errors).toEqual([])
    expect(router.currentRoute.value.fullPath).toBe('/cases/case-2')
    expect(wrapper.get('h1').text()).toBe('Jones — 2019 F-150')
    expect(wrapper.text()).not.toContain('Delete failed.')
    expect(deleteButton(wrapper).text()).toBe('Delete case')
  })

  it("the previous case's status change settling never frees the picker while this case's own change runs", async () => {
    const { wrapper, router } = await asOwner()
    const changeA = deferred<void>()
    api.setCaseStatus.mockReturnValueOnce(changeA.promise)
    await wrapper.get('select').setValue('Settled')

    api.getCase.mockResolvedValueOnce(caseB)
    await openCase(wrapper, router, 'case-2')
    await flushPromises()
    const changeB = deferred<void>()
    api.setCaseStatus.mockReturnValueOnce(changeB.promise)
    await wrapper.get('select').setValue('Settled')
    expect(wrapper.get('select').element.disabled).toBe(true)

    changeA.resolve()
    await flushPromises()
    expect(wrapper.get('select').element.disabled).toBe(true)
    changeB.resolve()
    await flushPromises()
    expect(wrapper.get('select').element.disabled).toBe(false)
  })

  it('a status change or delete that lands after A → B → A still updates case A', async () => {
    const { wrapper, router } = await asOwner()
    const change = deferred<void>()
    api.setCaseStatus.mockReturnValueOnce(change.promise)
    await wrapper.get('select').setValue('Settled')

    // Over to B and straight back to A; A's fresh read comes back before the change is applied.
    api.getCase.mockResolvedValueOnce(caseB)
    await openCase(wrapper, router, 'case-2')
    await flushPromises()
    await openCase(wrapper, router, 'case-1')
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('Open')

    const settled = { ...detail, case: { ...detail.case, status: 'Settled' } } as CaseDetail
    api.getCase.mockResolvedValueOnce(settled)
    change.resolve()
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('Settled')

    const del = deferred<void>()
    api.deleteCase.mockReturnValueOnce(del.promise)
    await deleteButton(wrapper).trigger('click')
    api.getCase.mockResolvedValueOnce(caseB)
    await openCase(wrapper, router, 'case-2')
    await flushPromises()
    api.getCase.mockResolvedValueOnce(settled)
    await openCase(wrapper, router, 'case-1')
    await flushPromises()
    del.resolve()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('cases')
  })

  it('a delete that finishes after the user left the workspace leaves them where they went', async () => {
    const { wrapper, router } = await asOwner()
    const del = deferred<void>()
    api.deleteCase.mockReturnValueOnce(del.promise)
    await deleteButton(wrapper).trigger('click')

    // Back to the list and into another case: a new workspace, this one is gone.
    wrapper.unmount()
    await router.push('/cases/case-2')
    del.resolve()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/cases/case-2')
  })

  it("the case's own status change and delete still land", async () => {
    const { wrapper, router } = await asOwner()
    api.setCaseStatus.mockRejectedValueOnce(new ApiError(409, 'Status not changed.'))
    await wrapper.get('select').setValue('Settled')
    await flushPromises()
    expect(wrapper.text()).toContain('Status not changed.')
    expect(wrapper.get('select').element.value).toBe('Open')
    expect(wrapper.get('select').element.disabled).toBe(false)

    api.deleteCase.mockResolvedValueOnce(undefined)
    await deleteButton(wrapper).trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('cases')
  })
})
