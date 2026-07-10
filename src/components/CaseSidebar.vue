<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, Trash2, Upload, Plus } from 'lucide-vue-next'
import {
  addFact,
  deleteDocument,
  deleteFact,
  downloadDocument,
  setCaseStatus,
  updateCase,
  uploadDocument,
} from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, CaseStatus, UpsertCase } from '@/api/types'
import { formatBytes, formatDate, US_STATES } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import StatusPill from '@/components/StatusPill.vue'

const props = defineProps<{ detail: CaseDetail }>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

/* ---------- editable case fields ---------- */

const form = ref({
  title: '',
  insurerName: '',
  insurerClaimNumber: '',
  adjusterName: '',
  adjusterEmail: '',
  adjusterPhone: '',
  customerName: '',
  vehicleDescription: '',
  state: '',
  invoiceTotal: 0,
  storagePerDay: 0,
  notes: '',
})

function resetForm() {
  const d = props.detail
  form.value = {
    title: d.case.title,
    insurerName: d.case.insurerName ?? '',
    insurerClaimNumber: d.case.insurerClaimNumber ?? '',
    adjusterName: d.adjusterName ?? '',
    adjusterEmail: d.adjusterEmail ?? '',
    adjusterPhone: d.adjusterPhone ?? '',
    customerName: d.case.customerName ?? '',
    vehicleDescription: d.vehicleDescription ?? '',
    state: d.case.state ?? '',
    invoiceTotal: d.case.invoiceTotalCents / 100,
    storagePerDay: d.storagePerDayCents / 100,
    notes: d.notes ?? '',
  }
}
watch(() => props.detail, resetForm, { immediate: true })

const saving = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

function opt(v: string): string | null {
  const t = v.trim()
  return t ? t : null
}

async function save() {
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    const f = form.value
    const body: UpsertCase = {
      title: f.title.trim(),
      insurerName: opt(f.insurerName),
      insurerClaimNumber: opt(f.insurerClaimNumber),
      adjusterName: opt(f.adjusterName),
      adjusterEmail: opt(f.adjusterEmail),
      adjusterPhone: opt(f.adjusterPhone),
      customerName: opt(f.customerName),
      vehicleDescription: opt(f.vehicleDescription),
      state: opt(f.state.toUpperCase()),
      invoiceTotal: Number(f.invoiceTotal) || 0,
      storagePerDay: Number(f.storagePerDay) || 0,
      notes: opt(f.notes),
    }
    await updateCase(shopId.value, caseId.value, body)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
    emit('refresh')
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'Save failed.'
  } finally {
    saving.value = false
  }
}

/* ---------- status ---------- */

const statusChoice = ref<CaseStatus>(props.detail.case.status)
watch(
  () => props.detail.case.status,
  (s) => (statusChoice.value = s),
  { immediate: true },
)
const pendingLitigation = ref(false)
const statusBusy = ref(false)
const statusError = ref<string | null>(null)

async function applyStatus(status: CaseStatus) {
  statusBusy.value = true
  statusError.value = null
  try {
    await setCaseStatus(shopId.value, caseId.value, status)
    pendingLitigation.value = false
    emit('refresh')
  } catch (e) {
    statusError.value = e instanceof ApiError ? e.message : 'Status change failed.'
    statusChoice.value = props.detail.case.status
  } finally {
    statusBusy.value = false
  }
}

function onStatusChange() {
  statusError.value = null
  if (statusChoice.value === props.detail.case.status) {
    pendingLitigation.value = false
    return
  }
  if (statusChoice.value === 'Litigation') {
    pendingLitigation.value = true
    return
  }
  pendingLitigation.value = false
  applyStatus(statusChoice.value)
}

function cancelLitigation() {
  pendingLitigation.value = false
  statusChoice.value = props.detail.case.status
}

/* ---------- fact ledger ---------- */

const sortedFacts = computed(() =>
  [...props.detail.facts].sort((a, b) => a.factDate.localeCompare(b.factDate)),
)

const factDate = ref('')
const factAssertion = ref('')
const factDocumentId = ref('')
const factBusy = ref(false)
const factError = ref<string | null>(null)

async function submitFact() {
  factBusy.value = true
  factError.value = null
  try {
    await addFact(shopId.value, caseId.value, {
      factDate: factDate.value,
      assertion: factAssertion.value.trim(),
      documentId: factDocumentId.value || null,
    })
    factDate.value = ''
    factAssertion.value = ''
    factDocumentId.value = ''
    emit('refresh')
  } catch (e) {
    factError.value = e instanceof ApiError ? e.message : 'Could not add the fact.'
  } finally {
    factBusy.value = false
  }
}

async function removeFact(id: string) {
  factError.value = null
  try {
    await deleteFact(shopId.value, caseId.value, id)
    emit('refresh')
  } catch (e) {
    factError.value = e instanceof ApiError ? e.message : 'Could not delete the fact.'
  }
}

/* ---------- documents ---------- */

const fileInput = ref<HTMLInputElement | null>(null)
const docLabel = ref('')
const docBusy = ref(false)
const docError = ref<string | null>(null)

async function submitDocument() {
  const file = fileInput.value?.files?.[0]
  if (!file) {
    docError.value = 'Choose a file first.'
    return
  }
  docBusy.value = true
  docError.value = null
  try {
    await uploadDocument(shopId.value, caseId.value, file, docLabel.value.trim() || undefined)
    docLabel.value = ''
    if (fileInput.value) fileInput.value.value = ''
    emit('refresh')
  } catch (e) {
    docError.value = e instanceof ApiError ? e.message : 'Upload failed.'
  } finally {
    docBusy.value = false
  }
}

async function onDownload(docId: string) {
  const doc = props.detail.documents.find((d) => d.id === docId)
  if (!doc) return
  docError.value = null
  try {
    await downloadDocument(shopId.value, caseId.value, doc)
  } catch (e) {
    docError.value = e instanceof ApiError ? e.message : 'Download failed.'
  }
}

async function removeDocument(id: string) {
  docError.value = null
  try {
    await deleteDocument(shopId.value, caseId.value, id)
    emit('refresh')
  } catch (e) {
    docError.value = e instanceof ApiError ? e.message : 'Could not delete the document.'
  }
}

function docName(id: string | null): string | null {
  if (!id) return null
  const d = props.detail.documents.find((x) => x.id === id)
  return d ? (d.label || d.fileName) : null
}
</script>

<template>
  <aside class="sidebar">
    <!-- status -->
    <section class="card">
      <div class="panel-title">Status</div>
      <div class="status-row">
        <StatusPill :status="detail.case.status" />
        <select v-model="statusChoice" :disabled="statusBusy" @change="onStatusChange">
          <option value="Open">Open</option>
          <option value="Settled">Settled</option>
          <option value="Litigation">Litigation</option>
          <option value="Closed">Closed</option>
        </select>
      </div>
      <div v-if="pendingLitigation" class="notice-amber litigation-confirm">
        <p>
          <strong>Moving to Litigation.</strong> Once a case is in litigation, the assistant stops
          drafting correspondence — from here your attorney handles all communication.
        </p>
        <div class="confirm-actions">
          <button class="btn btn-sm" @click="cancelLitigation">Cancel</button>
          <button class="btn btn-warn btn-sm" :disabled="statusBusy" @click="applyStatus('Litigation')">
            <span v-if="statusBusy" class="spinner"></span>
            Confirm litigation
          </button>
        </div>
      </div>
      <p v-if="statusError" class="error-text">{{ statusError }}</p>
    </section>

    <!-- case fields -->
    <section class="card">
      <div class="panel-title">Case details</div>
      <form @submit.prevent="save">
        <label class="field">
          <span>Title</span>
          <input v-model="form.title" type="text" required />
        </label>
        <label class="field">
          <span>Insurer</span>
          <input v-model="form.insurerName" type="text" />
        </label>
        <label class="field">
          <span>Claim #</span>
          <input v-model="form.insurerClaimNumber" type="text" />
        </label>
        <label class="field">
          <span>Adjuster</span>
          <input v-model="form.adjusterName" type="text" />
        </label>
        <label class="field">
          <span>Adjuster email</span>
          <input v-model="form.adjusterEmail" type="email" />
        </label>
        <label class="field">
          <span>Adjuster phone</span>
          <input v-model="form.adjusterPhone" type="text" />
        </label>
        <label class="field">
          <span>Customer</span>
          <input v-model="form.customerName" type="text" />
        </label>
        <label class="field">
          <span>Vehicle</span>
          <input v-model="form.vehicleDescription" type="text" />
        </label>
        <div class="form-grid">
          <label class="field">
            <span>State</span>
            <input v-model="form.state" type="text" maxlength="2" list="sidebar-states" />
            <datalist id="sidebar-states">
              <option v-for="s in US_STATES" :key="s" :value="s" />
            </datalist>
          </label>
          <label class="field">
            <span>Invoice ($)</span>
            <input v-model.number="form.invoiceTotal" type="number" min="0" step="0.01" />
          </label>
        </div>
        <label class="field">
          <span>Storage / day ($)</span>
          <input v-model.number="form.storagePerDay" type="number" min="0" step="0.01" />
        </label>
        <label class="field">
          <span>Notes</span>
          <textarea v-model="form.notes" rows="3" />
        </label>
        <p v-if="saveError" class="error-text">{{ saveError }}</p>
        <button class="btn btn-primary save-btn" type="submit" :disabled="saving">
          <span v-if="saving" class="spinner"></span>
          {{ saved ? 'Saved' : 'Save details' }}
        </button>
      </form>
    </section>

    <!-- fact ledger -->
    <section class="card">
      <div class="panel-title">Fact ledger</div>
      <p class="faint ledger-hint">
        The dated record of what happened. Drafts — especially escalations — lean on these facts.
      </p>
      <ul v-if="sortedFacts.length" class="fact-list">
        <li v-for="f in sortedFacts" :key="f.id" class="fact">
          <div class="fact-date mono">{{ formatDate(f.factDate) }}</div>
          <div class="fact-body">
            <p>{{ f.assertion }}</p>
            <p v-if="docName(f.documentId)" class="faint">Doc: {{ docName(f.documentId) }}</p>
          </div>
          <button class="btn btn-danger btn-sm" title="Delete fact" @click="removeFact(f.id)">
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
      <p v-else class="faint">No facts recorded yet.</p>

      <form class="fact-form" @submit.prevent="submitFact">
        <label class="field">
          <span>Date</span>
          <input v-model="factDate" type="date" required />
        </label>
        <label class="field">
          <span>What happened</span>
          <textarea
            v-model="factAssertion"
            rows="2"
            required
            placeholder="e.g. Adjuster requested the same invoice a third time"
          />
        </label>
        <label v-if="detail.documents.length" class="field">
          <span>Supporting document (optional)</span>
          <select v-model="factDocumentId">
            <option value="">None</option>
            <option v-for="d in detail.documents" :key="d.id" :value="d.id">
              {{ d.label || d.fileName }}
            </option>
          </select>
        </label>
        <p v-if="factError" class="error-text">{{ factError }}</p>
        <button class="btn btn-sm" type="submit" :disabled="factBusy">
          <span v-if="factBusy" class="spinner"></span>
          <Plus v-else :size="14" /> Add fact
        </button>
      </form>
    </section>

    <!-- documents -->
    <section class="card">
      <div class="panel-title">Documents</div>
      <ul v-if="detail.documents.length" class="doc-list">
        <li v-for="d in detail.documents" :key="d.id" class="doc">
          <div class="doc-info">
            <p class="doc-name">{{ d.label || d.fileName }}</p>
            <p class="faint">{{ d.fileName }} · {{ formatBytes(d.sizeBytes) }}</p>
          </div>
          <div class="doc-actions">
            <button class="btn btn-ghost btn-sm" title="Download" @click="onDownload(d.id)">
              <Download :size="14" />
            </button>
            <button class="btn btn-danger btn-sm" title="Delete" @click="removeDocument(d.id)">
              <Trash2 :size="14" />
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="faint">No documents yet. Upload estimates, invoices, photos, letters.</p>

      <form class="doc-form" @submit.prevent="submitDocument">
        <input ref="fileInput" type="file" />
        <input v-model="docLabel" type="text" placeholder="Label (optional), e.g. Final invoice" />
        <p v-if="docError" class="error-text">{{ docError }}</p>
        <button class="btn btn-sm" type="submit" :disabled="docBusy">
          <span v-if="docBusy" class="spinner"></span>
          <Upload v-else :size="14" /> Upload
        </button>
      </form>
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-row select {
  flex: 1;
}
.litigation-confirm {
  margin-top: 10px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.save-btn {
  width: 100%;
  justify-content: center;
}
.ledger-hint {
  margin-bottom: 10px;
}
.fact-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fact {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: var(--bg-raised);
}
.fact-date {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  padding-top: 2px;
}
.fact-body {
  flex: 1;
  font-size: 13px;
}
.mono {
  font-family: var(--mono);
}
.fact-form,
.doc-form {
  border-top: 1px solid var(--border-soft);
  padding-top: 12px;
  margin-top: 4px;
}
.doc-form input[type='file'] {
  margin-bottom: 8px;
  width: 100%;
}
.doc-form input[type='text'] {
  margin-bottom: 8px;
}
.doc-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.doc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: var(--bg-raised);
}
.doc-info {
  min-width: 0;
}
.doc-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
