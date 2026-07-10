<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Scale } from 'lucide-vue-next'
import { login } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  busy.value = true
  try {
    const res = await login(email.value.trim(), password.value)
    auth.setSession(res)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Sign-in failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <div class="auth-brand">
        <Scale :size="26" />
        <h1>DSM Negotiator</h1>
      </div>
      <p class="muted auth-sub">AI-assisted insurance negotiation for auto-body shops.</p>

      <form @submit.prevent="submit">
        <label class="field">
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>

        <p v-if="error" class="error-text">{{ error }}</p>

        <button class="btn btn-primary auth-submit" type="submit" :disabled="busy">
          <span v-if="busy" class="spinner"></span>
          Sign in
        </button>
      </form>

      <p class="faint auth-alt">
        New here? <RouterLink to="/register">Create a business account</RouterLink>
      </p>
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
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
}
.auth-brand h1 {
  font-size: 20px;
  color: var(--text);
}
.auth-sub {
  margin: 6px 0 20px;
  font-size: 13px;
}
.auth-submit {
  width: 100%;
  justify-content: center;
  margin-top: 4px;
}
.auth-alt {
  margin-top: 16px;
  text-align: center;
}
</style>
