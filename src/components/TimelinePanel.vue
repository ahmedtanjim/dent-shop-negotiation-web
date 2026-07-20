<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Check, Send, Inbox, Sparkles, MailPlus, Wand2 } from 'lucide-vue-next'
import { extractPaste, intakeEml, intakeMessage, markSent } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, NegMessage } from '@/api/types'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import TacticBadge from '@/components/TacticBadge.vue'

const props = defineProps<{ detail: CaseDetail }>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

const sorted = computed(() =>
  [...props.detail.messages].sort((a, b) => {
    const ta = a.occurredAt ?? a.createdAt
    const tb = b.occurredAt ?? b.createdAt
    return ta.localeCompare(tb)
  }),
)

/* ---------- intake ---------- */

const showIntake = ref(false)
const intakeTab = ref<'paste' | 'eml'>('paste')
const inRaw = ref('')
const inSubject = ref('')
const inBody = ref('')
const inFromName = ref('')
const inFromEmail = ref('')
const inOccurredAt = ref('')
const emlInput = ref<HTMLInputElement | null>(null)
const intakeBusy = ref(false)
const intakeError = ref<string | null>(null)

/* Smart paste: one box, AI fills the fields, owner confirms. The fields stay editable —
   extraction pre-fills, it never decides. */
const extractBusy = ref(false)
const fieldsVisible = ref(false)
const extractNote = ref<string | null>(null)

async function runExtraction() {
  const text = inRaw.value.trim()
  if (!text) return
  extractBusy.value = true
  intakeError.value = null
  extractNote.value = null
  try {
    const e = await extractPaste(shopId.value, text)
    inFromName.value = e.fromName ?? ''
    inFromEmail.value = e.fromEmail ?? ''
    inSubject.value = e.subject ?? ''
    inBody.value = e.body
    // datetime-local wants local "YYYY-MM-DDTHH:mm"
    inOccurredAt.value = e.sentAt ? toLocalInput(e.sentAt) : ''
    const notes: string[] = []
    if (e.isForward) notes.push('forward unwrapped — sender is the original author')
    if (e.isThread) notes.push('looks like a thread — only the newest message was kept')
    if (!e.sentAt) notes.push('no date found — set it if you know when it arrived')
    extractNote.value = notes.length
      ? `AI-extracted (${notes.join('; ')}). Check the fields before logging.`
      : 'AI-extracted — check the fields before logging.'
  } catch {
    // Degrade, never block: the paste becomes the body and the owner fills the rest.
    inBody.value = text
    extractNote.value = "Couldn't auto-extract — the paste was kept as the body; fill in the rest."
  } finally {
    extractBusy.value = false
    fieldsVisible.value = true
  }
}

function onPasteIntoBox() {
  // Let v-model catch up with the pasted content first.
  setTimeout(() => {
    if (inRaw.value.trim().length >= 40 && !extractBusy.value) runExtraction()
  }, 50)
}

function enterManually() {
  fieldsVisible.value = true
  extractNote.value = null
  if (!inBody.value && inRaw.value.trim()) inBody.value = inRaw.value.trim()
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function submitPaste() {
  intakeBusy.value = true
  intakeError.value = null
  try {
    await intakeMessage(shopId.value, caseId.value, {
      subject: inSubject.value.trim(),
      body: inBody.value,
      fromName: inFromName.value.trim() || null,
      fromEmail: inFromEmail.value.trim() || null,
      occurredAt: inOccurredAt.value ? new Date(inOccurredAt.value).toISOString() : null,
    })
    inRaw.value = ''
    inSubject.value = ''
    inBody.value = ''
    inFromName.value = ''
    inFromEmail.value = ''
    inOccurredAt.value = ''
    fieldsVisible.value = false
    extractNote.value = null
    showIntake.value = false
    emit('refresh')
  } catch (e) {
    intakeError.value = e instanceof ApiError ? e.message : 'Intake failed.'
  } finally {
    intakeBusy.value = false
  }
}

async function submitEml() {
  const file = emlInput.value?.files?.[0]
  if (!file) {
    intakeError.value = 'Choose a .eml file first.'
    return
  }
  intakeBusy.value = true
  intakeError.value = null
  try {
    await intakeEml(shopId.value, caseId.value, file)
    if (emlInput.value) emlInput.value.value = ''
    showIntake.value = false
    emit('refresh')
  } catch (e) {
    intakeError.value = e instanceof ApiError ? e.message : 'Intake failed.'
  } finally {
    intakeBusy.value = false
  }
}

/* ---------- per-message actions ---------- */

const copiedId = ref<string | null>(null)
async function copyMessage(m: NegMessage) {
  try {
    await navigator.clipboard.writeText(`Subject: ${m.subject}\n\n${m.body}`)
    copiedId.value = m.id
    setTimeout(() => {
      if (copiedId.value === m.id) copiedId.value = null
    }, 2000)
  } catch {
    /* clipboard unavailable */
  }
}

const sendingId = ref<string | null>(null)
const actionError = ref<string | null>(null)
async function onMarkSent(m: NegMessage) {
  sendingId.value = m.id
  actionError.value = null
  try {
    await markSent(shopId.value, caseId.value, m.id)
    emit('refresh')
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'Could not mark as sent.'
  } finally {
    sendingId.value = null
  }
}

function fromLine(m: NegMessage): string {
  if (m.fromName && m.fromEmail) return `${m.fromName} <${m.fromEmail}>`
  return m.fromName || m.fromEmail || 'Insurer'
}
</script>

<template>
  <div class="timeline">
    <div class="timeline-head">
      <h2>Correspondence</h2>
      <button class="btn" @click="showIntake = !showIntake">
        <MailPlus :size="15" /> Add insurer email
      </button>
    </div>

    <!-- intake panel -->
    <div v-if="showIntake" class="card intake">
      <div class="tabs">
        <button :class="{ active: intakeTab === 'paste' }" @click="intakeTab = 'paste'">
          Paste email
        </button>
        <button :class="{ active: intakeTab === 'eml' }" @click="intakeTab = 'eml'">
          Upload .eml
        </button>
      </div>

      <form v-if="intakeTab === 'paste'" @submit.prevent="submitPaste">
        <label class="field">
          <span>Paste the email</span>
          <textarea
            v-model="inRaw"
            rows="6"
            placeholder="Paste the whole email straight from Gmail or Outlook — headers, forwards and all. The fields below fill themselves."
            @paste="onPasteIntoBox"
          />
        </label>
        <div class="extract-row">
          <p v-if="extractBusy" class="faint"><span class="spinner"></span> Reading the email…</p>
          <p v-else-if="extractNote" class="extract-note">
            <Wand2 :size="13" class="extract-icon" /> {{ extractNote }}
          </p>
          <p v-else class="faint">
            Fields fill automatically when you paste —
            <a href="#" @click.prevent="enterManually">or enter them manually</a>.
          </p>
          <button
            v-if="inRaw.trim() && !extractBusy"
            class="btn btn-sm"
            type="button"
            @click="runExtraction"
          >
            <Wand2 :size="13" /> Re-extract
          </button>
        </div>

        <div v-if="fieldsVisible" class="form-grid">
          <label class="field">
            <span>From name</span>
            <input v-model="inFromName" type="text" placeholder="Jane Adjuster" />
          </label>
          <label class="field">
            <span>From email</span>
            <input v-model="inFromEmail" type="email" placeholder="jane@insurer.com" />
          </label>
          <label class="field full">
            <span>Subject *</span>
            <input v-model="inSubject" type="text" required />
          </label>
          <label class="field full">
            <span>Body *</span>
            <textarea v-model="inBody" rows="6" required />
          </label>
          <label class="field">
            <span>Received</span>
            <input v-model="inOccurredAt" type="datetime-local" />
          </label>
        </div>
        <p v-if="intakeError" class="error-text">{{ intakeError }}</p>
        <div class="intake-actions">
          <button class="btn btn-ghost" type="button" @click="showIntake = false">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="intakeBusy || !fieldsVisible">
            <span v-if="intakeBusy" class="spinner"></span>
            {{ intakeBusy ? 'Analyzing…' : 'Add & analyze' }}
          </button>
        </div>
      </form>

      <form v-else @submit.prevent="submitEml">
        <label class="field">
          <span>.eml file</span>
          <input ref="emlInput" type="file" accept=".eml,message/rfc822" required />
        </label>
        <p class="faint">
          Export the email from your mail client as .eml — sender, date, subject and body are read
          automatically.
        </p>
        <p v-if="intakeError" class="error-text">{{ intakeError }}</p>
        <div class="intake-actions">
          <button class="btn btn-ghost" type="button" @click="showIntake = false">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="intakeBusy">
            <span v-if="intakeBusy" class="spinner"></span>
            {{ intakeBusy ? 'Analyzing…' : 'Upload & analyze' }}
          </button>
        </div>
      </form>
    </div>

    <p v-if="actionError" class="error-text">{{ actionError }}</p>

    <!-- messages -->
    <div v-if="sorted.length === 0" class="card empty-timeline">
      <Inbox :size="26" class="muted" />
      <p class="muted">
        No correspondence yet. Add the insurer's first email — the assistant reads it, flags the
        tactic, and logs the facts.
      </p>
    </div>

    <article
      v-for="m in sorted"
      :key="m.id"
      class="card msg"
      :class="{ inbound: m.kind === 'Inbound', draft: m.kind === 'Draft', sent: m.kind === 'Sent' }"
    >
      <header class="msg-head">
        <div class="msg-badges">
          <span
            class="pill"
            :class="m.kind === 'Inbound' ? 'pill-gray' : m.kind === 'Sent' ? 'pill-green' : 'pill-violet'"
          >
            {{ m.kind === 'Inbound' ? 'Insurer' : m.kind === 'Draft' ? 'Draft reply' : 'Sent' }}
          </span>
          <TacticBadge v-if="m.kind === 'Inbound' && m.tactic !== 'None'" :tactic="m.tactic" />
          <span v-if="m.tone" class="pill pill-blue">{{ m.tone }}</span>
          <span v-if="m.voice" class="pill pill-gray">
            {{ m.voice === 'Customer' ? 'Customer voice' : 'Shop letter' }}
          </span>
        </div>
        <time class="faint">{{ formatDateTime(m.occurredAt ?? m.createdAt) }}</time>
      </header>

      <p v-if="m.kind === 'Inbound'" class="msg-from faint">From: {{ fromLine(m) }}</p>

      <h3 class="msg-subject">{{ m.subject }}</h3>
      <pre class="msg-body">{{ m.body }}</pre>

      <div v-if="m.analysisSummary" class="ai-read">
        <Sparkles :size="14" class="ai-icon" />
        <div>
          <p class="ai-label">{{ m.kind === 'Inbound' ? 'AI read' : 'Why this draft' }}</p>
          <p>{{ m.analysisSummary }}</p>
        </div>
      </div>

      <footer v-if="m.kind === 'Draft'" class="msg-actions">
        <p class="legal-note">
          Not legal advice — review and edit this draft before sending it yourself.
        </p>
        <div class="msg-buttons">
          <button class="btn btn-sm" @click="copyMessage(m)">
            <Check v-if="copiedId === m.id" :size="14" />
            <Copy v-else :size="14" />
            {{ copiedId === m.id ? 'Copied' : 'Copy' }}
          </button>
          <button class="btn btn-primary btn-sm" :disabled="sendingId === m.id" @click="onMarkSent(m)">
            <span v-if="sendingId === m.id" class="spinner"></span>
            <Send v-else :size="14" />
            Mark as sent
          </button>
        </div>
      </footer>
      <footer v-else-if="m.kind === 'Sent'" class="msg-actions">
        <div></div>
        <div class="msg-buttons">
          <button class="btn btn-sm" @click="copyMessage(m)">
            <Check v-if="copiedId === m.id" :size="14" />
            <Copy v-else :size="14" />
            {{ copiedId === m.id ? 'Copied' : 'Copy' }}
          </button>
        </div>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.timeline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.timeline-head h2 {
  font-size: 17px;
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 14px;
}
.tabs button {
  background: none;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  padding: 6px 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.intake-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.extract-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: -4px 0 12px;
  font-size: 12.5px;
}
.extract-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #7fb0f9;
  font-size: 12.5px;
  font-weight: 600;
}
.extract-icon {
  flex-shrink: 0;
}
.empty-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  text-align: center;
}
.msg {
  border-left: 3px solid var(--border);
}
.msg.inbound {
  border-left-color: var(--text-faint);
}
.msg.draft {
  border-left-color: var(--violet);
}
.msg.sent {
  border-left-color: var(--green);
}
.msg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.msg-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.msg-from {
  margin-bottom: 4px;
}
.msg-subject {
  font-size: 14.5px;
  margin-bottom: 8px;
}
.msg-body {
  font-family: inherit;
  font-size: 13.5px;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  background: var(--bg-raised);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 12px;
  max-height: 340px;
  overflow-y: auto;
}
.ai-read {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  background: var(--accent-soft);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 13px;
}
.ai-icon {
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 2px;
}
.ai-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7fb0f9;
  margin-bottom: 2px;
}
.msg-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.legal-note {
  font-size: 12px;
  font-weight: 600;
  color: #fbc65d;
}
.msg-buttons {
  display: flex;
  gap: 8px;
}
</style>
