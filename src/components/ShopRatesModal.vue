<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { getShopProfile, updateShopRates } from '@/api/shops'
import { ApiError } from '@/api/client'
import { parseMoney, parsePercent } from '@/utils/amount'
import { useAuthStore } from '@/stores/auth'
import { useEscapeToClose } from '@/utils/escapeToClose'

const emit = defineEmits<{ close: [] }>()
useEscapeToClose(() => emit('close'))

const auth = useAuthStore()

const loaded = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)

/* Typed as text and parsed strictly (utils/amount): "-50" or "1e6" is an error under the
   box, never a silent number. Only a box whose text was changed since the dialog opened is
   sent: an untouched box sends null (the API keeps the stored value), so a rate changed in
   the CRM while this dialog was open is never written back. An edited box that is EMPTY
   also keeps the current default; 0 clears it. */
const f = ref({ admin: '', lot: '', perDay: '', tax: '' })
type Box = keyof typeof f.value
/** Each box's text as the dialog opened (after the profile loaded). */
const opened = ref({ ...f.value })
/** A saved default as its box shows it; 0 is "not set" and shows empty. */
function money(n: number | null): string {
  return n ? n.toFixed(2) : ''
}

onMounted(async () => {
  if (!auth.shopId) return
  try {
    const p = await getShopProfile(auth.shopId)
    f.value = {
      admin: money(p.adminFee),
      lot: money(p.lotFee),
      perDay: money(p.defaultStoragePerDay),
      tax: p.salesTaxPercent ? String(p.salesTaxPercent) : '',
    }
    opened.value = { ...f.value }
    loaded.value = true
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the shop profile.'
  } finally {
    loading.value = false
  }
})

const parsed = computed(() => ({
  admin: parseMoney(f.value.admin, 'Admin fee'),
  lot: parseMoney(f.value.lot, 'Lot / gate fee'),
  perDay: parseMoney(f.value.perDay, 'Storage per day'),
  tax: parsePercent(f.value.tax, 'Sales tax'),
}))
const hasErrors = computed(() => Object.values(parsed.value).some((p) => p.error))
/** What a box sends: its typed value once edited, otherwise null (keep). */
function sent(k: Box): number | null {
  return f.value[k].trim() === opened.value[k].trim() ? null : parsed.value[k].value
}

const busy = ref(false)
const saved = ref(false)

async function save() {
  if (!auth.shopId || !loaded.value || hasErrors.value) return
  busy.value = true
  error.value = null
  try {
    await updateShopRates(auth.shopId, {
      defaultStoragePerDay: sent('perDay'),
      adminFee: sent('admin'),
      lotFee: sent('lot'),
      salesTaxPercent: sent('tax'),
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

      <p v-else-if="!loaded" class="error-text">{{ error }}</p>

      <form v-else novalidate @submit.prevent="save">
        <div class="form-grid">
          <label class="field">
            <span>Admin / blueprinting fee ($)</span>
            <input v-model="f.admin" type="text" inputmode="decimal" placeholder="not set"
              :class="{ invalid: parsed.admin.error }" :aria-invalid="!!parsed.admin.error" />
            <small v-if="parsed.admin.error" class="field-error">{{ parsed.admin.error }}</small>
          </label>
          <label class="field">
            <span>Commercial lot / gate fee ($)</span>
            <input v-model="f.lot" type="text" inputmode="decimal" placeholder="not set"
              :class="{ invalid: parsed.lot.error }" :aria-invalid="!!parsed.lot.error" />
            <small v-if="parsed.lot.error" class="field-error">{{ parsed.lot.error }}</small>
          </label>
          <label class="field">
            <span>Storage per day ($)</span>
            <input v-model="f.perDay" type="text" inputmode="decimal" placeholder="not set"
              :class="{ invalid: parsed.perDay.error }" :aria-invalid="!!parsed.perDay.error" />
            <small v-if="parsed.perDay.error" class="field-error">{{ parsed.perDay.error }}</small>
          </label>
          <label class="field">
            <span>Sales tax (%)</span>
            <input v-model="f.tax" type="text" inputmode="decimal" placeholder="not set"
              :class="{ invalid: parsed.tax.error }" :aria-invalid="!!parsed.tax.error" />
            <small v-if="parsed.tax.error" class="field-error">{{ parsed.tax.error }}</small>
          </label>
        </div>
        <p class="faint keep-hint">Leave a box empty to keep its current default; type 0 to clear it.</p>

        <p v-if="error" class="error-text">{{ error }}</p>

        <div class="actions">
          <button class="btn" type="button" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="busy || hasErrors">
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
  max-width: 520px;
}
.hint {
  font-size: 13px;
  line-height: 1.45;
  margin-bottom: 14px;
}
.keep-hint {
  font-size: 12.5px;
  margin: -4px 0 8px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
</style>
