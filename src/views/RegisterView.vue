<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Scale } from 'lucide-vue-next'
import { register, sendEmailCode, verifyEmail } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const step = ref<1 | 2 | 3>(1)
const busy = ref(false)
const error = ref<string | null>(null)

const email = ref('')
const code = ref('')
const shopName = ref('')
const firstName = ref('')
const lastName = ref('')
const password = ref('')
const acceptTerms = ref(false)

async function run(fn: () => Promise<void>) {
  error.value = null
  busy.value = true
  try {
    await fn()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Something went wrong.'
  } finally {
    busy.value = false
  }
}

function sendCode() {
  run(async () => {
    await sendEmailCode(email.value.trim())
    step.value = 2
  })
}

function verify() {
  run(async () => {
    await verifyEmail(email.value.trim(), code.value.trim())
    step.value = 3
  })
}

function submitRegister() {
  run(async () => {
    const res = await register({
      shopName: shopName.value.trim(),
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      phone: null,
      email: email.value.trim(),
      password: password.value,
      acceptTerms: true,
    })
    auth.setSession(res)
    router.push('/')
  })
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <div class="auth-brand">
        <Scale :size="26" />
        <h1>Create your account</h1>
      </div>

      <ol class="steps">
        <li :class="{ active: step === 1, done: step > 1 }">Email</li>
        <li :class="{ active: step === 2, done: step > 2 }">Verify</li>
        <li :class="{ active: step === 3 }">Details</li>
      </ol>

      <!-- Step 1: email -->
      <form v-if="step === 1" @submit.prevent="sendCode">
        <label class="field">
          <span>Work email</span>
          <input v-model="email" type="email" autocomplete="email" required />
        </label>
        <p class="faint">
          We'll email you a verification code. In local dev the code is printed to the API server
          console — check the terminal running the API.
        </p>
        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="btn btn-primary auth-submit" type="submit" :disabled="busy">
          <span v-if="busy" class="spinner"></span>
          Send code
        </button>
      </form>

      <!-- Step 2: verify code -->
      <form v-else-if="step === 2" @submit.prevent="verify">
        <p class="muted step-note">
          Enter the code sent to <strong>{{ email }}</strong
          >. (Local dev: it's in the API console output.)
        </p>
        <label class="field">
          <span>Verification code</span>
          <input v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" required />
        </label>
        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="btn btn-primary auth-submit" type="submit" :disabled="busy">
          <span v-if="busy" class="spinner"></span>
          Verify email
        </button>
        <button class="btn btn-ghost auth-submit" type="button" :disabled="busy" @click="sendCode">
          Resend code
        </button>
        <button class="btn btn-ghost auth-submit" type="button" @click="step = 1">
          Use a different email
        </button>
      </form>

      <!-- Step 3: details -->
      <form v-else @submit.prevent="submitRegister">
        <label class="field">
          <span>Business name</span>
          <input v-model="shopName" type="text" required />
        </label>
        <div class="form-grid">
          <label class="field">
            <span>First name</span>
            <input v-model="firstName" type="text" autocomplete="given-name" required />
          </label>
          <label class="field">
            <span>Last name</span>
            <input v-model="lastName" type="text" autocomplete="family-name" required />
          </label>
        </div>
        <label class="field">
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="new-password" required minlength="8" />
        </label>

        <label class="terms">
          <input v-model="acceptTerms" type="checkbox" required />
          <span>
            I accept the <strong>Terms &amp; Conditions</strong>. Drafts produced by this tool are
            not legal advice; you review and send all correspondence yourself.
          </span>
        </label>

        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="btn btn-primary auth-submit" type="submit" :disabled="busy || !acceptTerms">
          <span v-if="busy" class="spinner"></span>
          Create account
        </button>
      </form>

      <p class="faint auth-alt">
        Already registered? <RouterLink to="/login">Sign in</RouterLink>
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
  max-width: 440px;
  padding: 28px;
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  margin-bottom: 16px;
}
.auth-brand h1 {
  font-size: 19px;
  color: var(--text);
}
.steps {
  display: flex;
  gap: 8px;
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
}
.steps li {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-faint);
  padding-bottom: 6px;
  border-bottom: 2px solid var(--border-soft);
}
.steps li.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.steps li.done {
  color: var(--green);
  border-bottom-color: var(--green);
}
.step-note {
  margin-bottom: 12px;
  font-size: 13px;
}
.terms {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 4px 0 14px;
  line-height: 1.45;
}
.terms input {
  margin-top: 2px;
  flex-shrink: 0;
}
.auth-submit {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}
.auth-alt {
  margin-top: 16px;
  text-align: center;
}
.faint {
  margin-bottom: 10px;
}
</style>
