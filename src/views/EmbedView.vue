<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeHandoff } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { fromParent, isEmbedded, MSG, postToParent } from '@/utils/embed'
import { newChallenge, takeVerifier } from '@/utils/pkce'
import { safeRedirect } from '@/utils/safeRedirect'

/** /embed?redirect=/cases/:id&theme=… — the first page of the Negotiator inside the shop
 *  system's car page. Signs in as the shop system's user through a PKCE hand-off over
 *  postMessage (utils/embed), then opens `redirect`. Opened on its own (not framed) it just
 *  goes on to `redirect`, where the usual sign-in applies. */

const TIMEOUT_MS = 15_000
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ent = useEntitlementStore()
const redirect = safeRedirect(route.query.redirect)
const error = ref<string | null>(null)
let timer: number | undefined
let done = false

async function onMessage(e: MessageEvent) {
  if (done || !fromParent(e) || e.data.type !== MSG.handoffCode) return
  done = true
  clearTimeout(timer)
  if (typeof e.data.error === 'string' && e.data.error) {
    error.value = e.data.error
    return
  }
  const code = typeof e.data.code === 'string' ? e.data.code : ''
  const verifier = takeVerifier()
  if (!code || !verifier) {
    error.value = "DSM Negotiator couldn't sign you in here."
    return
  }
  try {
    const session = await exchangeHandoff(code, verifier)
    auth.setSession(session)
    ent.reset()
    await router.replace(redirect)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : "DSM Negotiator couldn't sign you in here."
  }
}

onMounted(async () => {
  if (!isEmbedded()) {
    await router.replace(redirect)
    return
  }
  window.addEventListener('message', onMessage)
  try {
    const challenge = await newChallenge()
    postToParent({ type: MSG.handoffRequest, challenge })
    timer = window.setTimeout(() => {
      if (done) return
      done = true
      error.value = "The shop system didn't answer. Reload the page to try again."
    }, TIMEOUT_MS)
  } catch {
    error.value = "This browser can't carry your sign-in over from the shop system."
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  clearTimeout(timer)
})
</script>

<template>
  <div class="embed-page">
    <p v-if="!error" class="muted state" role="status"><span class="spinner"></span> Opening DSM Negotiator…</p>
    <p v-else class="error-text" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.embed-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}
.state {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
