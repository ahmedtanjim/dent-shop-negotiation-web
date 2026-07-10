<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PenLine, AlertTriangle } from 'lucide-vue-next'
import { createDraft } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, DraftTone, DraftVoice } from '@/api/types'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ detail: CaseDetail }>()
const emit = defineEmits<{
  refresh: []
  counsel: []
}>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

const TONES: { value: DraftTone; label: string; desc: string }[] = [
  {
    value: 'Cooperative',
    label: 'Cooperative',
    desc: 'Professional and collaborative — keeps the adjuster on side.',
  },
  {
    value: 'Firm',
    label: 'Firm',
    desc: 'Direct and assertive — cites the record and sets deadlines.',
  },
  {
    value: 'Escalation',
    label: 'Escalation',
    desc: 'Formal escalation — puts the insurer on notice of bad-faith conduct.',
  },
]

const tone = ref<DraftTone>('Cooperative')
const voice = ref<DraftVoice>('Shop')
const customerAuthorized = ref(false)
const instructions = ref('')
const replyToMessageId = ref('')

const inboundMessages = computed(() =>
  props.detail.messages
    .filter((m) => m.kind === 'Inbound')
    .sort((a, b) => (b.occurredAt ?? b.createdAt).localeCompare(a.occurredAt ?? a.createdAt)),
)

const isLitigation = computed(() => props.detail.case.status === 'Litigation')

const busy = ref(false)
const error = ref<string | null>(null)
const confirmingEscalation = ref(false)

watch(tone, () => {
  confirmingEscalation.value = false
})
watch(voice, (v) => {
  if (v === 'Shop') customerAuthorized.value = false
})

const canSubmit = computed(() => {
  if (busy.value || isLitigation.value) return false
  if (voice.value === 'Customer' && !customerAuthorized.value) return false
  return true
})

function onGenerateClick() {
  error.value = null
  if (tone.value === 'Escalation' && !confirmingEscalation.value) {
    confirmingEscalation.value = true
    return
  }
  generate()
}

async function generate() {
  confirmingEscalation.value = false
  busy.value = true
  error.value = null
  try {
    const result = await createDraft(shopId.value, caseId.value, {
      tone: tone.value,
      voice: voice.value,
      customerAuthorized: customerAuthorized.value,
      replyToMessageId: replyToMessageId.value || null,
      instructions: instructions.value.trim() || null,
    })
    instructions.value = ''
    if (result.recommendsCounsel) emit('counsel')
    emit('refresh')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Draft generation failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card draft-panel">
    <div class="panel-title"><PenLine :size="13" class="title-icon" /> Draft a reply</div>

    <div v-if="isLitigation" class="notice-amber">
      This case is in litigation — the assistant no longer drafts correspondence. Your attorney
      handles communication from here.
    </div>

    <template v-else>
      <!-- tone -->
      <div class="group-label">Tone</div>
      <div class="tone-options">
        <label
          v-for="t in TONES"
          :key="t.value"
          class="tone-option"
          :class="{ selected: tone === t.value, escalation: t.value === 'Escalation' }"
        >
          <input v-model="tone" type="radio" name="tone" :value="t.value" />
          <div>
            <p class="tone-name">{{ t.label }}</p>
            <p class="tone-desc">{{ t.desc }}</p>
          </div>
        </label>
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

      <div v-if="confirmingEscalation" class="notice-amber escalation-confirm">
        <p>
          <AlertTriangle :size="14" class="warn-icon" />
          <strong>Escalation letters make formal accusations</strong> — make sure the fact ledger
          supports them.
        </p>
        <div class="confirm-actions">
          <button class="btn btn-sm" @click="confirmingEscalation = false">Back</button>
          <button class="btn btn-warn btn-sm" :disabled="!canSubmit" @click="generate">
            Generate escalation
          </button>
        </div>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>

      <button
        v-if="!confirmingEscalation"
        class="btn btn-primary generate"
        :disabled="!canSubmit"
        @click="onGenerateClick"
      >
        <span v-if="busy" class="spinner"></span>
        {{ busy ? 'Drafting…' : 'Generate draft' }}
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
.tone-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tone-option {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  cursor: pointer;
  background: var(--bg-raised);
  transition: border-color 0.15s;
}
.tone-option:hover {
  border-color: var(--border);
}
.tone-option.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.tone-option.escalation.selected {
  border-color: var(--amber);
  background: var(--amber-soft);
}
.tone-option input {
  margin-top: 3px;
}
.tone-name {
  font-size: 13px;
  font-weight: 700;
}
.tone-desc {
  font-size: 12px;
  color: var(--text-muted);
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
.escalation-confirm {
  margin-top: 4px;
}
.warn-icon {
  vertical-align: -2px;
  margin-right: 4px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.generate {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}
.disclaimer {
  margin-top: 10px;
  text-align: center;
}
</style>
