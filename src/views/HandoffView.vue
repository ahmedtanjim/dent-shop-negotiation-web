<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeHandoff } from '@/api/auth'
import { ApiError } from '@/api/client'
import type { AuthResponse } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { takeVerifier } from '@/utils/pkce'
import { safeRedirect } from '@/utils/safeRedirect'

/** Step 3 of a sign-in carried over from the shop system: /auth/handoff?code=…&redirect=…
 *  The code is single-use, lives 60 seconds and only exchanges with the PKCE verifier this tab
 *  kept at /auth/handoff/start — a link from anyone else's browser fails here. When this tab
 *  is already signed in as someone else, it asks before switching. */

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ent = useEntitlementStore()
const error = ref<string | null>(null)
const pending = ref<AuthResponse | null>(null)
const redirect = safeRedirect(route.query.redirect)

function finish(session: AuthResponse) {
  auth.setSession(session)
  ent.reset()
  router.replace(redirect)
}

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  // The code is spent either way; keep it out of history and any Referer.
  window.history.replaceState(window.history.state, '', window.location.pathname)
  const verifier = takeVerifier()
  if (!code) {
    error.value = 'That sign-in link is incomplete.'
    return
  }
  if (!verifier) {
    error.value = 'That sign-in link was opened in a different browser or tab. '
      + 'Open DSM Negotiator from the shop system again, or sign in with your password.'
    return
  }
  try {
    const session = await exchangeHandoff(code, verifier)
    if (auth.isAuthed && auth.userId && auth.userId !== session.userId) pending.value = session
    else finish(session)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not sign you in.'
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <template v-if="pending">
        <h2 class="title">Switch accounts?</h2>
        <p class="muted">
          You're signed in here as <b>{{ auth.displayName }}</b>. Continue as
          <b>{{ pending.displayName }}</b>
          <template v-if="pending.shops?.find((s) => s.shopId === pending!.shopId)?.shopName">
            at <b>{{ pending.shops.find((s) => s.shopId === pending!.shopId)?.shopName }}</b></template>?
        </p>
        <div class="row">
          <button class="btn btn-primary" type="button" @click="finish(pending!)">Switch</button>
          <button class="btn btn-ghost" type="button" @click="router.replace(redirect)">Stay as {{ auth.displayName }}</button>
        </div>
      </template>
      <template v-else-if="!error">
        <p class="muted state"><span class="spinner"></span> Signing you in…</p>
      </template>
      <template v-else>
        <p class="error-text">{{ error }}</p>
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
.title {
  margin: 0;
  font-size: 20px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.state {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
