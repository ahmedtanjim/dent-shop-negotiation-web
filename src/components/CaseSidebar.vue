<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, Trash2, Upload } from 'lucide-vue-next'
import {
  deleteDocument,
  downloadDocument,
  updateCase,
  uploadDocument,
} from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, CustomerSearchResult } from '@/api/types'
import { caseBodyFromDetail } from '@/utils/caseBody'
import { formatBytes, oneLine, US_STATES } from '@/utils/format'
import { parseMoney } from '@/utils/amount'
import { useAuthStore } from '@/stores/auth'
import CustomerPicker from '@/components/CustomerPicker.vue'
import { useFlushOnLeave } from '@/utils/flushOnLeave'
import { tooLargeMessage } from '@/utils/uploads'

const props = defineProps<{ detail: CaseDetail }>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

/* ---------- editable case fields ----------
   Identity fields only — the Total Loss invoice inputs (fees, dates, storage rate)
   are edited inline on the invoice card. Saving round-trips those and the adjuster
   fields from the server state instead of wiping them. */

const form = ref({
  title: '',
  insurerName: '',
  insurerClaimNumber: '',
  customerName: '',
  customerId: null as string | null,
  vehicleDescription: '',
  state: '',
  invoiceTotal: '',
  notes: '',
})

// Snapshot of the last server state the form was reset to — refreshes fire constantly
// (documents, intake), and they must never clobber in-progress edits. It starts as the
// stringified initial form so the very first watch tick reads as clean and populates.
const pristine = ref(JSON.stringify(form.value))

function resetForm() {
  const d = props.detail
  form.value = {
    title: d.case.title,
    insurerName: d.case.insurerName ?? '',
    insurerClaimNumber: d.case.insurerClaimNumber ?? '',
    customerName: d.case.customerName ?? '',
    customerId: d.customerId,
    vehicleDescription: d.vehicleDescription ?? '',
    state: d.case.state ?? '',
    invoiceTotal: d.case.invoiceTotalCents ? (d.case.invoiceTotalCents / 100).toFixed(2) : '',
    notes: d.notes ?? '',
  }
  pristine.value = JSON.stringify(form.value)
}
const dirty = computed(() => JSON.stringify(form.value) !== pristine.value)
watch(
  () => props.detail,
  () => {
    if (!dirty.value) resetForm()
  },
  { immediate: true },
)

function discardEdits() {
  resetForm()
}

function onCustomerPicked(c: CustomerSearchResult) {
  if (!form.value.vehicleDescription.trim() && c.vehicleLabel)
    form.value.vehicleDescription = c.vehicleLabel
}

const saving = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

function opt(v: string): string | null {
  const t = v.trim()
  return t ? t : null
}

// Strict: "-50" or "1e6" is an error here, never a silent number.
const estimate = computed(() => parseMoney(form.value.invoiceTotal, 'Repair estimate'))
// A state saved before the list existed ("TE") still shows, so it can be corrected.
const stateOptions = computed(() =>
  form.value.state && !US_STATES.includes(form.value.state) ? [form.value.state, ...US_STATES] : US_STATES,
)

async function save(keepalive = false) {
  if (estimate.value.error) return
  if (!oneLine(form.value.title)) {
    saveError.value = 'Give the case a title.'
    return
  }
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    const f = form.value
    const body = caseBodyFromDetail(props.detail)
    // Single-line fields are stored with their whitespace collapsed — they end up in
    // letter subjects and the PDF file name.
    body.title = oneLine(f.title) ?? ''
    body.insurerName = oneLine(f.insurerName)
    body.insurerClaimNumber = oneLine(f.insurerClaimNumber)
    body.customerName = oneLine(f.customerName)
    body.customerId = f.customerId
    body.vehicleDescription = oneLine(f.vehicleDescription)
    body.state = opt(f.state)
    body.invoiceTotal = estimate.value.value ?? 0
    body.notes = opt(f.notes)
    await updateCase(shopId.value, caseId.value, body, { keepalive })
    // Accept our own save as the new baseline so the refresh below re-syncs the form.
    pristine.value = JSON.stringify(form.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
    emit('refresh')
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'Save failed.'
  } finally {
    saving.value = false
  }
}

// Unsaved case details are saved on the way out (another case, the list, closing the tab)
// instead of silently dropped (NEG-6) — as long as they're valid; an invalid form keeps
// the browser's "leave page?" prompt.
useFlushOnLeave(
  () => dirty.value && !saving.value,
  (keepalive) => {
    if (!estimate.value.error && oneLine(form.value.title)) void save(keepalive)
  },
)

/* ---------- uploads ---------- */

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
  const big = tooLargeMessage(file)
  if (big) {
    docError.value = big
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
</script>

<template>
  <aside class="sidebar">
    <!-- case fields -->
    <section class="card">
      <div class="panel-title">Case details</div>
      <form novalidate @submit.prevent="save()">
        <label class="field customer-field">
          <span>Customer</span>
          <CustomerPicker
            v-model="form.customerName"
            v-model:customer-id="form.customerId"
            @picked="onCustomerPicked"
          />
        </label>
        <label class="field">
          <span>Vehicle</span>
          <input v-model="form.vehicleDescription" type="text" />
        </label>
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
        <p v-if="detail.adjusterName || detail.adjusterEmail" class="faint adjuster-note">
          Adjuster: {{ detail.adjusterName ?? '—' }}
          <template v-if="detail.adjusterEmail"> · {{ detail.adjusterEmail }}</template>
          <br />(filled automatically from uploaded insurer emails)
        </p>
        <div class="form-grid">
          <label class="field">
            <span>State</span>
            <select v-model="form.state">
              <option value="">—</option>
              <option v-for="s in stateOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label class="field">
            <span>Repair estimate ($)</span>
            <input v-model="form.invoiceTotal" type="text" inputmode="decimal" placeholder="0.00"
              :class="{ invalid: estimate.error }" :aria-invalid="!!estimate.error" />
            <small v-if="estimate.error" class="field-error">{{ estimate.error }}</small>
          </label>
        </div>
        <p class="faint tl-hint">
          The repair estimate is for reference only. The recovery balance is the Total Loss
          Invoice: its storage dates, fees, and daily rate are edited on the invoice itself →
        </p>

        <label class="field">
          <span>Notes</span>
          <textarea v-model="form.notes" rows="3" />
        </label>
        <p v-if="saveError" class="error-text">{{ saveError }}</p>
        <div v-if="dirty" class="dirty-row">
          <span class="dirty-hint">Unsaved changes</span>
          <button class="btn btn-ghost btn-sm" type="button" @click="discardEdits">Discard</button>
        </div>
        <button class="btn btn-primary save-btn" type="submit" :disabled="saving">
          <span v-if="saving" class="spinner"></span>
          {{ saved ? 'Saved' : 'Save details' }}
        </button>
      </form>
    </section>

    <!-- uploads -->
    <section class="card">
      <div class="panel-title">Uploads</div>
      <ul v-if="detail.documents.length" class="doc-list">
        <li v-for="d in detail.documents" :key="d.id" class="doc">
          <div class="doc-info">
            <p class="doc-name" :title="d.label || d.fileName">{{ d.label || d.fileName }}</p>
            <p class="faint doc-meta">{{ d.fileName }} · {{ formatBytes(d.sizeBytes) }}</p>
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
      <p v-else class="faint">Work orders, estimates, photos, signed contracts.</p>

      <form class="doc-form" @submit.prevent="submitDocument">
        <input ref="fileInput" type="file" @change="docError = null" />
        <input v-model="docLabel" type="text" placeholder="Label (optional), e.g. Work order" />
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
  min-width: 0;
}
.save-btn {
  width: 100%;
  justify-content: center;
}
.dirty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0 2px;
}
.dirty-hint {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--amber);
}
.customer-field {
  position: relative;
}
.adjuster-note {
  font-size: 11.5px;
  line-height: 1.4;
  margin: 6px 0 2px;
}
.tl-title {
  margin-top: 14px;
}
.tl-hint {
  font-size: 11.5px;
  line-height: 1.4;
  margin: 4px 0 6px;
}
.doc-form input[type='file'] {
  margin-bottom: 8px;
  width: 100%;
}
.doc-form input[type='text'] {
  margin-bottom: 8px;
}
.doc-form {
  border-top: 1px solid var(--border-soft);
  padding-top: 12px;
  margin-top: 4px;
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
  flex: 1;
  min-width: 0;
}
.doc-meta {
  overflow-wrap: anywhere;
}
.doc-name {
  font-size: 13px;
  font-weight: 600;
  /* two lines, then an ellipsis — a long label never widens the card */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.doc-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
