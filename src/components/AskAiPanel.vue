<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Sparkles, Paperclip, Send } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { askAi, getChat } from '@/api/negotiation'
import type { CaseDetail, ChatMessage } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import AttachFiles from '@/components/AttachFiles.vue'
import { letterToHtml } from '@/utils/letterMarkdown'
import { useCaseReadOnly } from '@/utils/readOnly'

/** Ask AI (owner 2026-11-26: "a new tab in the negotiator where users can chat directly with
 *  the AI for advice and attach files"). The owner asks about this case in plain words and can
 *  attach the case's documents; the API answers from the case (its facts, letters, invoice and
 *  the attorney-reviewed citations for its state) and keeps the conversation. Advice to the
 *  owner, never a letter that goes out. */
const props = defineProps<{
  detail: CaseDetail
  /** the tab is on screen: the conversation loads the first time it is */
  active: boolean
}>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const readOnly = useCaseReadOnly()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

/** The API's limit (NegotiationService.MaxChatQuestionLength). */
const MAX = 8000
const turns = ref<ChatMessage[]>([])
const loaded = ref(false)
const loading = ref(false)
const loadError = ref<string | null>(null)
const text = ref('')
const files = ref<string[]>([])
const asking = ref(false)
const askError = ref<string | null>(null)
/** The question on its way, shown until the answer lands. */
const pending = ref<{ text: string; files: string[] } | null>(null)
const list = ref<HTMLElement | null>(null)
let seq = 0

const canAsk = computed(() => !readOnly.value && !asking.value && !!text.value.trim())

async function load() {
  const mine = ++seq
  const forCase = caseId.value
  loading.value = true
  loadError.value = null
  try {
    const rows = await getChat(shopId.value, forCase)
    if (mine !== seq) return
    turns.value = rows
    loaded.value = true
    void scrollDown()
  } catch (e) {
    if (mine !== seq) return
    loadError.value = e instanceof ApiError ? e.message : 'The conversation could not be loaded.'
  } finally {
    if (mine === seq) loading.value = false
  }
}

// Another case: start clean (a reply still on its way for the old case lands nowhere).
watch(caseId, () => {
  seq++
  turns.value = []
  loaded.value = false
  loadError.value = null
  text.value = ''
  files.value = []
  pending.value = null
  askError.value = null
  asking.value = false
  if (props.active) void load()
})
watch(
  () => props.active,
  (on) => {
    if (on && !loaded.value && !loading.value) void load()
  },
  { immediate: true },
)

async function scrollDown() {
  await nextTick()
  const el = list.value
  if (el) el.scrollTop = el.scrollHeight
}

const fileName = (id: string) => props.detail.documents.find((d) => d.id === id)?.fileName ?? 'File'

async function ask() {
  if (!canAsk.value) return
  const question = text.value.trim()
  const ids = [...files.value]
  const mine = seq
  asking.value = true
  askError.value = null
  pending.value = { text: question, files: ids }
  void scrollDown()
  try {
    const answer = await askAi(shopId.value, caseId.value, question, ids)
    if (mine !== seq) return
    turns.value = [
      ...turns.value,
      {
        id: `q-${answer.id}`,
        role: 'User',
        content: question,
        createdAt: answer.createdAt,
        attachments: ids.map((id) => ({ documentId: id, fileName: fileName(id) })),
      },
      answer,
    ]
    text.value = ''
    files.value = []
    void scrollDown()
  } catch (e) {
    if (mine !== seq) return
    askError.value = e instanceof ApiError ? e.message : 'The assistant could not answer. Try again.'
  } finally {
    if (mine === seq) {
      asking.value = false
      pending.value = null
    }
  }
}

const SUGGESTIONS = [
  'Is the insurer stalling, and what should I do next?',
  'What can I charge storage for in this state?',
  'Summarize where this case stands.',
]
</script>

<template>
  <section class="ask card" aria-labelledby="ask-title">
    <header class="ask-head">
      <h2 id="ask-title"><Sparkles :size="16" aria-hidden="true" /> Ask AI</h2>
      <p class="ask-lead">
        Ask about this case in your own words, and attach the case's files for it to read. It answers from what's on
        the case and cites only attorney-reviewed citations. It's advice for you; nothing here is sent to anyone.
      </p>
    </header>

    <div ref="list" class="ask-list" aria-live="polite">
      <p v-if="loading && !loaded" class="ask-muted" role="status"><span class="spinner"></span> Loading…</p>
      <div v-else-if="loadError" class="ask-muted" role="alert">
        <p class="error-text">{{ loadError }}</p>
        <button type="button" class="btn btn-ghost btn-sm" @click="load()">Retry</button>
      </div>
      <template v-else>
        <p v-if="!turns.length && !pending" class="ask-muted">
          {{ readOnly ? 'No questions were asked on this case.' : 'Nothing asked yet. Try one of these:' }}
        </p>
        <ul v-if="!turns.length && !pending && !readOnly" class="ask-suggest">
          <li v-for="s in SUGGESTIONS" :key="s">
            <button type="button" class="btn btn-ghost btn-sm" @click="text = s">{{ s }}</button>
          </li>
        </ul>
        <article
          v-for="t in turns"
          :key="t.id"
          :class="['turn', t.role === 'User' ? 'turn-you' : 'turn-ai']"
          :aria-label="t.role === 'User' ? 'You asked' : 'The assistant answered'"
        >
          <p v-if="t.role === 'User'" class="turn-text">{{ t.content }}</p>
          <!-- eslint-disable-next-line vue/no-v-html -- letterToHtml escapes everything first -->
          <div v-else class="turn-text letter" v-html="letterToHtml(t.content)"></div>
          <ul v-if="t.attachments?.length" class="turn-files" aria-label="Files attached">
            <li v-for="f in t.attachments" :key="f.documentId">
              <Paperclip :size="12" aria-hidden="true" /> {{ f.fileName }}
            </li>
          </ul>
        </article>
        <article v-if="pending" class="turn turn-you" aria-label="You asked">
          <p class="turn-text">{{ pending.text }}</p>
          <ul v-if="pending.files.length" class="turn-files" aria-label="Files attached">
            <li v-for="id in pending.files" :key="id"><Paperclip :size="12" aria-hidden="true" /> {{ fileName(id) }}</li>
          </ul>
        </article>
        <p v-if="pending" class="ask-muted" role="status"><span class="spinner"></span> Thinking…</p>
      </template>
    </div>

    <form v-if="!readOnly" class="ask-form" @submit.prevent="ask">
      <label for="ask-box" class="sr-only">Your question</label>
      <textarea
        id="ask-box"
        v-model="text"
        rows="3"
        :maxlength="MAX"
        :disabled="asking"
        placeholder="e.g. “The adjuster says storage stops at the tow date. Is that right here?”"
        @keydown.meta.enter.prevent="ask"
        @keydown.ctrl.enter.prevent="ask"
      />
      <p v-if="askError" class="error-text" role="alert">{{ askError }}</p>
      <div class="ask-foot">
        <AttachFiles
          id="ask-files"
          v-model="files"
          :documents="detail.documents"
          :case-id="detail.case.id"
          :disabled="asking"
          @uploaded="emit('refresh')"
        />
        <button type="submit" class="btn btn-primary btn-sm ask-send" :disabled="!canAsk">
          <span v-if="asking" class="spinner"></span>
          <Send v-else :size="14" aria-hidden="true" />
          {{ asking ? 'Asking…' : 'Ask' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.ask {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 860px;
}
.ask-head h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
}
.ask-head h2 svg {
  color: var(--violet);
}
.ask-lead {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-muted);
}
.ask-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}
.ask-muted {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ask-suggest {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ask-suggest .btn {
  white-space: normal;
  text-align: left;
}
.turn {
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.5;
  min-width: 0;
  overflow-wrap: anywhere;
}
.turn-you {
  align-self: flex-end;
  max-width: 85%;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}
.turn-ai {
  align-self: stretch;
  background: var(--bg-raised);
  border: 1px solid var(--border-soft);
}
.turn-text {
  margin: 0;
  white-space: pre-wrap;
  color: var(--text);
}
.turn-text.letter {
  white-space: normal;
}
.turn-text.letter :deep(p:last-child) {
  margin-bottom: 0;
}
.turn-files {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 12px;
  color: var(--text-muted);
}
.turn-files li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.ask-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ask-form textarea {
  width: 100%;
  resize: vertical;
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
}
.ask-form .error-text {
  margin: 0;
}
.ask-foot {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.ask-foot > :first-child {
  flex: 1;
  min-width: 0;
}
.ask-send {
  flex-shrink: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
@media (max-width: 520px) {
  .ask-foot {
    flex-direction: column;
    align-items: stretch;
  }
  .ask-send {
    justify-content: center;
  }
  .turn-you {
    max-width: 100%;
  }
}
</style>
