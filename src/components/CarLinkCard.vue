<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import { linkCaseToCar, listCars, type CarOption } from '@/api/negotiation'
import { goToCrm } from '@/api/handoff'
import { useAuthStore } from '@/stores/auth'

/** Which CRM car this case belongs to. Linked, the car's Letters tab shows this case's letters
 *  to everyone on the car — sales reps included — to copy. One case per car. */
const props = defineProps<{ caseId: string; claimId: string | null }>()
const emit = defineEmits<{ refresh: [] }>()
const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)

const cars = ref<CarOption[] | null>(null)
const picking = ref(false)
const query = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const linked = computed(() => cars.value?.find((c) => c.id === props.claimId) ?? null)
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = cars.value ?? []
  return (q ? list.filter((c) => `ro-${c.roNumber} ${c.customer} ${c.vehicle}`.toLowerCase().includes(q)) : list).slice(0, 8)
})

async function loadCars() {
  if (cars.value) return
  try { cars.value = await listCars(shopId.value) } catch (e) { error.value = (e as Error).message }
}
if (props.claimId) void loadCars()

async function link(claimId: string | null) {
  busy.value = true
  error.value = null
  try {
    await linkCaseToCar(shopId.value, props.caseId, claimId)
    picking.value = false
    query.value = ''
    emit('refresh')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
async function startPicking() {
  picking.value = true
  await loadCars()
}
</script>

<template>
  <section class="card">
    <div class="panel-title">Linked car</div>
    <template v-if="claimId && !picking">
      <p class="car">
        <b v-if="linked">RO-{{ linked.roNumber }}</b> {{ linked ? `${linked.customer}${linked.vehicle ? ' · ' + linked.vehicle : ''}` : 'A car in your garage' }}
      </p>
      <p class="faint">This case's letters show on the car's Letters tab, so everyone working the car can copy them.</p>
      <div class="row">
        <button class="btn btn-ghost btn-sm" type="button" @click="goToCrm(`/claims/${claimId}/letters`, true)">
          Open the car <ExternalLink :size="13" />
        </button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="startPicking">Change</button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="link(null)">Unlink</button>
      </div>
    </template>
    <template v-else-if="!picking">
      <p class="faint">Not linked to a car. Link it and the car's Letters tab shows these letters to the people working
        the car — your sales reps included — to copy.</p>
      <button class="btn btn-primary btn-sm" type="button" @click="startPicking">Link to a car</button>
    </template>
    <template v-else>
      <input v-model="query" class="search" type="search" placeholder="Search RO, customer or vehicle" aria-label="Search cars" />
      <p v-if="!cars" class="faint">Loading cars…</p>
      <ul v-else class="picks">
        <li v-for="c in matches" :key="c.id">
          <button type="button" :disabled="busy || c.id === claimId" @click="link(c.id)">
            <b>RO-{{ c.roNumber }}</b> {{ c.customer }}<span v-if="c.vehicle" class="faint"> · {{ c.vehicle }}</span>
          </button>
        </li>
        <li v-if="!matches.length" class="faint">No cars match.</li>
      </ul>
      <button class="btn btn-ghost btn-sm" type="button" @click="picking = false">Cancel</button>
    </template>
    <p v-if="error" class="error-text">{{ error }}</p>
  </section>
</template>

<style scoped>
.car { margin: 0 0 6px; font-size: 14px; }
.faint { margin: 0 0 10px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.search { width: 100%; margin-bottom: 8px; }
.picks { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow: auto; }
.picks button { width: 100%; text-align: left; border: 1px solid var(--border); background: transparent; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; color: inherit; cursor: pointer; }
.picks button:hover:not(:disabled) { border-color: currentColor; }
.picks button:disabled { opacity: 0.55; cursor: default; }
</style>
