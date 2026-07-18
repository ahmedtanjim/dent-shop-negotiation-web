<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, FolderOpen } from 'lucide-vue-next'
import { listCases } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseListItem } from '@/api/types'
import { centsToUsd, formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import StatusPill from '@/components/StatusPill.vue'
import NewCaseModal from '@/components/NewCaseModal.vue'
import { casesTourSeen, startCasesTour } from '@/tour'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const cases = ref<CaseListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showNew = ref(false)

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
  await load()
  // First-ever visit (or ?tour=1 replay): run the walkthrough once the anchors are mounted.
  if (route.query.tour === '1' || !casesTourSeen()) setTimeout(startCasesTour, 600)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Negotiation cases</h1>
        <p class="muted">Track insurer correspondence, tactics, and drafts per case.</p>
      </div>
      <button class="btn btn-primary" data-tour="new-case" @click="showNew = true">
        <Plus :size="15" /> New case
      </button>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

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
            <th class="num">Invoice</th>
            <th class="num">Msgs</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cases" :key="c.id" @click="open(c)">
            <td class="title-cell">{{ c.title }}</td>
            <td><StatusPill :status="c.status" /></td>
            <td>{{ c.insurerName || '—' }}</td>
            <td class="mono">{{ c.insurerClaimNumber || '—' }}</td>
            <td>{{ c.customerName || '—' }}</td>
            <td class="num mono">{{ centsToUsd(c.invoiceTotalCents) }}</td>
            <td class="num">{{ c.messageCount }}</td>
            <td class="muted">{{ formatDateTime(c.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <NewCaseModal v-if="showNew" @close="showNew = false" @created="onCreated" />
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
  gap: 16px;
  margin-bottom: 20px;
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
.title-cell {
  font-weight: 600;
  max-width: 280px;
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
</style>
