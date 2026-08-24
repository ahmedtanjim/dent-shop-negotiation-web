<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { getShopProfile, updateShopRates } from '@/api/shops'
import { ApiError } from '@/api/client'
import type { ShopProfile } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()

const profile = ref<ShopProfile | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const defaultStoragePerDay = ref(0)
const adminFee = ref(0)
const lotFee = ref(0)
const salesTaxPercent = ref(0)

onMounted(async () => {
  if (!auth.shopId) return
  try {
    const p = await getShopProfile(auth.shopId)
    profile.value = p
    defaultStoragePerDay.value = p.defaultStoragePerDay
    adminFee.value = p.adminFee
    lotFee.value = p.lotFee
    salesTaxPercent.value = p.salesTaxPercent
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the shop profile.'
  } finally {
    loading.value = false
  }
})

const busy = ref(false)
const saved = ref(false)

async function save() {
  if (!auth.shopId || !profile.value) return
  busy.value = true
  error.value = null
  try {
    await updateShopRates(auth.shopId, profile.value, {
      defaultStoragePerDay: Number(defaultStoragePerDay.value) || 0,
      adminFee: Number(adminFee.value) || 0,
      lotFee: Number(lotFee.value) || 0,
      salesTaxPercent: Number(salesTaxPercent.value) || 0,
    })
    saved.value = true
    setTimeout(() => emit('close'), 700)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Save failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @mousedown.self="emit('close')">
    <div class="modal rates-modal">
      <div class="modal-head">
        <h2>Shop rates</h2>
        <button class="btn btn-ghost btn-sm" @click="emit('close')"><X :size="16" /></button>
      </div>

      <p class="muted hint">
        The defaults behind every case's Total Loss invoice and itemized breakdown letter. Any
        case can override them in its details.
      </p>

      <div v-if="loading" class="muted"><span class="spinner"></span> Loading…</div>

      <form v-else @submit.prevent="save">
        <div class="form-grid">
          <label class="field">
            <span>Admin / blueprinting fee ($)</span>
            <input v-model.number="adminFee" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Commercial lot / gate fee ($)</span>
            <input v-model.number="lotFee" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Storage per day ($)</span>
            <input v-model.number="defaultStoragePerDay" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Sales tax (%)</span>
            <input v-model.number="salesTaxPercent" type="number" min="0" max="100" step="0.01" />
          </label>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>

        <div class="actions">
          <button class="btn" type="button" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="busy">
            <span v-if="busy" class="spinner"></span>
            {{ saved ? 'Saved' : 'Save rates' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.rates-modal {
  max-width: 460px;
}
.hint {
  font-size: 13px;
  line-height: 1.45;
  margin-bottom: 14px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
</style>
