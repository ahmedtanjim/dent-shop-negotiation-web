<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeHandoff } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'

/** Landing for a sign-in carried over from the shop system: /auth/handoff?code=…&redirect=…
 *  The code is single-use and lives 60 seconds; on success the session is stored and the
 *  user lands where they were headed. */

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ent = useEntitlementStore()
const error = ref<string | null>(null)

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const redirect =
    typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'
  if (!code) {
    error.value = 'That sign-in link is incomplete.'
    return
  }
  try {
    auth.setSession(await exchangeHandoff(code))
    ent.reset()
    router.replace(redirect)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not sign you in.'
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <template v-if="!error">
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
.state {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
