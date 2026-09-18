<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, AlertTriangle, X } from 'lucide-vue-next'
import { getCase, getGeneratedDocs } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, GeneratedDocs } from '@/api/types'
import { usd } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import StatusPill from '@/components/StatusPill.vue'
import CaseSidebar from '@/components/CaseSidebar.vue'
import InvoiceCard from '@/components/InvoiceCard.vue'
import LetterColumns from '@/components/LetterColumns.vue'
import TimelinePanel from '@/components/TimelinePanel.vue'
import DraftPanel from '@/components/DraftPanel.vue'
import { startWorkspaceTour, workspaceTourSeen } from '@/tour'

const props = defineProps<{ id: string }>()

const auth = useAuthStore()
const route = useRoute()

const detail = ref<CaseDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const counselBanner = ref(false)
// True while DraftPanel has a draft in flight — the timeline shows its skeleton card.
const externalDrafting = ref(false)

/* The generated documents (letters + the computed invoice) load here, not in a panel:
   the header's recovery balance and both tabs read from the same result. */
const docs = ref<GeneratedDocs | null>(null)
const docsLoading = ref(true)
const docsError = ref<string | null>(null)

async function loadDocs() {
  if (!auth.shopId || !detail.value) return
  docsError.value = null
  try {
    docs.value = await getGeneratedDocs(auth.shopId, props.id)
  } catch (e) {
    docsError.value = e instanceof ApiError ? e.message : 'Could not generate the documents.'
  } finally {
    docsLoading.value = false
  }
}

async function load(showSpinner = false) {
  if (!auth.shopId) return
  if (showSpinner) loading.value = true
  error.value = null
  try {
    detail.value = await getCase(auth.shopId, props.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the case.'
  } finally {
    loading.value = false
  }
  // Fee edits, customer link, intake (adjuster name reaches the greeting) all land in
  // the letters immediately.
  void loadDocs()
}

function refresh() {
  load(false)
}

function onCounsel() {
  counselBanner.value = true
}

/* ---------- tabs ---------- */

const tab = ref<'case' | 'nego'>('case')
const invoice = computed(() => docs.value?.invoice ?? null)

// The header's balance follows the invoice card's live math while an edit is in
// flight, so the big number reacts to every keystroke like the mockup promised.
const liveTotal = ref<number | null>(null)
const heroTotal = computed(() => liveTotal.value ?? invoice.value?.total ?? null)
const accruing = computed(
  () =>
    detail.value !== null &&
    invoice.value !== null &&
    invoice.value.storageDays > 0 &&
    !detail.value.storageEndDate &&
    invoice.value.storagePerDay > 0,
)

// The tour walks both tabs — it switches them through this event.
function onTabEvent(e: Event) {
  tab.value = (e as CustomEvent<'case' | 'nego'>).detail
}

onMounted(async () => {
  window.addEventListener('dsm-neg-ws-tab', onTabEvent)
  await load(true)
  // First case ever opened: tour the workspace once its panels are mounted.
  if (detail.value && !workspaceTourSeen()) setTimeout(startWorkspaceTour, 600)
})
onBeforeUnmount(() => window.removeEventListener('dsm-neg-ws-tab', onTabEvent))
watch(
  () => route.params.id,
  () => {
    tab.value = 'case'
    load(true)
  },
)
</script>

<template>
  <div class="workspace-page">
    <div class="glow" aria-hidden="true"></div>

    <div v-if="loading" class="center-state muted"><span class="spinner"></span> Loading case…</div>

    <div v-else-if="error" class="center-state">
      <p class="error-text">{{ error }}</p>
      <RouterLink to="/" class="btn"><ArrowLeft :size="14" /> Back to cases</RouterLink>
    </div>

    <template v-else-if="detail">
      <header class="casehead">
        <div class="casehead-left">
          <RouterLink to="/" class="crumb"><ArrowLeft :size="13" /> Cases</RouterLink>
          <h1>{{ detail.case.title }}</h1>
          <div class="chips">
            <StatusPill :status="detail.case.status" />
            <span v-if="detail.case.insurerName" class="chip">
              Insurer <b>{{ detail.case.insurerName }}</b>
            </span>
            <span v-if="detail.case.insurerClaimNumber" class="chip">
              Claim <b class="mono">{{ detail.case.insurerClaimNumber }}</b>
            </span>
            <span v-if="detail.case.state" class="chip">
              State <b>{{ detail.case.state }}</b>
            </span>
          </div>
        </div>
        <div class="balance">
          <div class="lbl">Total recovery balance</div>
          <div class="amt mono">{{ heroTotal !== null ? usd(heroTotal) : '—' }}</div>
          <span v-if="accruing" class="accruing">
            <span class="dot"></span>Accruing · {{ usd(invoice!.storagePerDay) }}/day
          </span>
          <span v-else-if="invoice && invoice.storageDays === 0" class="accruing off">
            Storage not accruing — set the date on the invoice
          </span>
        </div>
      </header>

      <div v-if="counselBanner" class="counsel-banner">
        <AlertTriangle :size="17" />
        <p>
          <strong>Consider retaining counsel.</strong> Based on the insurer's conduct in this case,
          the assistant recommends having an attorney review it before you escalate further.
        </p>
        <button class="btn btn-ghost btn-sm" @click="counselBanner = false"><X :size="14" /></button>
      </div>

      <div class="tabs" role="tablist">
        <button
          class="tab"
          role="tab"
          :aria-selected="tab === 'case'"
          @click="tab = 'case'"
        >
          Case &amp; documents
        </button>
        <button
          class="tab"
          role="tab"
          :aria-selected="tab === 'nego'"
          @click="tab = 'nego'"
        >
          Negotiation
          <span v-if="detail.messages.length" class="count">{{ detail.messages.length }}</span>
        </button>
      </div>

      <!-- Tab 1 · case & documents (v-show keeps both tabs mounted so the tour and
           in-flight edits survive switching) -->
      <section v-show="tab === 'case'" class="tabpanel">
        <div class="casegrid">
          <CaseSidebar data-tour="ws-sidebar" :detail="detail" @refresh="refresh" />
          <div data-tour="ws-documents" class="docs-col">
            <InvoiceCard
              v-model:live-total="liveTotal"
              :detail="detail"
              :invoice="invoice"
              @refresh="refresh"
            />
            <LetterColumns :docs="docs" :loading="docsLoading" :error="docsError" @reload="loadDocs" />
          </div>
        </div>
      </section>

      <!-- Tab 2 · negotiation -->
      <section v-show="tab === 'nego'" class="tabpanel">
        <div class="nego-grid">
          <TimelinePanel
            data-tour="ws-timeline"
            :detail="detail"
            :external-drafting="externalDrafting"
            @refresh="refresh"
            @counsel="onCounsel"
          />
          <DraftPanel
            data-tour="ws-draft"
            class="nego-right"
            :detail="detail"
            @refresh="refresh"
            @counsel="onCounsel"
            @drafting="externalDrafting = $event"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.workspace-page {
  position: relative;
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 8px 28px 70px;
}
/* one quiet flourish — an ambient glow behind the header */
.glow {
  position: absolute;
  inset: 0 0 auto;
  height: 380px;
  pointer-events: none;
  background: radial-gradient(600px 240px at 78% 0%, rgba(94, 106, 210, 0.14), transparent 70%);
}
.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 20px;
}

/* ---------- case header ---------- */
.casehead {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 26px 0 24px;
  flex-wrap: wrap;
}
.crumb {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-faint);
  margin-bottom: 8px;
}
.crumb:hover {
  color: var(--text-muted);
  text-decoration: none;
}
.casehead h1 {
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.022em;
  line-height: 1.15;
  text-wrap: balance;
  margin-bottom: 10px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 12px;
  font-size: 12.5px;
  color: var(--text-muted);
  background: var(--panel);
}
.chip b {
  color: var(--text);
  font-weight: 500;
}
.balance {
  text-align: right;
}
.balance .lbl {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.balance .amt {
  font-size: 44px;
  font-weight: 650;
  letter-spacing: -0.035em;
  line-height: 1.1;
  font-family: var(--font);
  font-variant-numeric: tabular-nums;
}
.accruing {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  border: 1px solid rgba(61, 214, 140, 0.35);
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 12px;
  font-weight: 600;
  padding: 3px 12px;
}
.accruing.off {
  border-color: rgba(245, 166, 35, 0.35);
  background: var(--amber-soft);
  color: var(--amber);
}
.accruing .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 2.2s infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .accruing .dot {
    animation: none;
  }
}
@media (max-width: 860px) {
  .balance {
    text-align: left;
  }
}

.counsel-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--amber-soft);
  border: 1px solid rgba(245, 166, 35, 0.5);
  border-radius: var(--radius);
  color: var(--amber);
  padding: 12px 16px;
  margin-bottom: 14px;
  font-size: 13.5px;
}
.counsel-banner p {
  flex: 1;
}

/* ---------- tabs ---------- */
.tabs {
  position: relative;
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 28px;
}
.tab {
  appearance: none;
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 9px 16px 11px;
  position: relative;
  letter-spacing: -0.005em;
  transition: color 0.12s;
}
.tab:hover {
  color: var(--text);
}
.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px;
}
.tab[aria-selected='true'] {
  color: var(--text);
}
.tab[aria-selected='true']::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.tab .count {
  margin-left: 7px;
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text-faint);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 7px;
}
.tab[aria-selected='true'] .count {
  color: var(--accent);
  border-color: rgba(123, 135, 255, 0.45);
}

/* ---------- tab 1 layout ---------- */
.casegrid {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.docs-col {
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
}
@media (max-width: 1000px) {
  .casegrid {
    grid-template-columns: 1fr;
  }
}

/* ---------- tab 2 layout ---------- */
.nego-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}
.nego-right {
  position: sticky;
  top: 68px;
}
@media (max-width: 1000px) {
  .nego-grid {
    grid-template-columns: 1fr;
  }
  .nego-right {
    position: static;
  }
}
</style>
