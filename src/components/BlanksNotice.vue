<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { CRM_URL } from '@/api/client'
import { goToCrm } from '@/api/handoff'
import type { MissingLetterDetail } from '@/api/types'
import type { Blank } from '@/utils/placeholders'

/** "This letter still has blanks" — shown above an older letter or draft that carries a
 *  bracketed placeholder, so it never reads as finished. Letters no longer get blanks
 *  (owner decision 2026-10-03): they are written around what's missing and the API lists
 *  it as `missing`, shown here as what to add. Profile items link to the shop system's
 *  Settings, where the shop profile lives. */
const props = defineProps<{ blanks?: Blank[]; missing?: MissingLetterDetail[]; what?: string }>()

const profileLabels = computed(() =>
  unique([
    ...(props.blanks ?? []).filter((b) => b.profile).map((b) => b.label),
    ...(props.missing ?? []).filter((m) => m.inShopProfile).map((m) => m.label),
  ]),
)
const other = computed(() => (props.blanks ?? []).filter((b) => !b.profile))
const onCase = computed(() =>
  unique((props.missing ?? []).filter((m) => !m.inShopProfile).map((m) => m.label)),
)
const unique = (xs: string[]) => [...new Set(xs)]
const show = computed(() => profileLabels.value.length + other.value.length + onCase.value.length > 0)
</script>

<template>
  <div v-if="show" class="blanks" role="note">
    <AlertTriangle :size="15" class="ico" aria-hidden="true" />
    <div class="txt">
      <p v-if="profileLabels.length">
        <strong>Missing from your shop profile:</strong> {{ profileLabels.join(', ') }}.
        <a
          :href="`${CRM_URL}/settings`"
          target="_blank"
          rel="noopener"
          @click.prevent="goToCrm('/settings', true)"
        >{{ profileLabels.length > 1 ? 'Add them' : 'Add it' }} in Settings</a>
        and {{ what ?? 'the letters' }} fill {{ profileLabels.length > 1 ? 'them' : 'it' }} in automatically.
      </p>
      <p v-if="onCase.length">
        <strong>Not on this case yet:</strong> {{ onCase.join(', ') }}. The letters are written
        without {{ onCase.length > 1 ? 'them' : 'it' }}; add {{ onCase.length > 1 ? 'them' : 'it' }}
        on this case to make them more specific.
      </p>
      <p v-if="other.length">
        <strong>Fill in before sending:</strong>
        {{ other.length === 1 ? 'the highlighted blank' : `the ${other.length} highlighted blanks` }}
        (<span class="mark-sample">[LIKE THIS]</span>).
      </p>
    </div>
  </div>
</template>

<style scoped>
.blanks {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid rgba(245, 166, 35, 0.4);
  background: var(--amber-soft);
  color: var(--text);
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.5;
}
.ico {
  color: var(--amber);
  flex-shrink: 0;
  margin-top: 2px;
}
.txt p {
  margin: 0;
}
.txt p + p {
  margin-top: 4px;
}
.mark-sample {
  background: rgba(245, 166, 35, 0.28);
  border-radius: 3px;
  padding: 0 3px;
  font-weight: 600;
}
</style>
