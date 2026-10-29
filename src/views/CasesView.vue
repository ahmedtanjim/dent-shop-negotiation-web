<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, FolderOpen, Settings2, Search, Trash2, RotateCcw, X } from 'lucide-vue-next'
import { listCases, listDeletedCases, restoreCase } from '@/api/negotiation'
import { getAiUsage } from '@/api/usage'
import { ApiError, CRM_URL } from '@/api/client'
import type { AiUsageSummary, CaseListItem } from '@/api/types'
import { centsToUsd, formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import StatusPill from '@/components/StatusPill.vue'
import NewCaseModal from '@/components/NewCaseModal.vue'
import ShopRatesModal from '@/components/ShopRatesModal.vue'
import { casesTourSeen, startCasesTour } from '@/tour'

const auth = useAuthStore()
/** A shop whose AI plan ended reads its cases (ent.readOnly) but can't add or change them:
 *  the API refuses every write with 402, which would bounce the user to the paywall. */
const ent = useEntitlementStore()
const router = useRouter()
const route = useRoute()

const cases = ref<CaseListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showNew = ref(false)
const showRates = ref(false)
/** Fair-use meter: what the shop has spent of its AI allowance this month. Owners,
 *  managers and admins see it (auth.canSeeUsage); a failed read simply hides it (the API's
 *  429 is the real gate). Deleting and restoring cases is auth.canDeleteCases. */
const usage = ref<AiUsageSummary | null>(null)

// ---- list tools: search, filters, sort. Closed cases are hidden by default — "Closed" is the
// archive, so nothing else is needed to tidy the list. Choices stick per browser. ----
type StatusFilter = 'active' | 'all' | 'Open' | 'Settled' | 'Litigation' | 'Closed'
type SortKey = 'updated' | 'created' | 'customer' | 'insurer' | 'storm' | 'invoice'
const PREFS_KEY = 'dsm_neg_case_list'
const query = ref('')
const statusFilter = ref<StatusFilter>('active')
const stormFilter = ref<string>('')     // '' = any, 'none' = no storm, else stormId
const insurerFilter = ref<string>('')
const sortBy = ref<SortKey>('updated')
try {
  const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<{ status: StatusFilter; sort: SortKey }>
  if (saved.status) statusFilter.value = saved.status
  if (saved.sort) sortBy.value = saved.sort
} catch { /* ignore */ }
watch([statusFilter, sortBy], ([status, sort]) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ status, sort })) } catch { /* ignore */ }
})

const storms = computed(() => {
  const m = new Map<string, string>()
  for (const c of cases.value) if (c.stormId && c.stormName) m.set(c.stormId, c.stormName)
  return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
})
const hasUnstormed = computed(() => cases.value.some((c) => !c.stormId))
const insurers = computed(() =>
  [...new Set(cases.value.map((c) => c.insurerName).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)),
)
const closedCount = computed(() => cases.value.filter((c) => c.status === 'Closed').length)
const filtersActive = computed(
  () => query.value.trim() !== '' || statusFilter.value !== 'active' || stormFilter.value !== '' || insurerFilter.value !== '',
)
function clearFilters() {
  query.value = ''
  statusFilter.value = 'active'
  stormFilter.value = ''
  insurerFilter.value = ''
}

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const str = (v: string | null | undefined) => (v ?? '').toLowerCase()
  let rows = cases.value.filter((c) => {
    if (statusFilter.value === 'active' ? c.status === 'Closed' : statusFilter.value !== 'all' && c.status !== statusFilter.value)
      return false
    if (stormFilter.value === 'none' ? !!c.stormId : stormFilter.value !== '' && c.stormId !== stormFilter.value) return false
    if (insurerFilter.value && c.insurerName !== insurerFilter.value) return false
    if (q && ![c.title, c.customerName, c.insurerName, c.insurerClaimNumber, c.stormName].some((v) => str(v).includes(q)))
      return false
    return true
  })
  const cmp = (a: string | null | undefined, b: string | null | undefined) => str(a).localeCompare(str(b))
  const by: Record<SortKey, (a: CaseListItem, b: CaseListItem) => number> = {
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    customer: (a, b) => cmp(a.customerName, b.customerName) || cmp(a.title, b.title),
    insurer: (a, b) => cmp(a.insurerName, b.insurerName) || b.updatedAt.localeCompare(a.updatedAt),
    storm: (a, b) => (a.stormName ? 0 : 1) - (b.stormName ? 0 : 1) || cmp(a.stormName, b.stormName) || b.updatedAt.localeCompare(a.updatedAt),
    invoice: (a, b) => b.invoiceTotalCents - a.invoiceTotalCents,
  }
  rows = [...rows].sort(by[sortBy.value])
  return rows
})

// ---- recently deleted (30-day restore window) ----
const showDeleted = ref(false)
const deletedCases = ref<CaseListItem[]>([])
const deletedLoading = ref(false)
const restoring = ref<string | null>(null)
async function toggleDeleted() {
  showDeleted.value = !showDeleted.value
  if (!showDeleted.value || !auth.shopId) return
  deletedLoading.value = true
  try {
    deletedCases.value = await listDeletedCases(auth.shopId)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load deleted cases.'
  } finally {
    deletedLoading.value = false
  }
}
async function restore(c: CaseListItem) {
  if (!auth.shopId) return
  restoring.value = c.id
  error.value = null
  try {
    const back = await restoreCase(auth.shopId, c.id)
    deletedCases.value = deletedCases.value.filter((d) => d.id !== c.id)
    cases.value = [back, ...cases.value]
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not restore the case.'
  } finally {
    restoring.value = null
  }
}
const deletedOn = (iso: string | null) => (iso ? formatDateTime(iso) : '')

async function loadUsage() {
  if (!auth.shopId || !auth.canSeeUsage) return
  try {
    usage.value = await getAiUsage(auth.shopId)
  } catch {
    usage.value = null
  }
}
// Windows reset at midnight UTC (monthly on the 1st), so show the UTC calendar day —
// in US time zones the local date is still the evening before ("Sep 30" for Oct 1).
const resetsOn = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

async function load() {
  if (!auth.shopId) return
  loading.value = true
  error.value = null
  try {
    cases.value = await listCases(auth.shopId)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load cases.'
  } finally {
    loading.value = false
  }
}

function open(c: CaseListItem) {
  router.push({ name: 'case', params: { id: c.id } })
}

function onCreated(c: CaseListItem) {
  showNew.value = false
  router.push({ name: 'case', params: { id: c.id } })
}

// The role can change under an open page (the session refresh re-reads it).
watch(
  () => auth.canSeeUsage,
  (can) => {
    if (can && !usage.value) void loadUsage()
  },
)

onMounted(async () => {
  void loadUsage()
  await load()
  // First-ever visit (or ?tour=1 replay): run the walkthrough once the anchors are mounted.
  // The ?tour=1 is consumed immediately — leaving it in the URL replayed the guide on
  // every reload, which is what the "don't show again" complaints were about.
  if (route.query.tour === '1' || !casesTourSeen()) {
    setTimeout(() => startCasesTour({ readOnly: ent.readOnly }), 600)
    if (route.query.tour === '1') router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Negotiation cases</h1>
        <p class="muted">Track insurer correspondence, tactics, and drafts per case.</p>
      </div>
      <div class="head-actions">
        <button
          v-if="auth.canEditShopRates && !ent.readOnly"
          class="btn"
          title="Shop rates — TL invoice defaults"
          @click="showRates = true"
        >
          <Settings2 :size="15" /> Shop rates
        </button>
        <button v-if="!ent.readOnly" class="btn btn-primary" data-tour="new-case" @click="showNew = true">
          <Plus :size="15" /> New case
        </button>
      </div>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="usage && auth.canSeeUsage" class="usage card" :class="{ over: usage.month.exceeded || usage.today.exceeded }" data-tour="ai-usage">
      <div class="usage-row">
        <span class="usage-label">AI usage this month</span>
        <span class="usage-figures mono">
          {{ usage.month.percentUsed }}% <span class="muted">of allowance</span>
          · {{ usage.month.calls }} {{ usage.month.calls === 1 ? 'request' : 'requests' }}
          <span class="muted">· resets {{ resetsOn(usage.month.resetsAt) }}</span>
        </span>
      </div>
      <div class="usage-bar" role="progressbar" :aria-valuenow="usage.month.percentUsed" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${Math.max(usage.month.percentUsed, usage.month.calls ? 1 : 0)}%` }"></span>
      </div>
      <p v-if="usage.today.exceeded" class="usage-note">
        Today's allowance is used up — drafting resumes at midnight UTC.
      </p>
      <p v-else-if="usage.month.exceeded" class="usage-note">
        This month's allowance is used up — drafting resumes on {{ resetsOn(usage.month.resetsAt) }}.
      </p>
      <p class="usage-explain">
        Your plan includes a fair-use AI allowance for each day and each month. Reading an
        email or drafting a letter counts against it — a long letter counts for more than a
        quick read. Nothing is added to your bill. Today: {{ usage.today.percentUsed }}% of
        the daily allowance used. If you reach a limit, AI drafting pauses until it resets;
        everything else keeps working.
        <a :href="`${CRM_URL}/terms`" target="_blank" rel="noopener">Fair-use terms</a>
        · <a :href="`${CRM_URL}/privacy`" target="_blank" rel="noopener">Privacy</a>
      </p>
    </div>

    <div v-if="loading" class="empty muted"><span class="spinner"></span> Loading cases…</div>

    <div v-else-if="cases.length === 0 && !showDeleted" class="empty card" data-tour="case-list">
      <FolderOpen :size="30" class="muted" />
      <template v-if="ent.readOnly">
        <h3>No cases to show</h3>
        <p class="muted">
          Your DSM Negotiator plan has ended, so new cases can't be started. Renew from the
          banner at the top of the page to open cases again.
          <template v-if="auth.canDeleteCases">Cases deleted in the last 30 days are under Recently deleted.</template>
        </p>
      </template>
      <template v-else>
        <h3>No cases yet</h3>
        <p class="muted">
          Create a case for each insurance claim you're negotiating, then feed it the insurer's
          emails.
        </p>
        <button class="btn btn-primary" @click="showNew = true"><Plus :size="15" /> New case</button>
      </template>
      <!-- The toolbar's toggle is not on this screen: without this one, once every case was
           deleted none of them could be reached to restore before the 30-day purge. -->
      <button v-if="auth.canDeleteCases" class="btn btn-ghost btn-sm" @click="toggleDeleted">
        <Trash2 :size="13" /> Recently deleted
      </button>
    </div>

    <template v-else>
      <div class="toolbar" data-tour="case-list">
        <!-- Only "Recently deleted" while every case is deleted: there is nothing to filter. -->
        <template v-if="cases.length > 0">
          <label class="search">
            <Search :size="14" aria-hidden="true" />
            <input v-model="query" type="search" placeholder="Search customer, claim #, insurer, storm" aria-label="Search cases" />
          </label>
          <select v-model="statusFilter" aria-label="Status">
            <option value="active">Active (not closed)</option>
            <option value="Open">Open</option>
            <option value="Settled">Settled</option>
            <option value="Litigation">Litigation</option>
            <option value="Closed">Closed{{ closedCount ? ` (${closedCount})` : '' }}</option>
            <option value="all">All statuses</option>
          </select>
          <select v-if="storms.length" v-model="stormFilter" aria-label="Storm">
            <option value="">Any storm</option>
            <option v-for="st in storms" :key="st.id" :value="st.id">{{ st.name }}</option>
            <option v-if="hasUnstormed" value="none">No storm</option>
          </select>
          <select v-if="insurers.length > 1" v-model="insurerFilter" aria-label="Insurer">
            <option value="">Any insurer</option>
            <option v-for="i in insurers" :key="i" :value="i">{{ i }}</option>
          </select>
          <label class="sort">
            <span class="muted">Sort</span>
            <select v-model="sortBy" aria-label="Sort by">
              <option value="updated">Last activity</option>
              <option value="created">Newest created</option>
              <option value="customer">Customer</option>
              <option value="insurer">Insurer</option>
              <option value="storm">Storm</option>
              <option value="invoice">Repair estimate</option>
            </select>
          </label>
          <button v-if="filtersActive" class="btn btn-ghost btn-sm" @click="clearFilters"><X :size="13" /> Clear</button>
        </template>
        <button v-if="auth.canDeleteCases" class="btn btn-ghost btn-sm deleted-toggle" :class="{ on: showDeleted }" @click="toggleDeleted">
          <Trash2 :size="13" /> Recently deleted
        </button>
      </div>

      <div v-if="showDeleted && auth.canDeleteCases" class="card table-card deleted-card">
        <div class="deleted-head">
          <b>Recently deleted</b>
          <span class="muted">A deleted case can be restored for 30 days; after that it and its documents are erased.</span>
        </div>
        <div v-if="deletedLoading" class="empty muted"><span class="spinner"></span> Loading…</div>
        <p v-else-if="deletedCases.length === 0" class="empty muted">Nothing deleted in the last 30 days.</p>
        <table v-else class="data">
          <thead>
            <tr><th>Case</th><th>Insurer</th><th>Customer</th><th>Deleted</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="c in deletedCases" :key="c.id" class="no-open">
              <td class="title-cell">{{ c.title }}</td>
              <td data-label="Insurer">{{ c.insurerName || '—' }}</td>
              <td data-label="Customer">{{ c.customerName || '—' }}</td>
              <td data-label="Deleted" class="muted">{{ deletedOn(c.deletedAt) }}</td>
              <td class="num">
                <button
                  class="btn btn-sm"
                  :disabled="restoring === c.id || ent.readOnly"
                  :title="ent.readOnly ? 'Restoring a case needs the DSM Negotiator plan' : undefined"
                  @click="restore(c)"
                >
                  <RotateCcw :size="13" /> {{ restoring === c.id ? 'Restoring…' : 'Restore' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="cases.length === 0" class="empty muted">No cases outside Recently deleted.</p>
      <div v-else-if="visible.length === 0" class="empty card">
        <h3>No cases match</h3>
        <p class="muted">
          {{ statusFilter === 'active' && closedCount === cases.length ? 'Every case is closed.' : 'Try a different search or filter.' }}
        </p>
        <button class="btn" @click="clearFilters"><X :size="14" /> Clear filters</button>
      </div>

      <div v-else class="card table-card">
      <table class="data">
        <thead>
          <tr>
            <th>Case</th>
            <th>Status</th>
            <th>Insurer</th>
            <th>Claim #</th>
            <th>Customer</th>
            <th>Storm</th>
            <th class="num">Repair est.</th>
            <th class="num">Msgs</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in visible" :key="c.id" @click="open(c)">
            <!-- the title is a real link: Tab reaches every case, Enter opens it, and
                 ⌘/middle-click opens it in a new tab; the rest of the row stays clickable -->
            <td class="title-cell">
              <RouterLink :to="{ name: 'case', params: { id: c.id } }" class="case-link" @click.stop>
                {{ c.title }}
              </RouterLink>
            </td>
            <td data-label="Status"><StatusPill :status="c.status" /></td>
            <td data-label="Insurer">{{ c.insurerName || '—' }}</td>
            <td data-label="Claim #" class="mono">{{ c.insurerClaimNumber || '—' }}</td>
            <td data-label="Customer">{{ c.customerName || '—' }}</td>
            <td data-label="Storm" :class="{ muted: !c.stormName }">{{ c.stormName || '—' }}</td>
            <td data-label="Repair est." class="num mono">{{ centsToUsd(c.invoiceTotalCents) }}</td>
            <td data-label="Msgs" class="num">{{ c.messageCount }}</td>
            <td data-label="Updated" class="muted">{{ formatDateTime(c.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </template>

    <NewCaseModal v-if="showNew && !ent.readOnly" @close="showNew = false" @created="onCreated" />
    <ShopRatesModal v-if="showRates && auth.canEditShopRates && !ent.readOnly" @close="showRates = false" />
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px 60px;
}
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
/* list tools */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar .search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 240px;
  min-width: 200px;
  color: var(--text-muted);
}
.toolbar .search input {
  flex: 1;
  min-width: 0;
}
.toolbar select {
  width: auto;
  max-width: 240px;
  padding: 7px 10px;
  font-size: 13px;
}
.toolbar .search input {
  width: auto;
}
.toolbar .sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.deleted-toggle.on {
  border-color: var(--accent);
  color: var(--accent);
}
.deleted-card {
  margin-bottom: 16px;
  border-style: dashed;
}
.deleted-head {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 12px 16px 0;
  font-size: 13px;
}
.data tr.no-open {
  cursor: default;
}
.page-head h1 {
  font-size: 22px;
}
.page-head p {
  font-size: 13px;
  margin-top: 2px;
}
.table-card {
  padding: 0;
  overflow-x: auto;
}
.usage {
  padding: 12px 16px;
  margin-bottom: 16px;
}
.usage-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13px;
}
.usage-label {
  font-weight: 600;
}
.usage-bar {
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--text) 10%, transparent);
  margin-top: 8px;
  overflow: hidden;
}
.usage-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
}
.usage.over .usage-bar span {
  background: var(--amber);
}
.usage-explain {
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-muted);
  max-width: 820px;
}
.usage-note {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--amber);
  font-weight: 600;
}
.title-cell {
  font-weight: 600;
  max-width: 280px;
}
.case-link {
  color: var(--text);
  border-radius: 4px;
}
.case-link:hover {
  text-decoration: underline;
}
.case-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
tbody tr:focus-within {
  background: var(--accent-soft);
}
.num {
  text-align: right;
}
.mono {
  font-family: var(--mono);
  font-size: 13px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
}
/* Phones: each case becomes a stacked card instead of a 700 px table that scrolls
   sideways. */
@media (max-width: 640px) {
  .table-card {
    overflow-x: visible;
  }
  table.data thead {
    display: none;
  }
  table.data,
  table.data tbody,
  table.data tr,
  table.data td {
    display: block;
    width: 100%;
  }
  table.data tbody tr {
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-soft);
  }
  table.data td {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 0;
    border: none;
    text-align: right;
  }
  table.data td[data-label]::before {
    content: attr(data-label);
    font-family: var(--font);
    color: var(--text-faint);
    font-size: 12px;
    text-align: left;
  }
  table.data td.title-cell {
    max-width: none;
    padding-bottom: 6px;
    text-align: left;
  }
  .case-link {
    display: block;
    min-height: 32px;
    line-height: 1.4;
  }
}
</style>
