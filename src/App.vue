<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Scale, LogOut, X, HelpCircle } from 'lucide-vue-next'
import { subscriptionNotice } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { startCasesTour } from '@/tour'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}

function replayTour() {
  if (route.name === 'cases') startCasesTour()
  else router.push({ name: 'cases', query: { tour: '1' } })
}

function dismissNotice() {
  subscriptionNotice.value = null
}
</script>

<template>
  <div class="app-shell">
    <header v-if="auth.isAuthed" class="topbar">
      <RouterLink to="/" class="brand">
        <Scale :size="18" class="brand-icon" />
        <span>DSM <strong>Negotiator</strong></span>
      </RouterLink>
      <div class="topbar-right">
        <span class="muted user-name">{{ auth.displayName }}</span>
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
      <button class="btn btn-ghost btn-sm" @click="dismissNotice">
        <X :size="14" />
      </button>
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
}
.brand-icon {
  color: var(--accent);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  font-size: 13px;
}
.sub-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--amber-soft);
  border-bottom: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbc65d;
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
