<script setup lang="ts">
import { watch, computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut, X, HelpCircle, Sun, Moon, Compass, LifeBuoy } from 'lucide-vue-next'
import { aiCapNotice, aiPlanRequired, CRM_URL, negotiatorAccessDenied, subscriptionNotice } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { goToCrm } from '@/api/handoff'
import { theme, toggleTheme } from '@/utils/theme'
import { startCasesTour, startWorkspaceTour } from '@/tour'
import { setSentryTags } from '@/analytics/sentry'
import { helpOpen, openHelp } from '@/utils/help'
import HelpSupportModal from '@/components/HelpSupportModal.vue'
import { switchShop } from '@/api/auth'
import { startSessionKeeper } from '@/utils/session'

const auth = useAuthStore()
const ent = useEntitlementStore()
const router = useRouter()
const route = useRoute()

// On more than one shop: switch here instead of landing on the paywall of the wrong one (#18).
const switching = ref(false)
const switchError = ref<string | null>(null)
async function onSwitchShop(e: Event) {
  const sel = e.target as HTMLSelectElement
  const to = sel.value
  if (!to || to === auth.shopId) return
  switching.value = true
  switchError.value = null
  try {
    auth.setSession(await switchShop(to))
    ent.reset()
    window.location.assign('/cases')   // a full load drops every per-shop cache
  } catch (err) {
    switching.value = false
    sel.value = auth.shopId ?? ''
    switchError.value = err instanceof Error ? err.message : "Couldn't switch shops."
  }
}

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
  // invalidate() marks the cached plan stale synchronously, so the router guard below
  // waits for the fresh answer instead of bouncing the paywall back (NEG-7).
  if (auth.shopId) void ent.invalidate(auth.shopId)
  if (route.name !== 'paywall') {
    router.push({ name: 'paywall', query: route.fullPath !== '/cases' ? { redirect: route.fullPath } : {} })
  }
})

// Error reports carry the role and plan status only — never who the user is.
watch(
  () => [auth.isAuthed ? auth.role : null, ent.entitlement?.status ?? null] as const,
  ([role, plan]) => setSentryTags({ role, plan }),
  { immediate: true },
)

// The (?) button opens a small menu: replay the walkthrough, or Help & support.
const helpMenu = ref(false)
function onOutside(e: MouseEvent) {
  if (helpMenu.value && !(e.target as HTMLElement).closest('.helpwrap')) helpMenu.value = false
}
function onMenuKey(e: KeyboardEvent) {
  if (e.key === 'Escape') helpMenu.value = false
}
onMounted(() => {
  startSessionKeeper()
  document.addEventListener('click', onOutside)
  window.addEventListener('keydown', onMenuKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onOutside)
  window.removeEventListener('keydown', onMenuKey)
})
function pickHelp(which: 'tour' | 'support') {
  helpMenu.value = false
  if (which === 'tour') replayTour()
  else openHelp()
}

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
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
})
</script>

<template>
  <div class="app-shell">
    <header v-if="auth.isAuthed" class="topbar">
      <RouterLink to="/" class="brand">
        <img src="@/assets/dsm-logo.webp" class="brand-logo" alt="Dent Shop Manager" width="142" height="128" />
        <span class="brand-word">
          Dent Shop Manager
          <span class="brand-sub"><strong>Negotiator</strong></span>
        </span>
      </RouterLink>
      <div class="topbar-right">
        <select
          v-if="auth.shops.length > 1"
          class="shop-pick"
          :value="auth.shopId ?? ''"
          :disabled="switching"
          title="Switch shop"
          aria-label="Switch shop"
          @change="onSwitchShop"
        >
          <option v-for="s in auth.shops" :key="s.shopId" :value="s.shopId">{{ s.shopName }}</option>
        </select>
        <span v-if="switchError" class="muted user-name" role="alert">{{ switchError }}</span>
        <span class="muted user-name">{{ auth.displayName }}</span>
        <button
          class="btn btn-ghost btn-sm"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" :size="15" />
          <Moon v-else :size="15" />
        </button>
        <span class="helpwrap">
          <button
            class="btn btn-ghost btn-sm"
            data-tour="help"
            title="Help"
            aria-label="Help"
            aria-haspopup="menu"
            :aria-expanded="helpMenu"
            @click="helpMenu = !helpMenu"
          >
            <HelpCircle :size="15" />
          </button>
          <div v-if="helpMenu" class="helpmenu" role="menu" aria-label="Help">
            <button class="hm-item" role="menuitem" @click="pickHelp('tour')">
              <Compass :size="15" /> Replay the walkthrough
            </button>
            <button class="hm-item" role="menuitem" @click="pickHelp('support')">
              <LifeBuoy :size="15" /> Help &amp; support
            </button>
          </div>
        </span>
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
      <!-- Field staff (or an admin without financials): the API refuses every case read.
           Say why and where their letters are, instead of a page of red errors. -->
      <section v-if="negotiatorAccessDenied" class="no-access">
        <h1>DSM Negotiator is for owners and managers</h1>
        <p>{{ negotiatorAccessDenied }}</p>
        <p class="muted">Open a car in Dent Shop Manager and pick its <b>Letters</b> tab to copy the letters to the adjuster.</p>
        <div class="no-access-actions">
          <a class="btn btn-primary" :href="`${CRM_URL}/claims`" @click.prevent="goToCrm('/claims', false)">Go to my cars</a>
          <button class="btn btn-ghost" type="button" @click="logout">Sign out</button>
        </div>
      </section>
      <RouterView v-else />
    </main>

    <HelpSupportModal v-if="helpOpen" @close="helpOpen = false" />
  </div>
</template>

<style scoped>
.no-access { max-width: 520px; margin: 12vh auto 0; padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
.no-access h1 { font-size: 22px; margin: 0; }
.no-access p { margin: 0; line-height: 1.5; }
.no-access-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
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
.shop-pick {
  max-width: 220px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  padding: 5px 8px;
  font: inherit;
  font-size: 13px;
}
.user-name {
  font-size: 13px;
}
.helpwrap {
  position: relative;
  display: inline-flex;
}
.helpmenu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 220px;
  padding: 5px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
}
.hm-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.hm-item:hover {
  background: var(--panel-soft);
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
/* Touch: top-bar icon buttons get a 44 px target (they were 37×25). */
@media (max-width: 640px), (pointer: coarse) {
  .topbar-right .btn {
    min-height: 44px;
    min-width: 44px;
    justify-content: center;
  }
}
</style>
