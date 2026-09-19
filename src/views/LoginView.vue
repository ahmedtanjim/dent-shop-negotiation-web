<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, Moon, Sun } from 'lucide-vue-next'
import { login } from '@/api/auth'
import { ApiError, CRM_URL } from '@/api/client'
import { SIGNUP_URL } from '@/api/handoff'
import { useAuthStore } from '@/stores/auth'
import { theme, toggleTheme } from '@/utils/theme'

/** The sample letter on the left, the form on the right — same shell as the shop
 *  system's login, in this app's own colours. One account for both apps. */

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const show = ref(false)
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
  <div class="auth">
    <aside class="panel">
      <RouterLink to="/" class="lockup">
        <img src="@/assets/dsm-logo.png" class="logo-img" alt="Dent Shop Manager" />
        <span class="words"><span class="name">Dent Shop Manager</span><span class="sub">Negotiator</span></span>
      </RouterLink>

      <figure class="letter" aria-hidden="true">
        <span class="stamp">FIRM · RUNG 3 OF 5</span>
        <div class="meta">
          <span>Re: Claim 24-OH-773192 · 2021 Ford F-150 · Supplement #2</span>
          <span>To: Ms. R. Alvarez, Keystone Mutual · From: Northline Hail &amp; PDR</span>
        </div>
        <p>Ms. Alvarez,</p>
        <p>
          Northline Hail &amp; PDR received your <u>September 12</u> request for a second set of
          photographs. Those photographs were delivered on <u>August 30</u> and again on
          <u>September 5</u>. The case file reflects both deliveries.
        </p>
        <p>
          Ohio Adm. Code 3901-1-54(H)(1) requires Keystone Mutual to either
          <mark>“pay the difference between the written estimate and a higher estimate obtained by the claimant or promptly provide the claimant with the name of at least one repair shop that will make the repairs for the amount of the written estimate.”</mark>
          Neither has happened.
        </p>
        <p>Please confirm by September 26 that Supplement #2, in the amount of $1,140.00, is approved.</p>
      </figure>

      <div class="tagline">
        <b>The insurance company has a legal playbook. Now your shop does too.</b>
        <span>Sample letter. The rule and its quote are real; you send every letter yourself.</span>
      </div>
    </aside>

    <section class="form-col">
      <header class="bar">
        <span />
        <button
          class="btn btn-ghost btn-sm round"
          type="button"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" :size="15" />
          <Moon v-else :size="15" />
        </button>
      </header>

      <form class="login" @submit.prevent="submit">
        <div class="head">
          <h1>Sign in to the Negotiator.</h1>
          <p class="muted">Same email and password as the shop system.</p>
        </div>

        <label class="f">
          <span class="lbl">Email</span>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@yourshop.com" required autofocus />
        </label>
        <label class="f">
          <span class="lbl"><span>Password</span><a class="forgot" :href="`${CRM_URL}/forgot`">Forgot it?</a></span>
          <span class="pw">
            <input v-model="password" :type="show ? 'text' : 'password'" autocomplete="current-password" required />
            <button class="eye" type="button" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
              <EyeOff v-if="show" :size="16" /><Eye v-else :size="16" />
            </button>
          </span>
        </label>

        <p v-if="error" class="error-text">{{ error }}</p>

        <button class="btn btn-primary submit" type="submit" :disabled="busy">
          <span v-if="busy" class="spinner"></span>
          Sign in
        </button>

        <p class="alt muted">
          New here? <a :href="SIGNUP_URL">Create your shop</a>
          <span class="faint">· $1,999/yr, shop system included</span>
        </p>
        <p class="cross muted">Already inside the shop system? Click "Total Loss Portal" in its top bar, no password needed.</p>
      </form>
    </section>
  </div>
</template>

<style scoped>
.auth {
  flex: 1;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  min-height: 100vh;
}

/* ---------- the letter panel ---------- */
.panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 44px 36px;
  background: var(--panel);
  border-right: 1px solid var(--border-soft);
}
.lockup {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  align-self: flex-start;
}
.lockup:hover {
  text-decoration: none;
}
.logo-img {
  height: 34px;
  width: 34px;
  object-fit: contain;
}
.words {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.name {
  font-weight: 600;
  font-size: 15px;
}
.sub {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.letter {
  position: absolute;
  left: 44px;
  right: -120px;
  top: 124px;
  margin: 0;
  background: #ffffff;
  border: 1px solid #d6d9e0;
  border-radius: 4px;
  padding: 34px 40px 30px;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 14.5px;
  line-height: 1.6;
  color: #15171c;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.9);
  transform: rotate(-1.2deg);
  transform-origin: bottom left;
}
.letter p {
  margin: 0;
}
.letter p:first-of-type {
  margin-top: 6px;
}
.letter u {
  text-decoration-color: #c8281e;
  text-underline-offset: 3px;
}
.letter mark {
  background: #fff2a8;
  color: #15171c;
  padding: 0 2px;
}
.stamp {
  position: absolute;
  top: 20px;
  right: 150px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #c8281e;
  border: 1.5px solid #c8281e;
  padding: 6px 9px;
  border-radius: 3px;
  transform: rotate(-4deg);
}
.meta {
  font-family: var(--font);
  font-size: 12px;
  color: #6f7581;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tagline {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 30em;
}
.tagline b {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.tagline span {
  font-size: 13px;
  color: var(--text-muted);
}

/* ---------- the form ---------- */
.form-col {
  display: flex;
  flex-direction: column;
  padding: 18px 20px 36px;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
}
.round {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text);
}
.login {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  gap: 18px;
  padding: 24px 0;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 4px;
}
h1 {
  font-size: 34px;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.head p {
  font-size: 15px;
}
.f {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lbl {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
.forgot {
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.forgot:hover {
  color: var(--text);
}
.f input {
  height: 52px;
  border-radius: 10px;
  padding: 0 16px;
  font-size: 16px;
  border-width: 1.5px;
}
.pw {
  position: relative;
  display: flex;
}
.pw input {
  width: 100%;
  padding-right: 44px;
}
.eye {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.eye:hover {
  color: var(--text);
}
.submit {
  height: 54px;
  justify-content: center;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  margin-top: 4px;
}
.alt {
  text-align: center;
  font-size: 14px;
  margin: 0;
}
.alt a {
  color: var(--text);
  font-weight: 600;
}
.faint {
  color: var(--text-faint);
}
.cross {
  margin: 8px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
  font-size: 12.5px;
  text-align: center;
  line-height: 1.5;
}

/* ---------- phones: the letter becomes a strip ---------- */
@media (max-width: 900px) {
  .auth {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .panel {
    height: 200px;
    padding: 18px 20px;
    border-right: 0;
    border-bottom: 1px solid var(--border-soft);
  }
  .logo-img {
    height: 28px;
    width: 28px;
  }
  .name {
    font-size: 14px;
  }
  .letter {
    left: 150px;
    right: -120px;
    top: 54px;
    padding: 18px 20px;
    font-size: 11px;
    gap: 6px;
    transform: rotate(-2deg);
  }
  .meta {
    display: none;
  }
  .stamp {
    top: 8px;
    right: 130px;
    font-size: 8px;
    padding: 3px 5px;
    border-width: 1px;
  }
  .tagline {
    max-width: 120px;
  }
  .tagline b {
    font-size: 14px;
  }
  .tagline span {
    display: none;
  }
  h1 {
    font-size: 26px;
  }
  .form-col {
    padding: 8px 20px 28px;
  }
}
</style>
