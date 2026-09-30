<script setup lang="ts">
import { ref } from 'vue'
import { gpcEnabled, optedOut, optOutOfSharing } from '@/analytics/privacy'
import { stopAnalytics } from '@/analytics/ga'

/** The public pages' "Turn off analytics" choice: one click opts this browser
 *  out of analytics (Global Privacy Control already does it automatically). */
const justNow = ref(false)
function optOut() {
  optOutOfSharing()
  stopAnalytics()
  justNow.value = true
}
</script>

<template>
  <span class="privacy-choice">
    <template v-if="optedOut">
      <span class="done">
        {{ gpcEnabled && !justNow ? 'Global Privacy Control honored — no analytics on this browser.' : 'Opted out — no analytics on this browser.' }}
      </span>
    </template>
    <a v-else href="#" @click.prevent="optOut">Turn off analytics</a>
  </span>
</template>

<style scoped>
.privacy-choice a {
  color: inherit;
  text-decoration: underline;
}
.done {
  color: inherit;
}
</style>
