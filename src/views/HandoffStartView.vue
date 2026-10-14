<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CRM_URL } from '@/api/client'
import { newChallenge } from '@/utils/pkce'
import { safeRedirect } from '@/utils/safeRedirect'

/** Step 1 of a sign-in carried over from the shop system (/auth/handoff/start?redirect=…):
 *  keep a fresh PKCE verifier in this tab, then ask the shop system to mint a code bound to it.
 *  It sends the code back to /auth/handoff, which exchanges it with the verifier. */

const route = useRoute()
const error = ref(false)

onMounted(async () => {
  const redirect = safeRedirect(route.query.redirect)
  try {
    const challenge = await newChallenge()
    window.location.replace(
      `${CRM_URL}/auth/handoff/out?challenge=${challenge}&next=${encodeURIComponent(redirect)}`,
    )
  } catch {
    error.value = true // no Web Crypto / storage (very old browser, locked-down private mode)
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <p v-if="!error" class="muted state"><span class="spinner"></span> Signing you in…</p>
      <template v-else>
        <p class="error-text">This browser can't carry your sign-in over from the shop system.</p>
        <RouterLink class="btn btn-primary" :to="{ name: 'login' }">Sign in with your password</RouterLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.state {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
