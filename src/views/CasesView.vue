<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, FolderOpen, Settings2 } from 'lucide-vue-next'
import { listCases } from '@/api/negotiation'
import { getAiUsage } from '@/api/usage'
import { ApiError, CRM_URL } from '@/api/client'
import type { AiUsageSummary, CaseListItem } from '@/api/types'
import { centsToUsd, formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import StatusPill from '@/components/StatusPill.vue'
import NewCaseModal from '@/components/NewCaseModal.vue'
import ShopRatesModal from '@/components/ShopRatesModal.vue'
import { casesTourSeen, startCasesTour } from '@/tour'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const cases = ref<CaseListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showNew = ref(false)
const showRates = ref(false)
/** Fair-use meter: what the shop has spent of its AI allowance this month. Owners and
 *  managers see it; a failed read simply hides it (the API's 429 is the real gate). */
const usage = ref<AiUsageSummary | null>(null)
const canSeeUsage = ['owner', 'manager', 'admin'].includes(auth.role?.toLowerCase() ?? '')

async function loadUsage() {
  if (!auth.shopId || !canSeeUsage) return
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

onMounted(async () => {
  void loadUsage()
  await load()
  // First-ever visit (or ?tour=1 replay): run the walkthrough once the anchors are mounted.
  // The ?tour=1 is consumed immediately — leaving it in the URL replayed the guide on
  // every reload, which is what the "don't show again" complaints were about.
  if (route.query.tour === '1' || !casesTourSeen()) {
    setTimeout(startCasesTour, 600)
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
        <button class="btn" title="Shop rates — TL invoice defaults" @click="showRates = true">
          <Settings2 :size="15" /> Shop rates
        </button>
        <button class="btn btn-primary" data-tour="new-case" @click="showNew = true">
          <Plus :size="15" /> New case
        </button>
      </div>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="usage" class="usage card" :class="{ over: usage.month.exceeded || usage.today.exceeded }" data-tour="ai-usage">
      <div class="usage-row">
        <span class="usage-label">AI usage this month</span>
        <span class="usage-figures mono">
          {{ usage.month.cost }} <span class="muted">of {{ usage.month.capCost }}</span>
          · {{ usage.month.calls }} {{ usage.month.calls === 1 ? 'request' : 'requests' }}
          <span class="muted">· resets {{ resetsOn(usage.month.resetsAt) }}</span>
        </span>
      </div>
      <div class="usage-bar" role="progressbar" :aria-valuenow="usage.month.percentUsed" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${Math.max(usage.month.percentUsed, usage.month.calls ? 1 : 0)}%` }"></span>
      </div>
      <p v-if="usage.today.exceeded" class="usage-note">
        Today's allowance ({{ usage.today.capCost }} or {{ usage.today.capCalls }} requests) is used up — drafting resumes at midnight UTC.
      </p>
      <p v-else-if="usage.month.exceeded" class="usage-note">
        This month's allowance is used up — drafting resumes on {{ resetsOn(usage.month.resetsAt) }}.
      </p>
      <p class="usage-explain">
        Your plan includes a fair-use AI allowance: up to {{ usage.today.capCost }} of AI work a
        day ({{ usage.today.capCalls }} requests) and {{ usage.month.capCost }} a month. The
        dollars are what reading emails and drafting letters cost to run, counted against that
        allowance. They are not added to your bill. Today so far: {{ usage.today.cost }}.
        If you reach a limit, AI drafting pauses until it resets; everything else keeps working.
        <a :href="`${CRM_URL}/terms`" target="_blank" rel="noopener">Fair-use terms</a>
      </p>
    </div>

    <div v-if="loading" class="empty muted"><span class="spinner"></span> Loading cases…</div>

    <div v-else-if="cases.length === 0" class="empty card" data-tour="case-list">
      <FolderOpen :size="30" class="muted" />
      <h3>No cases yet</h3>
      <p class="muted">
        Create a case for each insurance claim you're negotiating, then feed it the insurer's
        emails.
      </p>
      <button class="btn btn-primary" @click="showNew = true"><Plus :size="15" /> New case</button>
    </div>

    <div v-else class="card table-card" data-tour="case-list">
      <table class="data">
        <thead>
          <tr>
            <th>Case</th>
            <th>Status</th>
            <th>Insurer</th>
            <th>Claim #</th>
            <th>Customer</th>
            <th class="num">Repair est.</th>
            <th class="num">Msgs</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cases" :key="c.id" @click="open(c)">
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
            <td data-label="Repair est." class="num mono">{{ centsToUsd(c.invoiceTotalCents) }}</td>
            <td data-label="Msgs" class="num">{{ c.messageCount }}</td>
            <td data-label="Updated" class="muted">{{ formatDateTime(c.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <NewCaseModal v-if="showNew" @close="showNew = false" @created="onCreated" />
    <ShopRatesModal v-if="showRates" @close="showRates = false" />
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
