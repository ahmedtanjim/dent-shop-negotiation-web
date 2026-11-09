<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PenLine, Sparkles } from 'lucide-vue-next'
import { deleteStandingAnswer, getDraftQuestions, getStandingAnswers, streamDraft } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, DraftAnswer, DraftQuestion, DraftRequest, DraftVoice, StandingAnswer } from '@/api/types'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useCaseReadOnly } from '@/utils/readOnly'
import { draftPreview } from '@/utils/draftPreview'
import DraftQuestions from '@/components/DraftQuestions.vue'

const props = defineProps<{ detail: CaseDetail }>()
const emit = defineEmits<{
  refresh: []
  counsel: []
  /** mirrors the busy state so the timeline can show a "drafting" skeleton card */
  drafting: [busy: boolean]
}>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)
/** The shop's plan ended: no new drafts (the letters already written stay readable). */
const readOnly = useCaseReadOnly()

const standing = ref<StandingAnswer[]>([])

async function loadStanding() {
  try {
    standing.value = await getStandingAnswers(shopId.value)
  } catch {
    standing.value = [] // an older API: nothing to manage
  }
}
watch(shopId, loadStanding, { immediate: true })

async function removeStanding(id: string) {
  error.value = null
  try {
    await deleteStandingAnswer(shopId.value, id)
    standing.value = standing.value.filter((a) => a.id !== id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'That answer could not be removed. Try again.'
  }
}

const voice = ref<DraftVoice>('Shop')
const customerAuthorized = ref(false)
const instructions = ref('')
const replyToMessageId = ref('')

const inboundMessages = computed(() =>
  props.detail.messages
    .filter((m) => m.kind === 'Inbound')
    .sort((a, b) => (b.occurredAt ?? b.createdAt).localeCompare(a.occurredAt ?? a.createdAt)),
)

// Default to replying to the newest insurer email — the common case. Tracks new arrivals;
// a deliberate "Latest context" pick survives refreshes of the same message list.
watch(
  () => inboundMessages.value[0]?.id,
  (newest, previous) => {
    if (!newest) return
    if (!replyToMessageId.value || replyToMessageId.value === previous) {
      replyToMessageId.value = newest
    }
  },
  { immediate: true },
)

const isLitigation = computed(() => props.detail.case.status === 'Litigation')

const busy = ref(false)
/** 'checking' = asking the server what the letter needs; 'drafting' = writing it */
const step = ref<'checking' | 'drafting' | null>(null)
const error = ref<string | null>(null)
/** Pre-draft questions waiting for the owner; the request they belong to rides along. */
const pending = ref<{ questions: DraftQuestion[]; request: DraftRequest } | null>(null)

watch(voice, (v) => {
  if (v === 'Shop') customerAuthorized.value = false
})

const canSubmit = computed(() => {
  if (busy.value || isLitigation.value || readOnly.value) return false
  if (voice.value === 'Customer' && !customerAuthorized.value) return false
  return true
})

// No tone picker: tone is omitted so the assistant reads the escalation ladder and picks
// the tier the facts support. Its choice comes back as the badge on the draft card.
// Two steps (owner decision 2026-10-03): first the assistant asks up to 3 questions about
// facts the letter needs, then it writes a letter with no [BLANKS] in it.
async function generate() {
  if (readOnly.value) return
  const request: DraftRequest = {
    voice: voice.value,
    customerAuthorized: customerAuthorized.value,
    replyToMessageId: replyToMessageId.value || null,
    instructions: instructions.value.trim() || null,
  }
  busy.value = true
  step.value = 'checking'
  error.value = null
  pending.value = null
  let questions: DraftQuestion[] = []
  try {
    questions = await getDraftQuestions(shopId.value, caseId.value, request)
  } catch (e) {
    // A refusal (litigation, no authorization, usage cap) is the draft's refusal too — show
    // it. Anything else (an older API, a hiccup) just drafts without questions.
    if (e instanceof ApiError && [400, 402, 403, 429].includes(e.status)) {
      error.value = e.message
      busy.value = false
      step.value = null
      return
    }
  }
  if (questions.length) {
    pending.value = { questions, request }
    busy.value = false
    step.value = null
    return
  }
  await write(request, [])
}

async function write(request: DraftRequest, answers: DraftAnswer[]) {
  if (readOnly.value) return
  busy.value = true
  step.value = 'drafting'
  emit('drafting', true)
  error.value = null
  try {
    draftPreview.value = ''
    const result = await streamDraft(shopId.value, caseId.value, { ...request, answers }, (text) => {
      draftPreview.value += text
    })
    instructions.value = ''
    pending.value = null
    if (result.recommendsCounsel) emit('counsel')
    if (answers.some((a) => a.always)) void loadStanding()
    emit('refresh')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Draft generation failed.'
  } finally {
    draftPreview.value = ''
    busy.value = false
    step.value = null
    emit('drafting', false)
  }
}

function answer(answers: DraftAnswer[]) {
  if (pending.value) void write(pending.value.request, answers)
}
</script>

<template>
  <section class="card draft-panel">
    <div class="panel-title"><PenLine :size="13" class="title-icon" /> Generate new correspondence</div>

    <div v-if="isLitigation" class="notice-amber">
      This case is in litigation — the assistant no longer drafts correspondence. Your attorney
      handles communication from here.
    </div>

    <div v-else-if="readOnly" class="notice-amber">
      Your DSM Negotiator plan has ended, so new drafts are off. The letters on this case stay
      here to read and copy.
      <RouterLink to="/upgrade">Renew to draft again</RouterLink>
    </div>

    <template v-else>
      <div v-if="!detail.hasPlaybook" class="notice-amber no-playbook">
        No attorney-reviewed citations for
        <strong>{{ detail.case.state ?? 'this case’s state' }}</strong> yet — drafts will argue
        from your documented facts but won’t cite statutes. State law coverage is expanding.
      </div>

      <div v-if="detail.hasPlaybook && detail.playbookPendingReview" class="notice-amber no-playbook">
        <strong>{{ detail.case.state }}</strong> citations were checked against the official text
        but haven't had attorney review yet. Read them before you send.
      </div>

      <details v-if="standing.length" class="standing">
        <summary>Saved for every car ({{ standing.length }})</summary>
        <ul>
          <li v-for="a in standing" :key="a.id">
            <span>{{ a.question }} <strong>{{ a.answer }}</strong></span>
            <button type="button" class="btn btn-ghost btn-sm" :disabled="readOnly" @click="removeStanding(a.id)">
              Remove
            </button>
          </li>
        </ul>
      </details>

      <!-- the owner's copy, verbatim (2026-08-24 feedback) -->
      <div class="auto-tone">
        <Sparkles :size="13" class="auto-tone-icon" />
        <span
          >Use the prebuilt messages in Documents or generate new correspondence for the claim —
          reply as the shop, or send your customer the response they need to tell their insurance
          representative.</span
        >
      </div>

      <!-- voice -->
      <div class="group-label">Voice</div>
      <div class="voice-options">
        <label class="voice-option" :class="{ selected: voice === 'Shop' }">
          <input v-model="voice" type="radio" name="voice" value="Shop" />
          <span>Shop letter</span>
        </label>
        <label class="voice-option" :class="{ selected: voice === 'Customer' }">
          <input v-model="voice" type="radio" name="voice" value="Customer" />
          <span>Customer-voice letter</span>
        </label>
      </div>
      <label v-if="voice === 'Customer'" class="authz">
        <input v-model="customerAuthorized" type="checkbox" />
        <span>The customer authorized a letter in their name <em>(required)</em></span>
      </label>

      <!-- reply to -->
      <label v-if="inboundMessages.length" class="field reply-to">
        <span>Replying to (optional)</span>
        <select v-model="replyToMessageId">
          <option value="">Latest context — no specific message</option>
          <option v-for="m in inboundMessages" :key="m.id" :value="m.id">
            {{ formatDateTime(m.occurredAt ?? m.createdAt) }} — {{ m.subject }}
          </option>
        </select>
      </label>

      <!-- instructions -->
      <label class="field">
        <span>Instructions (optional)</span>
        <textarea
          v-model="instructions"
          rows="3"
          placeholder="Anything the draft must cover, e.g. 'Cite the 12 days of storage accruing since June 20.'"
        />
      </label>

      <p v-if="error" class="error-text">{{ error }}</p>

      <DraftQuestions
        v-if="pending"
        :key="pending.questions.map((q) => q.question).join('|')"
        :questions="pending.questions"
        :busy="busy"
        class="questions"
        @submit="answer"
      />
      <template v-else>
        <button class="btn btn-primary generate" :disabled="!canSubmit" @click="generate">
          <span v-if="busy" class="spinner"></span>
          {{
            step === 'checking'
              ? 'Checking what the letter needs…'
              : busy
                ? 'Drafting…'
                : 'Generate draft'
          }}
        </button>
      </template>
      <button v-if="pending && !busy" class="btn btn-ghost btn-sm cancel" @click="pending = null">
        Cancel
      </button>

      <p class="faint disclaimer">
        Drafts are not legal advice. You review, edit, and send all correspondence yourself.
      </p>
    </template>
  </section>
</template>

<style scoped>
.draft-panel {
  display: flex;
  flex-direction: column;
}
.title-icon {
  vertical-align: -2px;
  margin-right: 4px;
}
.group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 8px 0 6px;
}
.auto-tone {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: var(--bg-raised);
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.auto-tone-icon {
  color: var(--violet);
  flex-shrink: 0;
  margin-top: 2px;
}
.voice-options {
  display: flex;
  gap: 6px;
}
.voice-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  cursor: pointer;
  background: var(--bg-raised);
  font-size: 13px;
  font-weight: 600;
}
.voice-option.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.authz {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 8px;
  line-height: 1.4;
}
.authz input {
  margin-top: 2px;
}
.authz em {
  color: var(--amber);
  font-style: normal;
}
.reply-to {
  margin-top: 12px;
}
.field {
  margin-top: 4px;
}
.no-playbook {
  margin-bottom: 8px;
  font-size: 12.5px;
  line-height: 1.45;
}
.standing {
  margin-bottom: 8px;
  font-size: 12.5px;
  line-height: 1.45;
}
.standing summary {
  cursor: pointer;
  font-weight: 600;
}
.standing ul {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
}
.standing li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
}
.generate {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}
.questions {
  margin-top: 8px;
}
.cancel {
  align-self: center;
  margin-top: 6px;
}
.disclaimer {
  margin-top: 10px;
  text-align: center;
}
</style>
