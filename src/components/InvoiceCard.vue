<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { FileDown } from 'lucide-vue-next'
import DateField from '@/components/DateField.vue'
import { downloadInvoicePdf, updateCase } from '@/api/negotiation'
import { ApiError, CRM_URL } from '@/api/client'
import { goToCrm } from '@/api/handoff'
import type { CaseDetail, InvoiceBreakdown } from '@/api/types'
import { caseBodyFromDetail } from '@/utils/caseBody'
import { usd } from '@/utils/format'
import { parseMoney, parsePercent } from '@/utils/amount'
import { useAuthStore } from '@/stores/auth'
import { useFlushOnLeave } from '@/utils/flushOnLeave'
import {
  calendarDay,
  dayRefreshDue,
  invoiceView,
  localDayOf,
  serverBillingDay,
  utcDayOf,
} from '@/utils/invoiceFigures'
import { useCaseReadOnly } from '@/utils/readOnly'

const props = defineProps<{
  detail: CaseDetail
  invoice: InvoiceBreakdown | null
  /** The workspace's newest documents reload failed (its message), else null. */
  refreshError?: string | null
}>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)
/** The shop's plan ended: the invoice reads and downloads, but nothing edits or saves. */
const readOnly = useCaseReadOnly()

/* ---------- inline-editable figures ----------
   The inputs show the EFFECTIVE numbers (case override, else shop default) so the card
   reads as the finished invoice. Only fields the user actually touches are written as
   overrides on save; untouched fields round-trip whatever the case already had, so a
   case on shop defaults keeps following the defaults. Clearing a field returns it to
   the shop default. */

const f = ref({ admin: '', lot: '', perDay: '', tax: '', since: '', until: '' })
const edited = ref(new Set<string>())
const saving = ref(false)
/** A save landed and the refresh it asked for hasn't brought the new invoice back yet. */
const awaitingRefresh = ref(false)

function fmtNum(n: number): string {
  return n.toFixed(2)
}

function resetFields() {
  const inv = props.invoice
  const d = props.detail
  f.value = {
    admin: inv ? fmtNum(inv.adminFee) : d.adminFee !== null ? fmtNum(d.adminFee) : '',
    lot: inv ? fmtNum(inv.lotFee) : d.lotFee !== null ? fmtNum(d.lotFee) : '',
    perDay: inv ? fmtNum(inv.storagePerDay) : fmtNum(d.storagePerDayCents / 100),
    tax: inv ? String(inv.taxPercent) : d.salesTaxPercent !== null ? String(d.salesTaxPercent) : '',
    since: d.storageStartDate ? d.storageStartDate.slice(0, 10) : '',
    until: d.storageEndDate ? d.storageEndDate.slice(0, 10) : '',
  }
  edited.value = new Set()
}
// Re-sync from the server when the computed invoice arrives. A refresh loads the case
// first and the invoice second, so syncing on the case alone briefly filled the inputs
// from the previous (stale) invoice — the tax field flashed an old value. The invoice
// always reloads after the case, so it is the one signal to follow.
watch(
  () => props.invoice,
  () => {
    // The server's figures are back: the card shows them again instead of the preview.
    awaitingRefresh.value = false
    // A refresh only re-syncs the figures when no edit is waiting to save.
    if (edited.value.size === 0) resetFields()
  },
  { immediate: true },
)
// The newest reload failed (the workspace reports only the newest one, so an earlier
// reload's failure can't end the wait for a later save's), so no new invoice is coming:
// stop waiting and show the server's (last loaded) invoice again rather than the preview
// indefinitely. The workspace's reload error says what went wrong and offers a retry.
watch(
  () => props.refreshError,
  (e) => {
    if (e) awaitingRefresh.value = false
  },
)

/* Figures are parsed strictly (utils/amount): "-50" or "1e6" is an error under the
   invoice, never a silent 50 / 16, and nothing saves while any figure is invalid. */

const parsed = computed(() => ({
  admin: parseMoney(f.value.admin, 'Admin fee'),
  lot: parseMoney(f.value.lot, 'Lot / gate fee'),
  perDay: parseMoney(f.value.perDay, 'Storage per day'),
  tax: parsePercent(f.value.tax, 'Sales tax'),
}))
type Figure = keyof typeof parsed.value

/* ---------- "today" ----------
   The figures on the card come from the API, which bills storage through the SHOP's own
   calendar day (ShopClock) — the same invoice the PDF and the letters print. Two days are
   still judged here:
   - the preview of an unsaved edit bills through the server's day when its invoice shows it
     (serverBillingDay), else the browser's date (the shop's day for anyone working there);
   - "Storage ends" follows the API's own check (CaseInvoiceInputValidator), which refuses an
     end date only past UTC today + 1: the card allows UTC today, or the user's date when it
     is already a day ahead of UTC, so it never accepts a date the API would refuse.
   `clock` ticks each minute and on focus. When nothing is waiting to save and the shop's day
   may have turned over (dayRefreshDue: the browser's or the UTC date changed, or a new UTC
   hour began while the server still bills an open range through an earlier day — every
   shop's midnight, its state's zone or UTC, falls on a UTC hour), the card asks for a
   refresh. So an open range on a tab left open overnight gains its new day from the server
   within a minute of the shop's midnight, whatever zone the browser is in. */
const clock = ref(Date.now())
function tick() {
  const before = clock.value
  clock.value = Date.now()
  const serverDay = serverBillingDay(props.invoice, props.detail.storageEndDate)
  if (!editPending.value && dayRefreshDue(before, clock.value, serverDay)) emit('refresh')
}
const clockTimer = setInterval(tick, 60_000)
window.addEventListener('focus', tick)
onBeforeUnmount(() => {
  clearInterval(clockTimer)
  window.removeEventListener('focus', tick)
})

function isoOfDay(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10)
}
const localToday = computed(() => localDayOf(clock.value))
const todayUtc = computed(() => utcDayOf(clock.value))
/** The day an unsaved edit's preview bills storage through. */
const billingDay = computed(
  () => serverBillingDay(props.invoice, props.detail.storageEndDate) ?? localToday.value,
)
/** The latest end date the API accepts (see above). */
const latestEnd = computed(() => Math.max(todayUtc.value, localToday.value))
const today = computed(() => isoOfDay(latestEnd.value))

const errors = computed(() => {
  const out: Partial<Record<Figure | 'until', string>> = {}
  for (const [k, p] of Object.entries(parsed.value)) if (p.error) out[k as Figure] = p.error
  // A future end date would bill days that haven't happened yet.
  const until = calendarDay(f.value.until)
  if (until !== null && until > latestEnd.value)
    out.until =
      "Storage can't end in the future. Leave \"Storage ends\" empty while the car is on your lot; it accrues through today."
  return out
})
const hasErrors = computed(() => Object.keys(errors.value).length > 0)
/** The typed figure as a number — 0 when empty or invalid (invalid never saves). */
function val(k: Figure): number {
  return parsed.value[k].value ?? 0
}

/* ---------- preview of an unsaved edit ----------
   Same rules as TotalLossInvoice.Compute on the server (inclusive days, an open range
   accrues through today, tax rounds half away from zero), so the numbers follow the
   keystrokes. It is shown ONLY while an edit is on its way: once the save's refresh brings
   the server's invoice back, the card and the header show the server's figures again. */
const preview = computed(() => {
  const admin = val('admin')
  const lot = val('lot')
  const rate = val('perDay')
  const start = calendarDay(f.value.since)
  let days = 0
  if (start !== null && rate > 0) {
    // Same clamp as the server: an open range, or an end past today, stops at today.
    const until = calendarDay(f.value.until)
    const end = until !== null && until < billingDay.value ? until : billingDay.value
    days = Math.max(0, end - start + 1)
  }
  const storage = days * rate
  const subtotal = admin + lot + storage
  // Server rounds tax in integer cents, half away from zero: round(subtotalCents · pct/100).
  const tax = Math.round(subtotal * val('tax')) / 100
  return { days, storage, subtotal, tax, total: subtotal + tax }
})
/** Typed but not saved, a save in flight, or the save's refresh not back yet. */
const editPending = computed(() => edited.value.size > 0 || saving.value || awaitingRefresh.value)
const view = computed(() =>
  invoiceView(props.invoice, preview.value, { editPending: editPending.value, invalid: hasErrors.value }),
)
const shown = computed(() => view.value.figures)
/** Why storage bills nothing — named precisely, never a generic "set the date". */
const storageIssue = computed<string | null>(() => {
  const start = calendarDay(f.value.since)
  const end = calendarDay(f.value.until)
  if (start === null) return 'no start date (set "Storage since")'
  if (val('perDay') <= 0) return 'the daily rate is $0 (enter your storage rate)'
  if (start > billingDay.value) return 'the start date is in the future'
  if (end !== null && end < start) return 'the end date is before the start date'
  return shown.value.days === 0 ? 'no storage days in the date range' : null
})
const storageMissing = computed(() => storageIssue.value !== null)
// The header shows the same balance as the card; while a figure is invalid it keeps the
// last saved one.
const emitTotal = defineModel<number | null>('liveTotal')
watch(
  () => view.value.headerTotal,
  (t) => (emitTotal.value = t),
  { immediate: true },
)
const emitIssue = defineModel<string | null>('storageIssue')
watch(storageIssue, (v) => (emitIssue.value = v), { immediate: true })

/* ---------- debounced auto-save ---------- */

const savedFlash = ref(false)
const saveError = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

let debouncePending = false
function touched(field: string) {
  if (readOnly.value) return
  edited.value = new Set(edited.value).add(field)
  clearTimeout(timer)
  debouncePending = true
  timer = setTimeout(() => void save(), 800)
}
// Leaving the page (another case, the case list, closing the tab) inside the debounce
// window used to cancel the save and lose the edit (NEG-6) — flush it instead. Read-only,
// there is never anything to flush.
useFlushOnLeave(
  () => !readOnly.value && (debouncePending || rerun),
  (keepalive) => {
    if (readOnly.value) return
    clearTimeout(timer)
    void save(keepalive)
  },
)

// The plan ended mid-edit (the save came back 402 and the shop now reads as read-only):
// that edit can never be saved, so the card returns to the saved invoice.
watch(readOnly, (ro) => {
  if (!ro) return
  clearTimeout(timer)
  debouncePending = false
  rerun = false
  awaitingRefresh.value = false
  resetFields()
})

function optOverride(field: Figure, original: number | null): number | null {
  if (!edited.value.has(field)) return original
  return parsed.value[field].value
}

/** A debounce that came due while a save was in flight — run it when that one lands. */
let rerun = false

async function save(keepalive = false) {
  debouncePending = false
  if (readOnly.value) return
  tick() // judge "future" against the day it is now, not the last minute tick
  // Invalid figures stay on screen with their message; nothing is sent until they're fixed.
  if (hasErrors.value) return
  if (saving.value) {
    rerun = true
    return
  }
  saving.value = true
  saveError.value = null
  // Exactly what this save sends, so keystrokes typed while it is in flight aren't lost.
  type Field = keyof typeof f.value
  const sent = new Map<Field, string>()
  for (const k of edited.value) sent.set(k as Field, f.value[k as Field])
  const d = props.detail
  const body = caseBodyFromDetail(d)
  body.adminFee = optOverride('admin', d.adminFee)
  body.lotFee = optOverride('lot', d.lotFee)
  body.salesTaxPercent = optOverride('tax', d.salesTaxPercent)
  body.storagePerDay = edited.value.has('perDay') ? val('perDay') : d.storagePerDayCents / 100
  if (edited.value.has('since')) body.storageStartDate = f.value.since || null
  if (edited.value.has('until')) body.storageEndDate = f.value.until || null
  try {
    await updateCase(shopId.value, caseId.value, body, { keepalive })
    // Only a field that was sent AND still holds the sent value is saved; one typed into
    // mid-save stays edited (its own debounce, or the rerun below, saves it next).
    const still = new Set(edited.value)
    for (const [k, v] of sent) if (f.value[k] === v) still.delete(k)
    edited.value = still
    savedFlash.value = true
    setTimeout(() => (savedFlash.value = false), 1600)
    // Keep the preview up until the refresh brings the server's recomputed invoice: the
    // old one would otherwise flash back for a moment.
    awaitingRefresh.value = true
    emit('refresh')
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'Save failed.'
  } finally {
    saving.value = false
    if (rerun) {
      rerun = false
      clearTimeout(timer)
      timer = setTimeout(() => void save(), 0)
    }
  }
}

/* ---------- PDF ---------- */

const pdfBusy = ref(false)
/** The API refuses the PDF while the shop profile lacks what the invoice prints
 *  (400 `shop_profile_incomplete` + the missing fields) — shown with a way to fix it. */
const profileGap = ref<{ message: string; missing: string[] } | null>(null)
async function onPdf() {
  pdfBusy.value = true
  saveError.value = null
  profileGap.value = null
  try {
    await downloadInvoicePdf(shopId.value, caseId.value, props.detail.case.customerName)
  } catch (e) {
    if (e instanceof ApiError && e.code === 'shop_profile_incomplete') {
      const missing = Array.isArray(e.body?.missing)
        ? (e.body.missing as { label?: unknown }[])
            .map((m) => (typeof m.label === 'string' ? m.label : null))
            .filter((l): l is string => !!l)
        : []
      profileGap.value = { message: e.message, missing }
    } else {
      saveError.value = e instanceof ApiError ? e.message : 'PDF download failed.'
    }
  } finally {
    pdfBusy.value = false
  }
}
</script>

<template>
  <section class="card invoice">
    <div class="inv-top">
      <h2>Total Loss Invoice</h2>
      <span class="inv-right">
        <span v-if="saving" class="save-ind"><span class="spinner"></span> Saving…</span>
        <span v-else-if="savedFlash" class="save-ind saved">✓ Saved</span>
        <span v-if="detail.case.insurerName" class="to">
          To {{ detail.case.insurerName }}
          <template v-if="detail.case.insurerClaimNumber">
            · Re <span class="mono">{{ detail.case.insurerClaimNumber }}</span>
          </template>
        </span>
      </span>
    </div>

    <!-- read-only (plan ended): a disabled fieldset turns off every input inside it, the
         date chips included -->
    <fieldset class="lines" :disabled="readOnly">
      <div class="line">
        <span class="desc">Admin / blueprinting fee</span>
        <span class="val"
          >$ <input v-model="f.admin" class="blank" :class="{ invalid: errors.admin }" :aria-invalid="!!errors.admin" inputmode="decimal" aria-label="Admin fee, dollars"
            @input="touched('admin')"
        /></span>
      </div>
      <div class="line">
        <span class="desc">Commercial lot / gate fee</span>
        <span class="val"
          >$ <input v-model="f.lot" class="blank" :class="{ invalid: errors.lot }" :aria-invalid="!!errors.lot" inputmode="decimal" aria-label="Lot or gate fee, dollars"
            @input="touched('lot')"
        /></span>
      </div>
      <div class="line">
        <span class="desc" :class="{ warn: storageMissing }">
          Storage since
          <DateField v-model="f.since" variant="chip" label="In shop since" @input="touched('since')" />
          <template v-if="!storageMissing">
            · <span class="mono days">{{ shown.days }}</span>&nbsp;{{ shown.days === 1 ? 'day' : 'days' }} ·
          </template>
          <template v-else> · </template>
          $ <input v-model="f.perDay" class="blank rate" :class="{ invalid: errors.perDay }" :aria-invalid="!!errors.perDay" inputmode="decimal" aria-label="Storage per day, dollars"
            @input="touched('perDay')" /> /day
        </span>
        <span class="val mono">{{ errors.perDay || errors.until ? '—' : usd(shown.storage) }}</span>
      </div>
      <div class="line sub">
        <span class="desc">
          Storage ends
          <DateField
            v-model="f.until"
            variant="chip"
            label="Storage ends (optional)"
            placeholder="not set"
            :max="today"
            :invalid="!!errors.until"
            clearable
            @input="touched('until')"
          />
          <span class="hint-inline">— leave empty while the car is on your lot; it accrues through today</span>
        </span>
      </div>
      <p v-if="storageIssue" class="issue" role="status">Storage bills $0: {{ storageIssue }}.</p>
      <div class="line">
        <span class="desc">
          Sales tax ·
          <input v-model="f.tax" class="blank pct" :class="{ invalid: errors.tax }" :aria-invalid="!!errors.tax" inputmode="decimal" aria-label="Sales tax percent"
            @input="touched('tax')" /> %
        </span>
        <span class="val mono">{{ hasErrors ? '—' : usd(shown.tax) }}</span>
      </div>
      <div class="line total">
        <span class="desc">Total recovery balance</span>
        <span class="val mono">{{ hasErrors ? '—' : usd(shown.total) }}</span>
      </div>
    </fieldset>

    <div v-if="hasErrors" class="field-errs" role="alert">
      <p v-for="(msg, k) in errors" :key="k" class="field-err">{{ msg }}</p>
      <p class="field-err-note">Nothing is saved until the figure is fixed.</p>
    </div>

    <p v-if="saveError" class="error-text">{{ saveError }}</p>
    <div v-if="profileGap" class="error-text profile-gap" role="alert">
      <p>{{ profileGap.message }}</p>
      <ul v-if="profileGap.missing.length">
        <li v-for="m in profileGap.missing" :key="m">{{ m }}</li>
      </ul>
      <p>
        <a :href="`${CRM_URL}/settings`" target="_blank" rel="noopener" @click.prevent="goToCrm('/settings', true)">
          Complete the shop profile in Settings</a>, then download the PDF again.
      </p>
    </div>

    <div class="inv-foot">
      <span v-if="readOnly" class="hint">
        Read-only — your DSM Negotiator plan has ended. The PDF still downloads.
      </span>
      <span v-else class="hint">
        Click any figure to edit — it saves itself and every letter updates. Cleared fees fall back
        to your shop defaults.
      </span>
      <button class="btn btn-primary" :disabled="pdfBusy" @click="onPdf">
        <span v-if="pdfBusy" class="spinner"></span>
        <FileDown v-else :size="14" /> Download invoice PDF
      </button>
    </div>
  </section>
</template>

<style scoped>
.invoice {
  padding: 22px 26px;
}
.inv-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.inv-top h2 {
  font-size: 16.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.inv-right {
  display: inline-flex;
  align-items: baseline;
  gap: 14px;
}
.to {
  font-size: 12.5px;
  color: var(--text-faint);
}
.to .mono {
  font-size: 12px;
}
.save-ind {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.save-ind.saved {
  color: var(--green);
}
.line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 14px;
}
.line.sub {
  padding-top: 0;
  margin-top: -6px;
  border-bottom: 1px solid var(--border-soft);
  font-size: 12.5px;
}
.line .desc {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.line .desc.warn {
  color: var(--amber);
}
.line .val {
  font-weight: 500;
  white-space: nowrap;
}
.line.total {
  border-bottom: none;
  padding-top: 13px;
}
.line.total .desc {
  color: var(--text);
  font-weight: 650;
  font-size: 15px;
}
.line.total .val {
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.days {
  font-size: 12.5px;
}
.blank.invalid,
.blank.invalid:hover,
.blank.invalid:focus {
  outline: 1.5px solid var(--danger);
}
.field-errs {
  margin-top: 8px;
}
.field-err {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--danger);
}
.field-err-note {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-faint);
}
.profile-gap p {
  margin: 0;
}
.profile-gap ul {
  margin: 4px 0 6px 1.2em;
  padding: 0;
}
.profile-gap a {
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
}
.issue {
  margin: 6px 0 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--amber);
}
.hint-inline {
  color: var(--text-faint);
  font-size: 12px;
}
fieldset.lines {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
/* read-only: the figures read as plain text — no hover ring, no date picker */
.blank:disabled {
  cursor: default;
}
.blank:disabled:hover {
  background: transparent;
  outline-color: transparent;
}
.lines:disabled :deep(.df) {
  pointer-events: none;
}
/* figures edit in place — invisible until hovered, ringed when focused */
.blank {
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  width: 92px;
  padding: 3px 8px;
  text-align: right;
  outline: 1px solid transparent;
  transition: outline-color 0.12s, background 0.12s;
}
.blank:hover {
  background: var(--bg-raised);
  outline-color: var(--border);
}
.blank:focus {
  background: var(--bg-raised);
  outline: 1.5px solid var(--accent);
}
.blank.rate {
  width: 76px;
}
.blank.pct {
  width: 58px;
}
.inv-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.inv-foot .hint {
  font-size: 12.5px;
  color: var(--text-faint);
  max-width: 420px;
}
</style>
