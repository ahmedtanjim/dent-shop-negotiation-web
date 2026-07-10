<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ChevronDown, ChevronUp, MessageSquare, SendHorizontal } from 'lucide-vue-next'
import { getChat, sendChat } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { ChatMessage } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ caseId: string }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)

const open = ref(true)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const loading = ref(false)
const thinking = ref(false)
const error = ref<string | null>(null)
const scroller = ref<HTMLElement | null>(null)

const SUGGESTIONS = ['Is this a stall tactic?', "What's my next step?"]

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function load() {
  loading.value = true
  error.value = null
  try {
    messages.value = await getChat(shopId.value, props.caseId)
    scrollToBottom()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the chat.'
  } finally {
    loading.value = false
  }
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || thinking.value) return
  input.value = ''
  error.value = null

  // optimistic user turn
  messages.value.push({
    id: `local-${Date.now()}`,
    role: 'User',
    content,
    createdAt: new Date().toISOString(),
  })
  scrollToBottom()

  thinking.value = true
  try {
    const reply = await sendChat(shopId.value, props.caseId, content)
    messages.value.push(reply)
    scrollToBottom()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'The copilot did not respond.'
  } finally {
    thinking.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="card chat">
    <button class="chat-toggle" @click="open = !open">
      <span class="panel-title chat-title">
        <MessageSquare :size="13" class="title-icon" /> Case copilot
      </span>
      <ChevronUp v-if="open" :size="16" class="muted" />
      <ChevronDown v-else :size="16" class="muted" />
    </button>

    <template v-if="open">
      <div ref="scroller" class="chat-scroll">
        <p v-if="loading" class="faint center"><span class="spinner"></span> Loading chat…</p>

        <template v-else>
          <div v-if="messages.length === 0" class="chat-empty">
            <p class="faint">
              Ask the copilot about this case — it knows the correspondence and the fact ledger.
            </p>
            <div class="suggestions">
              <button v-for="s in SUGGESTIONS" :key="s" class="suggestion" @click="send(s)">
                {{ s }}
              </button>
            </div>
          </div>

          <div
            v-for="m in messages"
            :key="m.id"
            class="bubble"
            :class="m.role === 'User' ? 'user' : 'assistant'"
          >
            {{ m.content }}
          </div>

          <div v-if="thinking" class="bubble assistant thinking">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        </template>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>

      <form class="chat-input" @submit.prevent="send()">
        <input
          v-model="input"
          type="text"
          :placeholder="SUGGESTIONS[0]"
          :disabled="thinking"
        />
        <button class="btn btn-primary btn-sm" type="submit" :disabled="thinking || !input.trim()">
          <SendHorizontal :size="14" />
        </button>
      </form>
    </template>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
}
.chat-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  color: inherit;
  font: inherit;
  width: 100%;
}
.chat-title {
  margin-bottom: 0;
}
.title-icon {
  vertical-align: -2px;
  margin-right: 4px;
}
.chat-scroll {
  max-height: 320px;
  min-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 2px;
}
.center {
  text-align: center;
}
.chat-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 2px;
}
.suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.suggestion {
  background: var(--bg-raised);
  border: 1px solid var(--border-soft);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.suggestion:hover {
  border-color: var(--accent);
  color: var(--text);
}
.bubble {
  max-width: 88%;
  border-radius: 10px;
  padding: 8px 11px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble.user {
  align-self: flex-end;
  background: var(--accent-strong);
  color: #fff;
  border-bottom-right-radius: 3px;
}
.bubble.assistant {
  align-self: flex-start;
  background: var(--bg-raised);
  border: 1px solid var(--border-soft);
  border-bottom-left-radius: 3px;
}
.thinking {
  display: flex;
  gap: 4px;
  align-items: center;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: pulse 1.2s ease-in-out infinite;
}
.dot:nth-child(2) {
  animation-delay: 0.2s;
}
.dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
.chat-input {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
</style>
