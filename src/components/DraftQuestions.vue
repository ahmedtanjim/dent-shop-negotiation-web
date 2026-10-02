<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageCircleQuestion } from 'lucide-vue-next'
import DateField from '@/components/DateField.vue'
import type { DraftAnswer, DraftQuestion } from '@/api/types'

/** Asked before a draft is written (at most 3) so the letter comes out complete — no
 *  [BLANKS] to fill in afterwards. Every question can be skipped; the letter then simply
 *  doesn't rely on that fact. Answers are saved to the case's fact list server-side. */
const props = defineProps<{ questions: DraftQuestion[]; busy?: boolean }>()
const emit = defineEmits<{ submit: [answers: DraftAnswer[]] }>()

const values = ref<string[]>(props.questions.map(() => ''))
const today = new Date().toISOString().slice(0, 10)

function toggle(i: number, v: 'Yes' | 'No') {
  values.value[i] = values.value[i] === v ? '' : v
}

const answeredCount = computed(() => values.value.filter((v) => v.trim()).length)

function send(skipAll = false) {
  emit(
    'submit',
    props.questions.map((q, i) => ({
      question: q.question,
      kind: q.kind,
      answer: skipAll ? null : values.value[i]?.trim() || null,
    })),
  )
}
</script>

<template>
  <section class="dq" aria-labelledby="dq-title">
    <div class="dq-head">
      <MessageCircleQuestion :size="16" class="dq-icon" aria-hidden="true" />
      <div>
        <h3 id="dq-title">
          {{ questions.length === 1 ? 'One quick question' : `${questions.length} quick questions` }}
          before I write it
        </h3>
        <p class="dq-sub">
          Answer what you know and skip the rest. The letter never guesses, and your answers are
          saved to the case so you won't be asked again.
        </p>
      </div>
    </div>

    <ol class="dq-list">
      <li v-for="(q, i) in questions" :key="q.question" class="dq-item">
        <div class="dq-q">{{ q.question }}</div>
        <div v-if="q.why" class="dq-why">{{ q.why }}</div>

        <div v-if="q.kind === 'YesNo'" class="dq-yn" role="group" :aria-label="q.question">
          <button
            v-for="v in ['Yes', 'No'] as const"
            :key="v"
            type="button"
            class="dq-chip"
            :class="{ on: values[i] === v }"
            :aria-pressed="values[i] === v"
            :disabled="busy"
            @click="toggle(i, v)"
          >
            {{ v }}
          </button>
        </div>
        <DateField
          v-else-if="q.kind === 'Date'"
          v-model="values[i]"
          :label="q.question"
          :max="today"
          clearable
          class="dq-date"
        />
        <input
          v-else
          v-model="values[i]"
          type="text"
          class="dq-text"
          maxlength="500"
          :aria-label="q.question"
          :disabled="busy"
          placeholder="A few words"
          @keydown.enter.prevent="send()"
        />
      </li>
    </ol>

    <div class="dq-actions">
      <button type="button" class="btn btn-primary" :disabled="busy" @click="send()">
        <span v-if="busy" class="spinner"></span>
        {{ busy ? 'Writing…' : answeredCount ? 'Write the letter' : 'Skip and write the letter' }}
      </button>
      <button
        v-if="answeredCount"
        type="button"
        class="btn btn-ghost btn-sm"
        :disabled="busy"
        @click="send(true)"
      >
        Skip all
      </button>
    </div>
  </section>
</template>

<style scoped>
.dq {
  border: 1px solid var(--accent-soft);
  background: var(--panel);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow);
}
.dq-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.dq-icon {
  color: var(--violet);
  flex-shrink: 0;
  margin-top: 2px;
}
.dq-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}
.dq-sub {
  margin: 3px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text-muted);
}
.dq-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dq-item {
  border-top: 1px solid var(--border-soft);
  padding-top: 12px;
}
.dq-q {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
}
.dq-why {
  font-size: 12px;
  color: var(--text-faint);
  margin-top: 2px;
  line-height: 1.4;
}
.dq-yn {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.dq-chip {
  min-width: 64px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.dq-chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.dq-chip:disabled {
  cursor: default;
  opacity: 0.6;
}
.dq-date,
.dq-text {
  margin-top: 8px;
  max-width: 320px;
  width: 100%;
}
.dq-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}
</style>
