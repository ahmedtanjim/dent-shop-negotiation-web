<script setup lang="ts">
// "Help & support" — mounted by App.vue while helpOpen is set (utils/help). Builds the
// diagnostics we need into the user's OWN email draft (mailto:) or clipboard; nothing is
// sent by the app, and a password is never part of it (utils/supportReport).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Check, Copy, LifeBuoy, Mail, X } from 'lucide-vue-next'
import { getMe } from '@/api/auth'
import { supportEmail } from '@/api/support'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { useEscapeToClose } from '@/utils/escapeToClose'
import { copyText, supportDetails, supportMailto, supportSubject, type SupportInfo } from '@/utils/supportReport'

const emit = defineEmits<{ close: [] }>()
useEscapeToClose(() => emit('close'))

const route = useRoute()
const auth = useAuthStore()
const ent = useEntitlementStore()

const openedAt = new Date()
const email = ref<string | null>(null)
const copied = ref<'ok' | 'fail' | null>(null)
let copiedTimer: number | undefined

const roleLabels: Record<string, string> = { SalesRep: 'Sales rep', FrontDesk: 'Front desk' }

const info = computed<SupportInfo>(() => {
  const status = ent.entitlement?.status
  return {
    signedIn: auth.isAuthed,
    name: auth.displayName,
    email: email.value,
    role: auth.role ? (roleLabels[auth.role] ?? auth.role) : null,
    shopName: auth.shopName,
    shopId: auth.shopId,
    plan: ent.tier ? `${ent.tier}${status ? ` (${status})` : ''}` : null,
    app: 'Negotiator',
    version: import.meta.env.VITE_RELEASE?.trim().slice(0, 12) || 'dev',
    page: route.path,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}×${window.innerHeight}`,
    at: openedAt,
  }
})
const subject = computed(() => supportSubject('DSM Negotiator', auth.isAuthed ? auth.shopName : null))
const mailto = computed(() => supportMailto(supportEmail.value, subject.value, info.value))

onMounted(() => {
  // The session keeps no email; read it from the account (fine if that fails).
  if (auth.isAuthed) {
    getMe()
      .then((me) => {
        if (me?.email) email.value = me.email
      })
      .catch(() => {})
  }
})
onBeforeUnmount(() => window.clearTimeout(copiedTimer))

async function copy() {
  copied.value = (await copyText(supportDetails(info.value))) ? 'ok' : 'fail'
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = null), 2500)
}
</script>

<template>
  <div class="modal-backdrop" @mousedown.self="emit('close')">
    <div class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="modal-head">
        <h2 id="help-title"><LifeBuoy :size="18" class="hicon" /> Help &amp; support</h2>
        <button class="btn btn-ghost btn-sm" aria-label="Close" @click="emit('close')"><X :size="16" /></button>
      </div>

      <p class="lead muted">
        Email us and we’ll get back to you. Include a screenshot if you can.
        <strong>We’ll never ask for your password.</strong>
      </p>

      <div class="actions">
        <a class="btn btn-primary" :href="mailto"><Mail :size="15" /> Email support</a>
        <button class="btn" type="button" @click="copy">
          <Check v-if="copied === 'ok'" :size="15" />
          <Copy v-else :size="15" />
          {{ copied === 'ok' ? 'Copied' : 'Copy support info' }}
        </button>
      </div>
      <p v-if="copied === 'fail'" class="error-text" role="alert">Couldn’t copy. Select the details below and copy them instead.</p>

      <p class="addr muted">Or write to <a :href="`mailto:${supportEmail}`">{{ supportEmail }}</a></p>

      <details class="peek">
        <summary class="muted">What gets included</summary>
        <pre>{{ supportDetails(info) }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
.help-modal {
  max-width: 460px;
}
.modal-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  margin: 0;
}
.hicon {
  color: var(--accent);
}
.lead {
  font-size: 13.5px;
  line-height: 1.5;
  margin: 0 0 14px;
}
.lead strong {
  color: var(--text);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.actions .btn {
  flex: 1 1 160px;
  justify-content: center;
  min-height: 40px;
  text-decoration: none;
}
.addr {
  font-size: 13px;
  margin: 14px 0 0;
  word-break: break-all;
}
.peek {
  margin-top: 10px;
  font-size: 12.5px;
}
.peek summary {
  cursor: pointer;
}
.peek pre {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--panel-soft);
  color: var(--text);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  font-family: var(--mono);
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: all;
}
</style>
