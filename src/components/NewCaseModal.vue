<script setup lang="ts">
import { ref } from 'vue'
import { User, Check, X } from 'lucide-vue-next'
import { createCase } from '@/api/negotiation'
import { searchCustomers } from '@/api/customers'
import { ApiError } from '@/api/client'
import type { CaseListItem, CustomerSearchResult, UpsertCase } from '@/api/types'
import { US_STATES } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{
  close: []
  created: [c: CaseListItem]
}>()

const auth = useAuthStore()

const title = ref('')
const insurerName = ref('')
const insurerClaimNumber = ref('')
const adjusterName = ref('')
const adjusterEmail = ref('')
const adjusterPhone = ref('')
const customerName = ref('')
const vehicleDescription = ref('')
const state = ref('OH')
const invoiceTotal = ref<number | null>(null)
const storagePerDay = ref<number | null>(null)
const notes = ref('')

const busy = ref(false)
const error = ref<string | null>(null)

/* ---------- customer picker ---------- */
// Free-text underneath (a case can name a customer who isn't in the CRM yet), but
// typing searches real CRM customers so the common case is pick-not-retype.
const customerResults = ref<CustomerSearchResult[]>([])
const customerDropdownOpen = ref(false)
const customerSearchBusy = ref(false)
const linkedCustomerId = ref<string | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

function onCustomerInput() {
  linkedCustomerId.value = null // free typing detaches from any previously picked record
  clearTimeout(searchTimer)
  searchTimer = setTimeout(runCustomerSearch, 250)
}

async function runCustomerSearch() {
  if (!auth.shopId) return
  customerSearchBusy.value = true
  try {
    customerResults.value = await searchCustomers(auth.shopId, customerName.value)
    customerDropdownOpen.value = true
  } catch {
    // Non-critical: the field still works as plain free text if search fails.
    customerResults.value = []
  } finally {
    customerSearchBusy.value = false
  }
}

function pickCustomer(c: CustomerSearchResult) {
  customerName.value = c.fullName
  if (!vehicleDescription.value.trim() && c.vehicleLabel) vehicleDescription.value = c.vehicleLabel
  linkedCustomerId.value = c.id
  customerDropdownOpen.value = false
}

function closeCustomerDropdownSoon() {
  // Let a pending click on a dropdown option register before the blur closes it.
  setTimeout(() => (customerDropdownOpen.value = false), 150)
}

function opt(v: string): string | null {
  const t = v.trim()
  return t ? t : null
}

async function submit() {
  if (!auth.shopId) return
  error.value = null
  busy.value = true
  try {
    const body: UpsertCase = {
      title: title.value.trim(),
      insurerName: opt(insurerName.value),
      insurerClaimNumber: opt(insurerClaimNumber.value),
      adjusterName: opt(adjusterName.value),
      adjusterEmail: opt(adjusterEmail.value),
      adjusterPhone: opt(adjusterPhone.value),
      customerName: opt(customerName.value),
      vehicleDescription: opt(vehicleDescription.value),
      state: opt(state.value.toUpperCase()),
      invoiceTotal: invoiceTotal.value ?? 0,
      storagePerDay: storagePerDay.value ?? 0,
      notes: opt(notes.value),
    }
    const created = await createCase(auth.shopId, body)
    emit('created', created)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not create the case.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @mousedown.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>New negotiation case</h2>
        <button class="btn btn-ghost btn-sm" @click="emit('close')"><X :size="16" /></button>
      </div>

      <form @submit.prevent="submit">
        <label class="field">
          <span>Case title *</span>
          <input v-model="title" type="text" required placeholder="e.g. Smith — State Farm supplement dispute" />
        </label>

        <div class="form-grid">
          <label class="field">
            <span>Insurer</span>
            <input v-model="insurerName" type="text" placeholder="State Farm" />
          </label>
          <label class="field">
            <span>Insurer claim #</span>
            <input v-model="insurerClaimNumber" type="text" />
          </label>
          <label class="field">
            <span>Adjuster name</span>
            <input v-model="adjusterName" type="text" />
          </label>
          <label class="field">
            <span>Adjuster email</span>
            <input v-model="adjusterEmail" type="email" />
          </label>
          <label class="field">
            <span>Adjuster phone</span>
            <input v-model="adjusterPhone" type="text" />
          </label>
          <label class="field customer-field">
            <span>Customer</span>
            <div class="customer-combo">
              <input
                v-model="customerName"
                type="text"
                placeholder="Start typing a name…"
                autocomplete="off"
                @input="onCustomerInput"
                @focus="runCustomerSearch"
                @blur="closeCustomerDropdownSoon"
              />
              <span v-if="linkedCustomerId" class="linked-badge" title="Linked to a CRM customer record">
                <Check :size="12" /> CRM
              </span>
              <div v-if="customerDropdownOpen && customerResults.length" class="customer-dropdown">
                <button
                  v-for="c in customerResults"
                  :key="c.id"
                  type="button"
                  class="customer-option"
                  @mousedown.prevent="pickCustomer(c)"
                >
                  <User :size="13" class="customer-option-icon" />
                  <span class="customer-option-main">
                    <span class="customer-option-name">{{ c.fullName }}</span>
                    <span v-if="c.vehicleLabel" class="customer-option-vehicle faint">{{ c.vehicleLabel }}</span>
                  </span>
                  <span v-if="c.phone" class="customer-option-phone faint">{{ c.phone }}</span>
                </button>
              </div>
            </div>
          </label>
          <label class="field full">
            <span>Vehicle</span>
            <input v-model="vehicleDescription" type="text" placeholder="2022 Ford F-150, white" />
          </label>
          <label class="field">
            <span>State</span>
            <input v-model="state" type="text" maxlength="2" list="us-states" placeholder="OH" />
            <datalist id="us-states">
              <option v-for="s in US_STATES" :key="s" :value="s" />
            </datalist>
          </label>
          <label class="field">
            <span>Invoice total ($) *</span>
            <input v-model.number="invoiceTotal" type="number" min="0" step="0.01" required />
          </label>
          <label class="field">
            <span>Storage per day ($)</span>
            <input v-model.number="storagePerDay" type="number" min="0" step="0.01" />
          </label>
        </div>

        <label class="field">
          <span>Notes</span>
          <textarea v-model="notes" rows="3" />
        </label>

        <p v-if="error" class="error-text">{{ error }}</p>

        <div class="actions">
          <button class="btn" type="button" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="busy">
            <span v-if="busy" class="spinner"></span>
            Create case
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
.customer-field {
  position: relative;
}
.customer-combo {
  position: relative;
}
.linked-badge {
  position: absolute;
  top: -22px;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--green);
  background: var(--green-soft);
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 999px;
  padding: 1px 7px;
}
.customer-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}
.customer-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 6px;
  padding: 7px 8px;
  cursor: pointer;
  font: inherit;
  color: var(--text);
}
.customer-option:hover {
  background: var(--panel-soft);
}
.customer-option-icon {
  color: var(--text-faint);
  flex-shrink: 0;
}
.customer-option-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.customer-option-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.customer-option-vehicle {
  font-size: 11.5px;
}
.customer-option-phone {
  font-size: 11.5px;
  flex-shrink: 0;
}
</style>
