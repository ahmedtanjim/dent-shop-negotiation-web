<script setup lang="ts">
import { watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut, X, HelpCircle, Sun, Moon } from 'lucide-vue-next'
import { aiCapNotice, aiPlanRequired, CRM_URL, subscriptionNotice } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { goToCrm } from '@/api/handoff'
import { theme, toggleTheme } from '@/utils/theme'
import { startCasesTour, startWorkspaceTour } from '@/tour'

const auth = useAuthStore()
const ent = useEntitlementStore()
const router = useRouter()
const route = useRoute()

function logout() {
  auth.logout()
  ent.reset()
  router.push({ name: 'login' })
}

// A 402 `ai_required` mid-session (plan lapsed, or an older tab): re-read the plan and
// open the paywall for the page the user was on, instead of leaving a red line behind.
watch(aiPlanRequired, (hit) => {
  if (!hit) return
  aiPlanRequired.value = false
  if (auth.shopId) void ent.load(auth.shopId, true)
  if (route.name !== 'paywall') {
    router.push({ name: 'paywall', query: route.fullPath !== '/' ? { redirect: route.fullPath } : {} })
  }
})

function replayTour() {
  // Each screen has its own tour — replay the one for where the user actually is.
  if (route.name === 'case') startWorkspaceTour()
  else if (route.name === 'cases') startCasesTour()
  else router.push({ name: 'cases', query: { tour: '1' } })
}

function dismissNotice() {
  subscriptionNotice.value = null
}

const capResets = computed(() => {
  const iso = aiCapNotice.value?.resetsAt
  if (!iso) return null
  const d = new Date(iso)
  return aiCapNotice.value?.scope === 'monthly'
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
})
</script>

<template>
  <div class="app-shell">
    <header v-if="auth.isAuthed" class="topbar">
      <RouterLink to="/" class="brand">
        <img src="@/assets/dsm-logo.png" class="brand-logo" alt="Dent Shop Manager" />
        <span class="brand-word">
          Dent Shop Manager
          <span class="brand-sub"><strong>Negotiator</strong></span>
        </span>
      </RouterLink>
      <div class="topbar-right">
        <span class="muted user-name">{{ auth.displayName }}</span>
        <button
          class="btn btn-ghost btn-sm"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" :size="15" />
          <Moon v-else :size="15" />
        </button>
        <button
          class="btn btn-ghost btn-sm"
          data-tour="help"
          title="Replay the walkthrough"
          @click="replayTour"
        >
          <HelpCircle :size="15" />
        </button>
        <button class="btn btn-ghost btn-sm" @click="logout">
          <LogOut :size="14" /> Sign out
        </button>
      </div>
    </header>

    <div v-if="subscriptionNotice" class="sub-banner">
      <span>{{ subscriptionNotice }}</span>
      <span class="banner-actions">
        <a class="btn btn-ghost btn-sm" :href="`${CRM_URL}/billing`" target="_blank" rel="noopener" @click.prevent="goToCrm('/billing', true)">
          Go to Billing
        </a>
        <button class="btn btn-ghost btn-sm" @click="dismissNotice">
          <X :size="14" />
        </button>
      </span>
    </div>

    <div v-if="aiCapNotice" class="sub-banner" role="status">
      <span>{{ aiCapNotice.message }}<template v-if="capResets"> Resets {{ aiCapNotice.scope === 'monthly' ? 'on' : 'at' }} {{ capResets }}.</template></span>
      <span class="banner-actions">
        <button class="btn btn-ghost btn-sm" @click="aiCapNotice = null">
          <X :size="14" />
        </button>
      </span>
    </div>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 10px 24px;
  background: var(--bg-raised);
  border-bottom: 1px solid var(--border-soft);
  position: sticky;
  top: 0;
  z-index: 20;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 15px;
  letter-spacing: 0.01em;
}
.brand:hover {
  text-decoration: none;
}
.brand strong {
  font-weight: 700;
  color: var(--accent);
}
.brand-logo {
  height: 34px;
  width: auto;
}
.brand-word {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.brand-sub {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  font-size: 13px;
}
.banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.sub-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  background: var(--amber-soft);
  border-bottom: 1px solid rgba(245, 158, 11, 0.4);
  color: var(--amber);
  padding: 8px 24px;
  font-size: 13.5px;
  font-weight: 600;
}
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
