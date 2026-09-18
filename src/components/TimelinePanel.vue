<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Directive } from 'vue'
import { Copy, Check, Send, Inbox, Sparkles, MailPlus, Wand2 } from 'lucide-vue-next'
import { createDraft, extractPaste, intakeEml, intakeMessage, markSent } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, NegMessage } from '@/api/types'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import TacticBadge from '@/components/TacticBadge.vue'

const props = defineProps<{
  detail: CaseDetail
  /** true while DraftPanel has a draft in flight — shows the skeleton card here too */
  externalDrafting?: boolean
}>()
const emit = defineEmits<{ refresh: []; counsel: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

// Newest first: the latest email/draft is what the owner acts on, so it sits at the top
// right under the intake box — no scrolling to the bottom to find out what just happened.
const sorted = computed(() =>
  [...props.detail.messages].sort((a, b) => {
    const ta = a.occurredAt ?? a.createdAt
    const tb = b.occurredAt ?? b.createdAt
    return tb.localeCompare(ta)
  }),
)

/* ---------- the docket ----------
   One strict chronological record: №1 is the oldest entry, the top of the page is now.
   The numbers give the sequence a name — "their №4 letter", "our №3 reply" — the way a
   court docket numbers filings. */
const docketNo = computed(() => {
  const map = new Map<string, number>()
  const n = sorted.value.length
  sorted.value.forEach((m, i) => map.set(m.id, n - i))
  return map
})
// The newest entry, when it's an unsent draft, is the one thing to act on.
const latestDraftId = computed(() =>
  sorted.value[0]?.kind === 'Draft' ? sorted.value[0].id : null,
)

function dirLabel(m: NegMessage): string {
  if (m.kind === 'Inbound') return '↓ Received'
  if (m.kind === 'Sent') return '↑ Sent'
  return '✦ AI draft'
}

function whenLine(m: NegMessage): string {
  const when = formatDateTime(m.occurredAt ?? m.createdAt)
  if (m.kind === 'Inbound') return `${when} · from ${fromLine(m)}`
  if (m.kind === 'Sent') {
    const to = props.detail.case.insurerName
    return to ? `${when} · to ${to}` : when
  }
  return `generated ${when} · not sent yet`
}

/* ---------- new-message highlight ---------- */
// Diff message ids across refreshes: whatever just arrived gets a highlight pulse and is
// scrolled into view, so a refresh never silently rearranges the page under the user.
const knownIds = ref<Set<string> | null>(null)
const newIds = ref<Set<string>>(new Set())

watch(
  () => props.detail.messages,
  async (msgs) => {
    if (knownIds.value === null) {
      knownIds.value = new Set(msgs.map((m) => m.id))
      return
    }
    const fresh = msgs.filter((m) => !knownIds.value!.has(m.id))
    if (fresh.length === 0) return
    for (const m of fresh) knownIds.value.add(m.id)
    newIds.value = new Set(fresh.map((m) => m.id))
    await nextTick()
    document
      .getElementById(`msg-${fresh[0].id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setTimeout(() => (newIds.value = new Set()), 2600)
  },
  { immediate: true },
)

/* ---------- autogrow textareas ---------- */
// The email boxes grow with their content — the page scrolls, the textarea never does,
// so the owner can read the whole email while entering it.
function grow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}
const vAutogrow: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    el.style.overflowY = 'hidden'
    grow(el)
    el.addEventListener('input', () => grow(el))
  },
  updated(el) {
    // catches programmatic fills (extraction writing into v-model)
    grow(el)
  },
}

/* ---------- intake ---------- */

const showIntake = ref(false)
const intakeTab = ref<'paste' | 'eml'>('paste')
const inRaw = ref('')
const inSubject = ref('')
const inBody = ref('')
const inFromName = ref('')
const inFromEmail = ref('')
const inOccurredAt = ref('')
const inClaimNumber = ref('')
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
    inClaimNumber.value = e.claimNumber ?? ''
    // datetime-local wants local "YYYY-MM-DDTHH:mm"
    inOccurredAt.value = e.sentAt ? toLocalInput(e.sentAt) : ''
    const notes: string[] = []
    if (e.isForward) notes.push('forward unwrapped — sender is the original author')
    if (e.isThread) notes.push('looks like a thread — only the newest message was kept')
    if (!e.sentAt) notes.push('no date found — set it if you know when it arrived')
    if (e.claimNumber && !props.detail.case.insurerClaimNumber)
      notes.push('claim number found — it will be saved to the case')
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

/* ---------- intake orchestration: save → analyze → auto-draft the shop reply ----------
   Submitting an insurer email is one visible pipeline: the email is saved and analyzed
   (one API call), then the shop-voice reply drafts automatically against it. The stepper
   replaces the form while it runs so the owner sees each stage happen. Customer-voice
   letters stay manual in DraftPanel behind the authorization checkbox. */

type IntakePhase = 'idle' | 'saving' | 'analyzing' | 'drafting' | 'done'
const intakePhase = ref<IntakePhase>('idle')
const PHASE_ORDER: Record<IntakePhase, number> = {
  idle: -1,
  saving: 0,
  analyzing: 1,
  drafting: 2,
  done: 3,
}
const STEPS = [
  { key: 'saving', label: 'Saving email' },
  { key: 'analyzing', label: 'Analyzing tactics' },
  { key: 'drafting', label: 'Drafting your reply' },
] as const

function stepState(step: IntakePhase): 'todo' | 'active' | 'done' {
  const cur = PHASE_ORDER[intakePhase.value]
  const s = PHASE_ORDER[step]
  return cur === s ? 'active' : cur > s ? 'done' : 'todo'
}

const draftFailNote = ref<string | null>(null)
const intakeCard = ref<HTMLElement | null>(null)

async function autoDraftReply(inbound: NegMessage) {
  intakePhase.value = 'drafting'
  try {
    // Tone is omitted: the assistant reads the escalation ladder (including the tactic it
    // just classified on this inbound) and picks the tier the facts support.
    const result = await createDraft(shopId.value, caseId.value, {
      voice: 'Shop',
      customerAuthorized: false,
      replyToMessageId: inbound.id,
      instructions: null,
    })
    if (result.recommendsCounsel) emit('counsel')
  } catch (e) {
    // Non-fatal: the email is already saved — only the automatic draft failed. Surface the
    // server's actual reason (litigation, citation check, no authorization…) instead of a
    // generic note that may point at a panel the litigation state has disabled.
    const reason = e instanceof ApiError ? e.message : null
    draftFailNote.value = reason
      ? `The email was saved, but the automatic reply draft failed: ${reason}`
      : 'The email was saved, but the automatic reply draft failed — use “Draft a reply” on the right to retry.'
  }
  emit('refresh')
}

async function runIntake(intake: () => Promise<NegMessage>): Promise<boolean> {
  intakeBusy.value = true
  intakeError.value = null
  draftFailNote.value = null
  intakePhase.value = 'saving'
  // The tall form collapses into the small stepper, which yanks the page height out from
  // under the user (they were scrolled to the submit button at the bottom of the form).
  // Follow the collapse: jump the stepper — the whole show — into view. Instant, not
  // smooth: the same-frame layout shrink cancels a smooth animation, leaving the user
  // stranded at the (new) bottom of the page.
  await nextTick()
  intakeCard.value?.scrollIntoView({ block: 'start' })
  // Save + analysis are one server call; flip the label once the save has surely landed
  // so the stepper narrates what the server is actually doing.
  const analyzeTimer = setTimeout(() => {
    if (intakePhase.value === 'saving') intakePhase.value = 'analyzing'
  }, 900)
  try {
    const inbound = await intake()
    emit('refresh') // the email appears (highlighted, on top) while the draft is written
    await autoDraftReply(inbound)
    intakePhase.value = 'done'
    setTimeout(() => {
      intakePhase.value = 'idle'
      showIntake.value = false
    }, 1200)
    return true
  } catch (e) {
    intakeError.value = e instanceof ApiError ? e.message : 'Intake failed.'
    intakePhase.value = 'idle'
    return false
  } finally {
    clearTimeout(analyzeTimer)
    intakeBusy.value = false
  }
}

async function submitPaste() {
  const ok = await runIntake(() =>
    intakeMessage(shopId.value, caseId.value, {
      subject: inSubject.value.trim(),
      body: inBody.value,
      fromName: inFromName.value.trim() || null,
      fromEmail: inFromEmail.value.trim() || null,
      occurredAt: inOccurredAt.value ? new Date(inOccurredAt.value).toISOString() : null,
      claimNumber: inClaimNumber.value.trim() || null,
    }),
  )
  if (ok) {
    inRaw.value = ''
    inSubject.value = ''
    inBody.value = ''
    inFromName.value = ''
    inFromEmail.value = ''
    inOccurredAt.value = ''
    inClaimNumber.value = ''
    fieldsVisible.value = false
    extractNote.value = null
  }
}

async function submitEml() {
  const file = emlInput.value?.files?.[0]
  if (!file) {
    intakeError.value = 'Choose a .eml file first.'
    return
  }
  const ok = await runIntake(() => intakeEml(shopId.value, caseId.value, file))
  if (ok && emlInput.value) emlInput.value.value = ''
}

// The skeleton card shows whenever ANY draft is being written — the auto-draft here or a
// manual one from DraftPanel.
const draftingVisible = computed(() => intakePhase.value === 'drafting' || !!props.externalDrafting)

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

/* Long email bodies are clamped with an explicit control to read the whole thing —
   no hidden inner scrolling. */
const LONG_BODY = 700
const expandedIds = ref<Set<string>>(new Set())
function toggleExpand(id: string) {
  const s = new Set(expandedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedIds.value = s
}

function fromLine(m: NegMessage): string {
  if (m.fromName && m.fromEmail) return `${m.fromName} <${m.fromEmail}>`
  return m.fromName || m.fromEmail || 'Insurer'
}
</script>

<template>
  <div class="timeline">
    <div class="seclbl">
      Negotiation <span class="sub">the case record — №1 is where it started, the top is now</span>
    </div>

    <!-- intake trigger: the paste strip -->
    <button v-if="!showIntake" class="paste-strip" @click="showIntake = true">
      <span>New letter from the adjuster? Paste it — the assistant names the tactic and drafts your reply.</span>
      <span class="btn"><MailPlus :size="15" /> Add insurer email</span>
    </button>

    <!-- intake panel -->
    <div v-if="showIntake" ref="intakeCard" class="card intake">
      <!-- pipeline stepper replaces the form while the email is processed -->
      <div v-if="intakePhase !== 'idle'" class="intake-progress">
        <div v-for="s in STEPS" :key="s.key" class="pstep" :class="stepState(s.key)">
          <span class="pstep-marker">
            <Check v-if="stepState(s.key) === 'done'" :size="12" />
            <span v-else-if="stepState(s.key) === 'active'" class="spinner"></span>
            <span v-else class="pstep-dot"></span>
          </span>
          <span>{{ s.label }}</span>
        </div>
        <p v-if="intakePhase === 'done'" class="pstep-done-note">
          Done — your email and the AI's reply draft are at the top of the timeline.
        </p>
      </div>

      <template v-else>
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
              v-autogrow
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
              <textarea v-model="inBody" v-autogrow rows="6" required />
            </label>
            <label class="field">
              <span>Received</span>
              <input v-model="inOccurredAt" type="datetime-local" />
            </label>
            <label class="field">
              <span>Claim #</span>
              <input v-model="inClaimNumber" type="text" placeholder="e.g. 55-1234-X67" />
              <span v-if="inClaimNumber && !detail.case.insurerClaimNumber" class="field-hint">
                Will be saved to the case
              </span>
            </label>
          </div>
          <p v-if="intakeError" class="error-text">{{ intakeError }}</p>
          <div class="intake-actions">
            <button class="btn btn-ghost" type="button" @click="showIntake = false">Cancel</button>
            <button class="btn btn-primary" type="submit" :disabled="intakeBusy || !fieldsVisible">
              Add &amp; draft reply
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
              Upload &amp; draft reply
            </button>
          </div>
        </form>
      </template>
    </div>

    <p v-if="actionError" class="error-text">{{ actionError }}</p>
    <p v-if="draftFailNote" class="warn-note">{{ draftFailNote }}</p>

    <!-- messages -->
    <div v-if="sorted.length === 0 && !draftingVisible" class="card empty-timeline">
      <Inbox :size="26" class="muted" />
      <p class="muted">
        No correspondence yet. Add the insurer's first email — the assistant reads it, flags the
        tactic, and drafts your reply.
      </p>
    </div>

    <div class="docket">
      <!-- a draft is being written: visible placeholder where it will land (top = newest) -->
      <div v-if="draftingVisible" class="entry you latest">
        <span class="node writing"><Sparkles :size="13" /></span>
        <div class="ehead"><span class="dir draft-dir">✦ AI draft</span></div>
        <div class="card msg draft drafting-skeleton">
          <p class="drafting-note">
            <span class="spinner"></span> Writing your reply — it lands right here in a few seconds…
          </p>
          <div class="shimmer-line" style="width: 92%"></div>
          <div class="shimmer-line" style="width: 78%"></div>
          <div class="shimmer-line" style="width: 85%"></div>
        </div>
      </div>

      <article
        v-for="m in sorted"
        :id="`msg-${m.id}`"
        :key="m.id"
        class="entry"
        :class="{
          them: m.kind === 'Inbound',
          you: m.kind !== 'Inbound',
          sentE: m.kind === 'Sent',
          latest: m.id === latestDraftId && !draftingVisible,
        }"
      >
        <span class="node">{{ docketNo.get(m.id) }}</span>
        <div class="ehead">
          <span class="dir">{{ dirLabel(m) }}</span>
          <span class="when">{{ whenLine(m) }}</span>
        </div>

        <div
          class="card msg"
          :class="{
            draft: m.kind === 'Draft',
            sent: m.kind === 'Sent',
            'is-new': newIds.has(m.id),
          }"
        >
          <header
            v-if="m.id === latestDraftId || (m.kind === 'Inbound' && m.tactic !== 'None') || m.voice"
            class="msg-head"
          >
            <div class="msg-badges">
              <span v-if="m.id === latestDraftId" class="latest-pill">⚡ Latest — review &amp; send</span>
              <TacticBadge v-if="m.kind === 'Inbound' && m.tactic !== 'None'" :tactic="m.tactic" />
              <span v-if="m.voice && m.kind !== 'Inbound'" class="pill pill-gray">
                {{ m.voice === 'Customer' ? 'Customer voice' : 'Shop letter' }}
              </span>
            </div>
          </header>

          <h3 class="msg-subject">{{ m.subject }}</h3>
      <pre class="msg-body" :class="{ expanded: expandedIds.has(m.id) }">{{ m.body }}</pre>
      <button
        v-if="m.body.length > LONG_BODY"
        class="btn btn-ghost btn-sm expand-toggle"
        type="button"
        @click="toggleExpand(m.id)"
      >
        {{ expandedIds.has(m.id) ? 'Collapse' : 'Read the full email' }}
      </button>

      <!-- "Why this draft" removed per owner feedback — the rationale stays internal;
           only inbound emails keep their AI read (tactic + suggested next step). -->
      <div v-if="m.analysisSummary && m.kind === 'Inbound'" class="ai-read">
        <Sparkles :size="14" class="ai-icon" />
        <div>
          <p class="ai-label">AI read</p>
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
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.seclbl {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.seclbl .sub {
  font-weight: 400;
  font-size: 12.5px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-faint);
}
.paste-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: none;
  padding: 14px 18px;
  font: inherit;
  font-size: 13.5px;
  color: var(--text-faint);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.paste-strip:hover {
  border-color: var(--accent);
  color: var(--text-muted);
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
  flex-wrap: wrap;
  gap: 10px;
  margin: -4px 0 12px;
  font-size: 12.5px;
}
.extract-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #a3abff;
  font-size: 12.5px;
  font-weight: 600;
}
.extract-icon {
  flex-shrink: 0;
}
.field-hint {
  font-size: 11.5px;
  color: var(--green);
  font-weight: 600;
  margin-top: 3px;
}
/* pipeline stepper */
.intake-progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 4px;
}
.pstep {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-faint);
}
.pstep.active {
  color: var(--text);
}
.pstep.done {
  color: var(--green);
}
.pstep-marker {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pstep-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
}
.pstep-done-note {
  font-size: 12.5px;
  color: var(--green);
  font-weight: 600;
  margin-top: 2px;
}
.warn-note {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--amber);
}
.empty-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  text-align: center;
}
.intake {
  /* clear the sticky topbar when scrolled into view */
  scroll-margin-top: 70px;
  container-type: inline-size;
}
/* datetime-local needs ~210px; two columns in a narrow card would clip it */
@container (max-width: 460px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
/* ---------- the docket spine ---------- */
.docket {
  position: relative;
  padding-left: 42px;
}
.docket::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  background: var(--border);
}
.entry {
  position: relative;
  margin-bottom: 22px;
}
.entry:last-child {
  margin-bottom: 0;
}
.node {
  position: absolute;
  left: -42px;
  top: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--panel);
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  z-index: 1;
}
.entry.you .node {
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  color: var(--accent);
}
.entry.sentE .node {
  border-color: color-mix(in srgb, var(--green) 60%, transparent);
  color: var(--green);
}
.entry.latest .node {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--panel);
}
.node.writing {
  animation: pulse 1.4s infinite;
}
.ehead {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin: 5px 0 8px;
}
.dir {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.entry.you .dir {
  color: var(--accent);
}
.entry.sentE .dir {
  color: var(--green);
}
.when {
  font-size: 12px;
  color: var(--text-faint);
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.latest-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: var(--panel);
  border-radius: 999px;
  padding: 3px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.msg,
.entry {
  scroll-margin-top: 70px;
}
/* the AI draft card: gradient hairline — the one signature flourish */
.msg.draft {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--panel), var(--panel)) padding-box,
    linear-gradient(135deg, rgba(123, 135, 255, 0.55), rgba(74, 219, 192, 0.35)) border-box;
}
.msg.sent {
  border-color: rgba(61, 214, 140, 0.3);
  background:
    linear-gradient(rgba(61, 214, 140, 0.04), rgba(61, 214, 140, 0.04)),
    var(--panel);
}
.msg.is-new {
  animation: msg-flash 2.4s ease;
}
@keyframes msg-flash {
  0% {
    box-shadow: 0 0 0 2px var(--accent);
  }
  60% {
    box-shadow: 0 0 0 2px var(--accent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}
/* drafting skeleton */
.drafting-skeleton {
  border-style: dashed;
}
.drafting-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--violet);
  margin: 6px 0 10px;
}
.shimmer-line {
  height: 11px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: linear-gradient(
    90deg,
    rgba(123, 135, 255, 0.1) 25%,
    rgba(123, 135, 255, 0.25) 50%,
    rgba(123, 135, 255, 0.1) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
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
.msg-badges .pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
.msg-body.expanded {
  max-height: none;
  overflow-y: visible;
}
.expand-toggle {
  margin-top: 6px;
}
.ai-read {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  background: var(--accent-soft);
  border: 1px solid rgba(123, 135, 255, 0.25);
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
  color: #a3abff;
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
  color: var(--amber);
}
.msg-buttons {
  display: flex;
  gap: 8px;
}
</style>
