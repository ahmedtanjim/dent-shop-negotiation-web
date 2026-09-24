<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { CRM_URL } from '@/api/client'
import { goToCrm } from '@/api/handoff'
import type { Blank } from '@/utils/placeholders'

/** "This letter still has blanks" — shown above any letter or draft that carries a
 *  bracketed placeholder, so it never reads as finished. Profile blanks link to the shop
 *  system's Settings, where the shop profile lives. */
const props = defineProps<{ blanks: Blank[]; what?: string }>()

const profile = computed(() => props.blanks.filter((b) => b.profile))
const other = computed(() => props.blanks.filter((b) => !b.profile))
const unique = (xs: Blank[]) => [...new Set(xs.map((b) => b.label))]
</script>

<template>
  <div v-if="blanks.length" class="blanks" role="note">
    <AlertTriangle :size="15" class="ico" aria-hidden="true" />
    <div class="txt">
      <p v-if="profile.length">
        <strong>Missing from your shop profile:</strong> {{ unique(profile).join(', ') }}.
        <a
          :href="`${CRM_URL}/settings`"
          target="_blank"
          rel="noopener"
          @click.prevent="goToCrm('/settings', true)"
        >{{ unique(profile).length > 1 ? 'Add them' : 'Add it' }} in Settings</a>
        and {{ what ?? 'the letters' }} fill {{ unique(profile).length > 1 ? 'them' : 'it' }} in automatically.
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
