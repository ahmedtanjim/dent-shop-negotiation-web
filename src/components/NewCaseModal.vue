<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import { createCase } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseListItem, UpsertCase } from '@/api/types'
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
          <label class="field">
            <span>Customer</span>
            <input v-model="customerName" type="text" />
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
</style>
