<script setup lang="ts">
import { computed } from 'vue'
import type { Tactic } from '@/api/types'

const props = defineProps<{ tactic: Tactic }>()

const LABELS: Record<Tactic, string> = {
  None: 'No tactic',
  InfoRequest: 'Info request',
  RedundantRequest: 'Redundant request',
  Stall: 'Stall',
  Lowball: 'Lowball',
  LiabilityShift: 'Liability shift',
  Denial: 'Denial',
  Harassment: 'Harassment',
  Other: 'Other',
}

const cls = computed(() => {
  switch (props.tactic) {
    case 'None':
      return 'pill-gray'
    case 'InfoRequest':
      return 'pill-blue'
    case 'RedundantRequest':
    case 'Stall':
    case 'Lowball':
      return 'pill-amber'
    case 'LiabilityShift':
    case 'Denial':
    case 'Harassment':
      return 'pill-red'
    default:
      return 'pill-gray'
  }
})
</script>

<template>
  <span class="pill" :class="cls">{{ LABELS[tactic] }}</span>
</template>
