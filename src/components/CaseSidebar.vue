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
import type { CaseDetail, CustomerSearchResult, UpsertCase } from '@/api/types'
import { formatBytes, US_STATES } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import CustomerPicker from '@/components/CustomerPicker.vue'

const props = defineProps<{ detail: CaseDetail }>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

/* ---------- editable case fields ---------- */
// Adjuster fields have no inputs anymore (they fill from uploaded insurer emails),
// but they stay in the form state so saving round-trips them instead of wiping them.

const form = ref({
  title: '',
  insurerName: '',
  insurerClaimNumber: '',
  adjusterName: '',
  adjusterEmail: '',
  adjusterPhone: '',
  customerName: '',
  customerId: null as string | null,
  vehicleDescription: '',
  state: '',
  invoiceTotal: 0,
  storagePerDay: 0,
  // TL-invoice inputs. Fees/tax as strings: '' = use the shop default (null on the wire).
  storageStartDate: '',
  storageEndDate: '',
  adminFee: '',
  lotFee: '',
  salesTaxPercent: '',
  notes: '',
})

// Snapshot of the last server state the form was reset to — refreshes fire constantly
// (documents, intake), and they must never clobber in-progress edits. It starts as the
// stringified initial form so the very first watch tick reads as clean and populates.
const pristine = ref(JSON.stringify(form.value))

function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

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
    customerId: d.customerId,
    vehicleDescription: d.vehicleDescription ?? '',
    state: d.case.state ?? '',
    invoiceTotal: d.case.invoiceTotalCents / 100,
    storagePerDay: d.storagePerDayCents / 100,
    storageStartDate: dateOnly(d.storageStartDate),
    storageEndDate: dateOnly(d.storageEndDate),
    adminFee: d.adminFee === null ? '' : String(d.adminFee),
    lotFee: d.lotFee === null ? '' : String(d.lotFee),
    salesTaxPercent: d.salesTaxPercent === null ? '' : String(d.salesTaxPercent),
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

function optNum(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
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
      customerId: f.customerId,
      vehicleDescription: opt(f.vehicleDescription),
      state: opt(f.state.toUpperCase()),
      invoiceTotal: Number(f.invoiceTotal) || 0,
      storagePerDay: Number(f.storagePerDay) || 0,
      storageStartDate: opt(f.storageStartDate),
      storageEndDate: opt(f.storageEndDate),
      adminFee: optNum(f.adminFee),
      lotFee: optNum(f.lotFee),
      salesTaxPercent: optNum(f.salesTaxPercent),
      notes: opt(f.notes),
    }
    await updateCase(shopId.value, caseId.value, body)
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
      <form @submit.prevent="save">
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

        <div class="panel-title tl-title">Total Loss invoice inputs</div>
        <div class="form-grid">
          <label class="field">
            <span>In shop since</span>
            <input v-model="form.storageStartDate" type="date" />
          </label>
          <label class="field">
            <span>Storage ends (optional)</span>
            <input v-model="form.storageEndDate" type="date" />
          </label>
          <label class="field">
            <span>Storage / day ($)</span>
            <input v-model.number="form.storagePerDay" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Sales tax (%)</span>
            <input v-model="form.salesTaxPercent" type="number" min="0" step="0.01" placeholder="Shop default" />
          </label>
          <label class="field">
            <span>Admin fee ($)</span>
            <input v-model="form.adminFee" type="number" min="0" step="0.01" placeholder="Shop default" />
          </label>
          <label class="field">
            <span>Lot / gate fee ($)</span>
            <input v-model="form.lotFee" type="number" min="0" step="0.01" placeholder="Shop default" />
          </label>
        </div>
        <p class="faint tl-hint">
          Empty fee fields use your shop defaults (set from the cases page). Leave "storage ends"
          empty while the car is still on your lot — it accrues through today.
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
      <p v-else class="faint">Work orders, estimates, photos, signed contracts.</p>

      <form class="doc-form" @submit.prevent="submitDocument">
        <input ref="fileInput" type="file" />
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
