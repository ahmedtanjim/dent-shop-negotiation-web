<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { createCase } from '@/api/negotiation'
import { getShopProfile } from '@/api/shops'
import { ApiError } from '@/api/client'
import type { CaseListItem, CustomerSearchResult, UpsertCase } from '@/api/types'
import { US_STATES } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import CustomerPicker from '@/components/CustomerPicker.vue'

const emit = defineEmits<{
  close: []
  created: [c: CaseListItem]
}>()

const auth = useAuthStore()

const customerName = ref('')
const linkedCustomerId = ref<string | null>(null)
const vehicleDescription = ref('')
const title = ref('')
const insurerName = ref('')
const insurerClaimNumber = ref('')
const state = ref('')
const invoiceTotal = ref<number | null>(null)
const storagePerDay = ref<number | null>(null)
// Local calendar date (toISOString would flip to yesterday/tomorrow across UTC midnight).
const now = new Date()
const storageStartDate = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
)
const notes = ref('')

const busy = ref(false)
const error = ref<string | null>(null)

// Prefill from the shop's DSM profile: the storage rate, and the state parsed from the
// shop's own address ("… Bedford Heights OH 44146" → OH) so it isn't typed per case.
onMounted(async () => {
  if (!auth.shopId) return
  try {
    const profile = await getShopProfile(auth.shopId)
    if (storagePerDay.value === null && profile.defaultStoragePerDay > 0) {
      storagePerDay.value = profile.defaultStoragePerDay
    }
    if (!state.value && profile.address) {
      const m = profile.address
        .toUpperCase()
        .match(/[,\s]([A-Z]{2})(?:[\s,]*\d{5}(?:-\d{4})?)?\s*$/)
      if (m && US_STATES.includes(m[1])) state.value = m[1]
    }
  } catch {
    // Non-critical — the fields simply stay empty.
  }
})

function onCustomerPicked(c: CustomerSearchResult) {
  if (!vehicleDescription.value.trim() && c.vehicleLabel) vehicleDescription.value = c.vehicleLabel
  // Auto-title so the form stays a two-field job for CRM customers.
  if (!title.value.trim())
    title.value = c.vehicleLabel ? `${c.fullName} — ${c.vehicleLabel}` : c.fullName
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
      customerName: opt(customerName.value),
      vehicleDescription: opt(vehicleDescription.value),
      state: opt(state.value.toUpperCase()),
      invoiceTotal: invoiceTotal.value ?? 0,
      storagePerDay: storagePerDay.value ?? 0,
      storageStartDate: opt(storageStartDate.value),
      notes: opt(notes.value),
      customerId: linkedCustomerId.value,
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
        <!-- customer first: pick from DSM and the name, vehicle, and title fill themselves -->
        <label class="field customer-field">
          <span>Customer — start typing to pull from DSM</span>
          <CustomerPicker
            v-model="customerName"
            v-model:customer-id="linkedCustomerId"
            @picked="onCustomerPicked"
          />
        </label>

        <div class="form-grid">
          <label class="field full">
            <span>Vehicle</span>
            <input v-model="vehicleDescription" type="text" placeholder="2022 Ford F-150, white" />
          </label>
          <label class="field">
            <span>Insurer</span>
            <input v-model="insurerName" type="text" placeholder="State Farm" />
          </label>
          <label class="field">
            <span>Insurer claim #</span>
            <input v-model="insurerClaimNumber" type="text" />
          </label>
          <label class="field">
            <span>State</span>
            <input v-model="state" type="text" maxlength="2" list="us-states" placeholder="OH" />
            <datalist id="us-states">
              <option v-for="s in US_STATES" :key="s" :value="s" />
            </datalist>
          </label>
          <label class="field">
            <span>In shop since</span>
            <input v-model="storageStartDate" type="date" />
          </label>
          <label class="field">
            <span>Invoice total ($)</span>
            <input v-model.number="invoiceTotal" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Storage per day ($)</span>
            <input v-model.number="storagePerDay" type="number" min="0" step="0.01" />
          </label>
        </div>

        <label class="field">
          <span>Case title *</span>
          <input v-model="title" type="text" required placeholder="Fills itself when you pick a customer" />
        </label>

        <label class="field">
          <span>Notes</span>
          <textarea v-model="notes" rows="2" />
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
</style>
