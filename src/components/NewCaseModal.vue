<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { createCase } from '@/api/negotiation'
import { getShopProfile } from '@/api/shops'
import { ApiError } from '@/api/client'
import type { CaseListItem, CustomerSearchResult, UpsertCase } from '@/api/types'
import { oneLine, US_STATES } from '@/utils/format'
import { parseMoney } from '@/utils/amount'
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
// Money fields are typed text, parsed strictly on submit (no native number bubbles).
const invoiceTotal = ref('')
const storagePerDay = ref('')
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
    if (!storagePerDay.value && profile.defaultStoragePerDay > 0) {
      storagePerDay.value = profile.defaultStoragePerDay.toFixed(2)
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

/* Inline validation — shown after the first Create click, then live as the user fixes. */
const submitted = ref(false)
const parsedInvoice = computed(() => parseMoney(invoiceTotal.value, 'Repair estimate'))
const parsedRate = computed(() => parseMoney(storagePerDay.value, 'Storage per day'))
const errors = computed(() => {
  const out: Record<string, string> = {}
  if (!oneLine(title.value)) out.title = 'Give the case a title — it fills itself when you pick a customer.'
  if (parsedInvoice.value.error) out.invoice = parsedInvoice.value.error
  if (parsedRate.value.error) out.rate = parsedRate.value.error
  if (state.value && !US_STATES.includes(state.value)) out.state = 'Pick the state from the list.'
  return out
})
const showErr = (k: string) => (submitted.value ? errors.value[k] : undefined)

async function submit() {
  if (!auth.shopId) return
  submitted.value = true
  if (Object.keys(errors.value).length) return
  error.value = null
  busy.value = true
  try {
    const body: UpsertCase = {
      // single-line fields collapse stray spaces — they reach subjects and file names
      title: oneLine(title.value) ?? '',
      insurerName: oneLine(insurerName.value),
      insurerClaimNumber: oneLine(insurerClaimNumber.value),
      customerName: oneLine(customerName.value),
      vehicleDescription: oneLine(vehicleDescription.value),
      state: opt(state.value),
      invoiceTotal: parsedInvoice.value.value ?? 0,
      storagePerDay: parsedRate.value.value ?? 0,
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

      <form novalidate @submit.prevent="submit">
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
            <select v-model="state" :class="{ invalid: showErr('state') }">
              <option value="">— choose —</option>
              <option v-for="s in US_STATES" :key="s" :value="s">{{ s }}</option>
            </select>
            <small v-if="showErr('state')" class="field-error">{{ showErr('state') }}</small>
          </label>
          <label class="field">
            <span>In shop since</span>
            <input v-model="storageStartDate" type="date" />
          </label>
          <label class="field">
            <span>Repair estimate ($)</span>
            <input v-model="invoiceTotal" type="text" inputmode="decimal" placeholder="0.00"
              :class="{ invalid: showErr('invoice') }" :aria-invalid="!!showErr('invoice')" />
            <small v-if="showErr('invoice')" class="field-error">{{ showErr('invoice') }}</small>
          </label>
          <label class="field">
            <span>Storage per day ($)</span>
            <input v-model="storagePerDay" type="text" inputmode="decimal" placeholder="0.00"
              :class="{ invalid: showErr('rate') }" :aria-invalid="!!showErr('rate')" />
            <small v-if="showErr('rate')" class="field-error">{{ showErr('rate') }}</small>
          </label>
        </div>

        <label class="field">
          <span>Case title *</span>
          <input v-model="title" type="text" required placeholder="Fills itself when you pick a customer"
            :class="{ invalid: showErr('title') }" :aria-invalid="!!showErr('title')" />
          <small v-if="showErr('title')" class="field-error">{{ showErr('title') }}</small>
        </label>

        <label class="field">
          <span>Notes</span>
          <textarea v-model="notes" rows="2" />
        </label>

        <p v-if="submitted && Object.keys(errors).length" class="error-text" role="alert">
          Fix the highlighted {{ Object.keys(errors).length === 1 ? 'field' : 'fields' }} to create the case.
        </p>
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
