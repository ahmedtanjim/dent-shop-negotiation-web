<script setup lang="ts">
import { computed } from 'vue'
import type { CaseStatus } from '@/api/types'

const props = defineProps<{ status: CaseStatus }>()

const cls = computed(() => {
  switch (props.status) {
    case 'Open':
      return 'pill-blue'
    case 'Settled':
      return 'pill-green'
    case 'Litigation':
      return 'pill-red'
    case 'Closed':
      return 'pill-gray'
    default:
      return 'pill-gray'
  }
})
</script>

<template>
  <span class="pill" :class="cls">{{ status }}</span>
</template>
