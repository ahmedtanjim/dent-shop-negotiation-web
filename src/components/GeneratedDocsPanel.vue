<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, Copy, FileDown, FileText, RefreshCw } from 'lucide-vue-next'
import { downloadInvoicePdf, getGeneratedDocs } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, GeneratedDoc, GeneratedDocs } from '@/api/types'
import { formatDateOnly, usd } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ detail: CaseDetail }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

const docs = ref<GeneratedDocs | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  error.value = null
  try {
    docs.value = await getGeneratedDocs(shopId.value, caseId.value)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not generate the documents.'
  } finally {
    loading.value = false
  }
}
// Regenerate whenever the case changes — fee edits, customer link, intake (adjuster
// name reaches the greeting) all land in the letters immediately.
watch(() => props.detail, load, { immediate: true, deep: false })

const shopDocs = computed(() => docs.value?.documents.filter((d) => d.voice === 'Shop') ?? [])
const customerDocs = computed(
  () => docs.value?.documents.filter((d) => d.voice === 'Customer') ?? [],
)
const invoice = computed(() => docs.value?.invoice ?? null)
const storageMissing = computed(() => invoice.value !== null && invoice.value.storageDays === 0)

/* ---------- expand / copy ---------- */

const open = ref<string | null>(null)
function toggle(key: string) {
  open.value = open.value === key ? null : key
}

const copied = ref<string | null>(null)
async function copyDoc(d: GeneratedDoc, withSubject: boolean) {
  const text = withSubject ? `Subject: ${d.subject}\n\n${d.body}` : d.body
  await navigator.clipboard.writeText(text)
  copied.value = d.key + (withSubject ? ':full' : ':body')
  setTimeout(() => (copied.value = null), 1800)
}

/* ---------- invoice pdf ---------- */

const pdfBusy = ref(false)
async function onPdf() {
  pdfBusy.value = true
  error.value = null
  try {
    await downloadInvoicePdf(shopId.value, caseId.value, props.detail.case.customerName)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'PDF download failed.'
  } finally {
    pdfBusy.value = false
  }
}
</script>

<template>
  <section class="card docs-panel">
    <div class="panel-title">
      <FileText :size="13" class="title-icon" /> Documents
      <button class="btn btn-ghost btn-sm refresh" title="Regenerate" @click="load">
        <RefreshCw :size="13" />
      </button>
    </div>
    <p class="faint intro">
      Generated from this case — the shop's proven letters with your numbers filled in. Copy,
      review, and send from your own mailbox.
    </p>

    <div v-if="loading" class="muted loading"><span class="spinner"></span> Generating…</div>
    <p v-if="error" class="error-text">{{ error }}</p>

    <template v-if="docs">
      <!-- invoice -->
      <div class="group-label">Total Loss invoice</div>
      <div class="invoice">
        <div v-if="invoice" class="inv-lines">
          <div class="inv-line">
            <span>Admin / blueprinting fee</span><span class="mono">{{ usd(invoice.adminFee) }}</span>
          </div>
          <div class="inv-line">
            <span>Commercial lot / gate fee</span><span class="mono">{{ usd(invoice.lotFee) }}</span>
          </div>
          <div class="inv-line" :class="{ 'inv-warn': storageMissing }">
            <span v-if="!storageMissing">
              Storage {{ formatDateOnly(invoice.storageStart!) }} – {{ formatDateOnly(invoice.storageEnd!) }}
              ({{ invoice.storageDays }}d × {{ usd(invoice.storagePerDay) }})
            </span>
            <span v-else>Storage — set the "vehicle in shop since" date in Case details</span>
            <span class="mono">{{ usd(invoice.storageTotal) }}</span>
          </div>
          <div v-if="invoice.taxPercent > 0" class="inv-line">
            <span>Sales tax ({{ invoice.taxPercent }}%)</span><span class="mono">{{ usd(invoice.tax) }}</span>
          </div>
          <div class="inv-line inv-total">
            <span>Total recovery balance</span><span class="mono">{{ usd(invoice.total) }}</span>
          </div>
        </div>
        <button class="btn btn-primary pdf-btn" :disabled="pdfBusy" @click="onPdf">
          <span v-if="pdfBusy" class="spinner"></span>
          <FileDown v-else :size="14" /> Download invoice PDF
        </button>
      </div>

      <!-- shop letters -->
      <div class="group-label">Shop email</div>
      <div v-for="d in shopDocs" :key="d.key" class="doc" :class="{ open: open === d.key }">
        <button class="doc-head" @click="toggle(d.key)">
          <div class="doc-head-text">
            <p class="doc-title">{{ d.title }}</p>
            <p class="faint doc-scenario">{{ d.scenario }}</p>
          </div>
          <ChevronDown :size="15" class="chev" />
        </button>
        <div v-if="open === d.key" class="doc-body">
          <p class="doc-subject mono">{{ d.subject }}</p>
          <pre>{{ d.body }}</pre>
          <div class="doc-actions">
            <button class="btn btn-sm" @click="copyDoc(d, false)">
              <Check v-if="copied === d.key + ':body'" :size="13" /><Copy v-else :size="13" />
              Copy body
            </button>
            <button class="btn btn-sm" @click="copyDoc(d, true)">
              <Check v-if="copied === d.key + ':full'" :size="13" /><Copy v-else :size="13" />
              Copy with subject
            </button>
          </div>
        </div>
      </div>

      <!-- customer letters -->
      <div class="group-label">Customer emails — send to your customer to forward</div>
      <div v-for="d in customerDocs" :key="d.key" class="doc" :class="{ open: open === d.key }">
        <button class="doc-head" @click="toggle(d.key)">
          <div class="doc-head-text">
            <p class="doc-title">{{ d.title }}</p>
            <p class="faint doc-scenario">{{ d.scenario }}</p>
          </div>
          <ChevronDown :size="15" class="chev" />
        </button>
        <div v-if="open === d.key" class="doc-body">
          <p class="doc-subject mono">{{ d.subject }}</p>
          <pre>{{ d.body }}</pre>
          <div class="doc-actions">
            <button class="btn btn-sm" @click="copyDoc(d, false)">
              <Check v-if="copied === d.key + ':body'" :size="13" /><Copy v-else :size="13" />
              Copy body
            </button>
            <button class="btn btn-sm" @click="copyDoc(d, true)">
              <Check v-if="copied === d.key + ':full'" :size="13" /><Copy v-else :size="13" />
              Copy with subject
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.docs-panel {
  display: flex;
  flex-direction: column;
}
.title-icon {
  vertical-align: -2px;
  margin-right: 4px;
}
.refresh {
  float: right;
  margin: -4px -4px 0 0;
}
.intro {
  margin-bottom: 10px;
  line-height: 1.45;
}
.loading {
  font-size: 13px;
  padding: 8px 0;
}
.group-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 12px 0 6px;
}
.invoice {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  padding: 10px 12px;
}
.inv-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.inv-line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}
.inv-line span:first-child {
  color: var(--text-muted);
}
.inv-warn span:first-child {
  color: var(--amber);
}
.inv-total {
  border-top: 1px solid var(--border-soft);
  padding-top: 6px;
  margin-top: 3px;
  font-weight: 700;
}
.inv-total span:first-child {
  color: inherit;
}
.mono {
  font-family: var(--mono);
}
.pdf-btn {
  width: 100%;
  justify-content: center;
}
.doc {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  margin-bottom: 6px;
  overflow: hidden;
}
.doc.open {
  border-color: var(--accent);
}
.doc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 9px 11px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}
.doc-head-text {
  min-width: 0;
}
.doc-title {
  font-size: 13px;
  font-weight: 600;
}
.doc-scenario {
  font-size: 11.5px;
  line-height: 1.35;
  margin-top: 2px;
}
.chev {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s;
}
.doc.open .chev {
  transform: rotate(180deg);
}
.doc-body {
  border-top: 1px solid var(--border-soft);
  padding: 10px 11px;
}
.doc-subject {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  word-break: break-word;
}
.doc-body pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.5;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 10px;
  margin: 0 0 8px;
}
.doc-actions {
  display: flex;
  gap: 6px;
}
</style>
