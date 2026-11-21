<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageSquareText } from 'lucide-vue-next'

/** Under a draft the owner just read (owner 2026-11-21: "after I read the letter I can tell it
 *  what it got wrong or didn't include"): what's wrong or missing, in their own words. The
 *  assistant writes that same letter again with it fixed and the rewrite takes the draft's
 *  place. The parent owns the request; this only collects the words. */
const props = defineProps<{
  /** the rewrite is being written */
  busy?: boolean
  /** another draft is being written, so this one has to wait */
  blocked?: boolean
  /** why the last rewrite didn't happen (the typed feedback is kept) */
  error?: string | null
  /** unique per draft: ties the label and the hint to the box */
  id: string
}>()
const emit = defineEmits<{ submit: [feedback: string] }>()

/** The API's limit (NegotiationService.MaxFeedbackLength). */
const MAX = 2000
const text = ref('')
const box = ref<HTMLTextAreaElement | null>(null)
const trimmed = computed(() => text.value.trim())
const canSend = computed(() => !!trimmed.value && !props.busy && !props.blocked)
/** Only shown when it matters: near the limit. */
const left = computed(() => MAX - text.value.length)

function grow() {
  const el = box.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}

function send() {
  if (!canSend.value) return
  emit('submit', trimmed.value)
}

</script>

<template>
  <section class="df" :aria-labelledby="`df-title-${id}`">
    <label :id="`df-title-${id}`" class="df-title" :for="`df-box-${id}`">
      <MessageSquareText :size="14" class="df-icon" aria-hidden="true" />
      Something wrong or missing in this letter?
    </label>
    <textarea
      :id="`df-box-${id}`"
      ref="box"
      v-model="text"
      class="df-box"
      rows="3"
      :maxlength="MAX"
      :disabled="busy"
      :aria-describedby="`df-hint-${id}`"
      placeholder="Tell the assistant in your own words, e.g. “The adjuster is Mike Torres, not Mark. You left out the $150 tow bill.”"
      @input="grow"
      @keydown.meta.enter.prevent="send"
      @keydown.ctrl.enter.prevent="send"
    />
    <p v-if="error" class="error-text df-error" role="alert">{{ error }}</p>
    <div class="df-foot">
      <p :id="`df-hint-${id}`" class="df-hint">
        <template v-if="busy">Writing the letter again with your changes…</template>
        <template v-else-if="blocked">Another letter is being written. You can send this when it's done.</template>
        <template v-else>
          The assistant writes this letter again with your changes. The new one takes this draft's place.
        </template>
        <span v-if="left <= 200" class="df-left"> {{ left }} characters left.</span>
      </p>
      <button type="button" class="btn btn-sm df-send" :disabled="!canSend" @click="send">
        <span v-if="busy" class="spinner"></span>
        {{ busy ? 'Rewriting…' : 'Rewrite letter' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.df {
  margin-top: 14px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  padding: 10px 12px;
}
.df-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text);
}
.df-icon {
  color: var(--violet);
  flex-shrink: 0;
}
.df-box {
  display: block;
  width: 100%;
  margin-top: 8px;
  resize: none;
  overflow-y: hidden;
  font: inherit;
  font-size: 13.5px;
  line-height: 1.45;
}
.df-error {
  margin: 6px 0 0;
}
.df-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
.df-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
}
.df-left {
  color: var(--amber);
}
.df-send {
  flex-shrink: 0;
}
@media (max-width: 520px) {
  .df-foot {
    flex-direction: column;
    align-items: stretch;
  }
  .df-send {
    justify-content: center;
  }
}
</style>
