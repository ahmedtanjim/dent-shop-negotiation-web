<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createHandoff } from '@/api/auth'
import { CRM_URL } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { isChallenge } from '@/utils/pkce'

/** Step 2 of a sign-in carried over TO the shop system (/auth/handoff/out?challenge=…&next=…):
 *  the shop system's tab sent the hash of a verifier it keeps; mint a code bound to it and send
 *  the code back to its /auth/handoff. Arriving straight from the shop system it continues on
 *  its own; arriving from anywhere else (a link in an email, another site) it asks first, so
 *  nothing is minted for this account without the person here choosing it. */

const route = useRoute()
const auth = useAuthStore()
const confirm = ref(false)
const error = ref<string | null>(null)

const challenge = route.query.challenge
const nextRaw = typeof route.query.next === 'string' ? route.query.next : '/'
// The shop system validates its own path too; never let this become another site.
const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.startsWith('/\\') ? nextRaw : '/'

function fromCrm(): boolean {
  try {
    return !!document.referrer && new URL(document.referrer).origin === new URL(CRM_URL).origin
  } catch {
    return false
  }
}

async function go() {
  confirm.value = false
  try {
    const { code } = await createHandoff(auth.shopId!, challenge as string)
    window.location.replace(`${CRM_URL}/auth/handoff?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`)
  } catch {
    window.location.replace(`${CRM_URL}${next}`) // they sign in there
  }
}

onMounted(() => {
  if (!auth.isAuthed || !isChallenge(challenge)) {
    window.location.replace(`${CRM_URL}${next}`)
    return
  }
  if (fromCrm()) void go()
  else confirm.value = true
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <template v-if="confirm">
        <h2 class="title">Open the shop system?</h2>
        <p class="muted">
          You'll be signed in there as <b>{{ auth.displayName }}</b>
          <template v-if="auth.shopName"> at <b>{{ auth.shopName }}</b></template>.
        </p>
        <div class="row">
          <button class="btn btn-primary" type="button" @click="go">Continue</button>
          <RouterLink class="btn btn-ghost" :to="{ name: 'cases' }">Stay here</RouterLink>
        </div>
      </template>
      <p v-else-if="!error" class="muted state"><span class="spinner"></span> Opening the shop system…</p>
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
  gap: 8px;
}
.state {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
