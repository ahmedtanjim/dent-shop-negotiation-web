<script setup lang="ts">
import { ref } from 'vue'
import { User, Check } from 'lucide-vue-next'
import { searchCustomers } from '@/api/customers'
import type { CustomerSearchResult } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

/* Shared CRM customer combobox (new-case modal + case-details sidebar): free text stays
   allowed (a case can name a customer who isn't in the CRM yet), but typing searches real
   CRM customers so the common case is pick-not-retype. Picking links the record
   (customer-id v-model); free typing detaches it. */

const name = defineModel<string>({ required: true })
const customerId = defineModel<string | null>('customerId', { required: true })
const emit = defineEmits<{ picked: [c: CustomerSearchResult] }>()

const auth = useAuthStore()

const results = ref<CustomerSearchResult[]>([])
const open = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function onInput() {
  customerId.value = null // free typing detaches from any previously picked record
  clearTimeout(timer)
  timer = setTimeout(runSearch, 250)
}

async function runSearch() {
  if (!auth.shopId) return
  try {
    results.value = await searchCustomers(auth.shopId, name.value)
    open.value = true
  } catch {
    // Non-critical: the field still works as plain free text if search fails.
    results.value = []
  }
}

function pick(c: CustomerSearchResult) {
  name.value = c.fullName
  customerId.value = c.id
  open.value = false
  emit('picked', c)
}

function closeSoon() {
  // Let a pending click on a dropdown option register before the blur closes it.
  setTimeout(() => (open.value = false), 150)
}
</script>

<template>
  <div class="customer-combo">
    <input
      v-model="name"
      type="text"
      placeholder="Start typing a name…"
      autocomplete="off"
      @input="onInput"
      @focus="runSearch"
      @blur="closeSoon"
    />
    <span v-if="customerId" class="linked-badge" title="Linked to a CRM customer record">
      <Check :size="12" /> CRM
    </span>
    <div v-if="open && results.length" class="customer-dropdown">
      <button
        v-for="c in results"
        :key="c.id"
        type="button"
        class="customer-option"
        @mousedown.prevent="pick(c)"
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
</template>

<style scoped>
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
