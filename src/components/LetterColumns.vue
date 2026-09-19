<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, RefreshCw } from 'lucide-vue-next'
import type { GeneratedDoc, GeneratedDocs } from '@/api/types'
import { copyLetter, letterToHtml, letterToPlainText } from '@/utils/letterMarkdown'

const props = defineProps<{ docs: GeneratedDocs | null; loading: boolean; error: string | null }>()
const emit = defineEmits<{ reload: [] }>()

const shopDocs = computed(() => props.docs?.documents.filter((d) => d.voice === 'Shop') ?? [])
const customerDocs = computed(
  () => props.docs?.documents.filter((d) => d.voice === 'Customer') ?? [],
)

/** First non-empty paragraph, trimmed to a card-sized excerpt. */
function excerpt(d: GeneratedDoc): string {
  const para = letterToPlainText(d.body)
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40)[0]
  const text = para ?? letterToPlainText(d.body).replace(/\s+/g, ' ').trim()
  return text.length > 190 ? `${text.slice(0, 190).trimEnd()}…` : text
}

const open = ref<string | null>(null)
function toggle(key: string) {
  open.value = open.value === key ? null : key
}

const copied = ref<string | null>(null)
async function copyDoc(d: GeneratedDoc, withSubject: boolean) {
  await copyLetter(withSubject ? d.subject : null, d.body)
  copied.value = d.key + (withSubject ? ':full' : ':body')
  setTimeout(() => (copied.value = null), 1800)
}
</script>

<template>
  <div class="letters">
    <div v-if="loading" class="muted loading"><span class="spinner"></span> Generating your letters…</div>
    <p v-else-if="error" class="error-text">
      {{ error }}
      <button class="btn btn-ghost btn-sm" @click="emit('reload')"><RefreshCw :size="13" /> Retry</button>
    </p>

    <div v-else-if="docs" class="stacks">
      <div class="col col-shop">
        <div class="seclbl">Shop sends <span class="sub">from your own mailbox</span></div>
        <article v-for="d in shopDocs" :key="d.key" class="card letter" :class="{ open: open === d.key }">
          <div class="kicker">{{ d.scenario }}</div>
          <h3>{{ d.title }}</h3>
          <p v-if="open !== d.key" class="excerpt">"{{ excerpt(d) }}"</p>
          <div v-else class="full">
            <p class="subject mono">{{ d.subject }}</p>
            <div class="body" v-html="letterToHtml(d.body)"></div>
          </div>
          <div class="foot">
            <button class="btn btn-ghost btn-sm" @click="toggle(d.key)">
              {{ open === d.key ? 'Fold' : 'Read' }}
            </button>
            <button class="btn btn-sm" @click="copyDoc(d, false)">
              <Check v-if="copied === d.key + ':body'" :size="13" /><Copy v-else :size="13" /> Copy
            </button>
            <button class="btn btn-sm" @click="copyDoc(d, true)">
              <Check v-if="copied === d.key + ':full'" :size="13" /><Copy v-else :size="13" />
              With subject
            </button>
          </div>
        </article>
      </div>

      <div class="col col-cust">
        <div class="seclbl">
          Customer forwards <span class="sub">you email them · they send it on</span>
        </div>
        <article
          v-for="d in customerDocs"
          :key="d.key"
          class="card letter"
          :class="{ open: open === d.key }"
        >
          <div class="kicker">{{ d.scenario }}</div>
          <h3>{{ d.title }}</h3>
          <p v-if="open !== d.key" class="excerpt">"{{ excerpt(d) }}"</p>
          <div v-else class="full">
            <p class="subject mono">{{ d.subject }}</p>
            <div class="body" v-html="letterToHtml(d.body)"></div>
          </div>
          <div class="foot">
            <button class="btn btn-ghost btn-sm" @click="toggle(d.key)">
              {{ open === d.key ? 'Fold' : 'Read' }}
            </button>
            <button class="btn btn-sm" @click="copyDoc(d, false)">
              <Check v-if="copied === d.key + ':body'" :size="13" /><Copy v-else :size="13" /> Copy
            </button>
            <button class="btn btn-sm" @click="copyDoc(d, true)">
              <Check v-if="copied === d.key + ':full'" :size="13" /><Copy v-else :size="13" />
              With subject
            </button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading {
  font-size: 13.5px;
  padding: 6px 0;
}
.stacks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 900px) {
  .stacks {
    grid-template-columns: 1fr;
  }
}
.col {
  display: grid;
  gap: 12px;
}
.seclbl {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.seclbl .sub {
  font-weight: 400;
  font-size: 12.5px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-faint);
}
.col-shop .seclbl {
  color: var(--accent);
}
.col-cust .seclbl {
  color: var(--teal);
}
.letter {
  padding: 17px 19px 14px;
  transition: border-color 0.12s;
}
.letter:hover {
  border-color: var(--border);
}
/* scenarios are full sentences — small and colored, never uppercase */
.kicker {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 6px;
}
.col-shop .kicker {
  color: var(--accent);
}
.col-cust .kicker {
  color: var(--teal);
}
.letter h3 {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.excerpt {
  color: var(--text-muted);
  font-size: 13.5px;
}
.subject {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  word-break: break-word;
  color: var(--text-muted);
}
.full .body {
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-muted);
  max-height: 380px;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin: 0;
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 13px;
  flex-wrap: wrap;
}
</style>
