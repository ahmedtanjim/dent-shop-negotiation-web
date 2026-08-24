<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PenLine, Sparkles } from 'lucide-vue-next'
import { createDraft } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, DraftVoice } from '@/api/types'
import { formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

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
const error = ref<string | null>(null)

watch(voice, (v) => {
  if (v === 'Shop') customerAuthorized.value = false
})

const canSubmit = computed(() => {
  if (busy.value || isLitigation.value) return false
  if (voice.value === 'Customer' && !customerAuthorized.value) return false
  return true
})

// No tone picker: tone is omitted so the assistant reads the escalation ladder and picks
// the tier the facts support. Its choice comes back as the badge on the draft card.
async function generate() {
  busy.value = true
  emit('drafting', true)
  error.value = null
  try {
    const result = await createDraft(shopId.value, caseId.value, {
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
    emit('drafting', false)
  }
}
</script>

<template>
  <section class="card draft-panel">
    <div class="panel-title"><PenLine :size="13" class="title-icon" /> Generate new correspondence</div>

    <div v-if="isLitigation" class="notice-amber">
      This case is in litigation — the assistant no longer drafts correspondence. Your attorney
      handles communication from here.
    </div>

    <template v-else>
      <div v-if="!detail.hasPlaybook" class="notice-amber no-playbook">
        No verified legal playbook for
        <strong>{{ detail.case.state ?? 'this case’s state' }}</strong> yet — drafts will argue
        from your documented facts but won’t cite statutes. State law coverage is expanding.
      </div>

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

      <button class="btn btn-primary generate" :disabled="!canSubmit" @click="generate">
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
