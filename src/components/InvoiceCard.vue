<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CalendarDays, FileDown } from 'lucide-vue-next'
import { downloadInvoicePdf, updateCase } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail, InvoiceBreakdown } from '@/api/types'
import { caseBodyFromDetail } from '@/utils/caseBody'
import { usd } from '@/utils/format'
import { parseMoney, parsePercent } from '@/utils/amount'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ detail: CaseDetail; invoice: InvoiceBreakdown | null }>()
const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const shopId = computed(() => auth.shopId as string)
const caseId = computed(() => props.detail.case.id)

/* ---------- inline-editable figures ----------
   The inputs show the EFFECTIVE numbers (case override, else shop default) so the card
   reads as the finished invoice. Only fields the user actually touches are written as
   overrides on save; untouched fields round-trip whatever the case already had, so a
   case on shop defaults keeps following the defaults. Clearing a field returns it to
   the shop default. */

const f = ref({ admin: '', lot: '', perDay: '', tax: '', since: '', until: '' })
const edited = ref(new Set<string>())

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
    // A refresh only re-syncs the figures when no edit is waiting to save.
    if (edited.value.size === 0) resetFields()
  },
  { immediate: true },
)

/* ---------- live math — mirrors TotalLossInvoice.Compute on the server ----------
   Storage days are inclusive of both endpoints; an open-ended range accrues through
   today; tax rounds half away from zero. */

/* Figures are parsed strictly (utils/amount): "-50" or "1e6" is an error under the
   invoice, never a silent 50 / 16, and nothing saves while any figure is invalid. */

const parsed = computed(() => ({
  admin: parseMoney(f.value.admin, 'Admin fee'),
  lot: parseMoney(f.value.lot, 'Lot / gate fee'),
  perDay: parseMoney(f.value.perDay, 'Storage per day'),
  tax: parsePercent(f.value.tax, 'Sales tax'),
}))
type Figure = keyof typeof parsed.value

/** Today on the user's own calendar, yyyy-mm-dd — the latest day storage can end. */
function localToday(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
const today = ref(localToday())

const errors = computed(() => {
  const out: Partial<Record<Figure | 'until', string>> = {}
  for (const [k, p] of Object.entries(parsed.value)) if (p.error) out[k as Figure] = p.error
  // A future end date would bill days that haven't happened yet.
  if (f.value.until && f.value.until > today.value)
    out.until =
      "Storage can't end in the future. Leave \"Storage ends\" empty while the car is on your lot; it accrues through today."
  return out
})
const hasErrors = computed(() => Object.keys(errors.value).length > 0)
/** The typed figure as a number — 0 when empty or invalid (invalid never saves). */
function val(k: Figure): number {
  return parsed.value[k].value ?? 0
}

function utcDay(dateStr: string): number | null {
  if (!dateStr) return null
  const t = Date.parse(`${dateStr}T00:00:00Z`)
  return Number.isNaN(t) ? null : Math.floor(t / 86400000)
}

const live = computed(() => {
  const admin = val('admin')
  const lot = val('lot')
  const rate = val('perDay')
  const start = utcDay(f.value.since)
  let days = 0
  if (start !== null && rate > 0) {
    const end = utcDay(f.value.until) ?? Math.floor(Date.now() / 86400000)
    days = Math.max(0, end - start + 1)
  }
  const storage = days * rate
  const subtotal = admin + lot + storage
  const taxPct = val('tax')
  // Server rounds tax in integer cents, half away from zero: round(subtotalCents · pct/100).
  const tax = Math.round(subtotal * taxPct) / 100
  return { days, storage, subtotal, taxPct, tax, total: subtotal + tax }
})
/** The native date input only opens its calendar from the tiny picker icon; make the
 *  whole chip (icon included) open it. showPicker needs a user gesture — a click is one. */
function openPicker(e: MouseEvent) {
  const input = (e.currentTarget as HTMLElement).querySelector('input')
  if (!input || e.target === input) return
  try { input.showPicker() } catch { input.focus() }
}
/** Why storage bills nothing — named precisely, never a generic "set the date". */
const storageIssue = computed<string | null>(() => {
  const start = utcDay(f.value.since)
  const end = utcDay(f.value.until)
  const todayDay = Math.floor(Date.now() / 86400000)
  if (start === null) return 'no start date (set "Storage since")'
  if (val('perDay') <= 0) return 'the daily rate is $0 (enter your storage rate)'
  if (start > todayDay) return 'the start date is in the future'
  if (end !== null && end < start) return 'the end date is before the start date'
  return live.value.days === 0 ? 'no storage days in the date range' : null
})
const storageMissing = computed(() => storageIssue.value !== null)
const emitTotal = defineModel<number | null>('liveTotal')
// While a figure is invalid the header keeps the last saved balance.
watch(
  [live, hasErrors],
  ([v, bad]) => (emitTotal.value = bad ? (props.invoice?.total ?? null) : v.total),
  { immediate: true },
)
const emitIssue = defineModel<string | null>('storageIssue')
watch(storageIssue, (v) => (emitIssue.value = v), { immediate: true })

/* ---------- debounced auto-save ---------- */

const saving = ref(false)
const savedFlash = ref(false)
const saveError = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function touched(field: string) {
  edited.value = new Set(edited.value).add(field)
  clearTimeout(timer)
  timer = setTimeout(save, 800)
}
onBeforeUnmount(() => clearTimeout(timer))

function optOverride(field: Figure, original: number | null): number | null {
  if (!edited.value.has(field)) return original
  return parsed.value[field].value
}

async function save() {
  // Invalid figures stay on screen with their message; nothing is sent until they're fixed.
  if (hasErrors.value) return
  saving.value = true
  saveError.value = null
  const d = props.detail
  const body = caseBodyFromDetail(d)
  body.adminFee = optOverride('admin', d.adminFee)
  body.lotFee = optOverride('lot', d.lotFee)
  body.salesTaxPercent = optOverride('tax', d.salesTaxPercent)
  body.storagePerDay = edited.value.has('perDay') ? val('perDay') : d.storagePerDayCents / 100
  if (edited.value.has('since')) body.storageStartDate = f.value.since || null
  if (edited.value.has('until')) body.storageEndDate = f.value.until || null
  try {
    await updateCase(shopId.value, caseId.value, body)
    edited.value = new Set()
    savedFlash.value = true
    setTimeout(() => (savedFlash.value = false), 1600)
    emit('refresh')
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'Save failed.'
  } finally {
    saving.value = false
  }
}

/* ---------- PDF ---------- */

const pdfBusy = ref(false)
async function onPdf() {
  pdfBusy.value = true
  saveError.value = null
  try {
    await downloadInvoicePdf(shopId.value, caseId.value, props.detail.case.customerName)
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'PDF download failed.'
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

    <div class="lines">
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
          <span class="datefield" @click="openPicker">
            <CalendarDays :size="13" aria-hidden="true" />
            <input v-model="f.since" class="blank date" type="date" aria-label="In shop since" @input="touched('since')" />
          </span>
          <template v-if="!storageMissing">
            · <span class="mono days">{{ live.days }}</span>&nbsp;days ·
          </template>
          <template v-else> · </template>
          $ <input v-model="f.perDay" class="blank rate" :class="{ invalid: errors.perDay }" :aria-invalid="!!errors.perDay" inputmode="decimal" aria-label="Storage per day, dollars"
            @input="touched('perDay')" /> /day
        </span>
        <span class="val mono">{{ errors.perDay || errors.until ? '—' : usd(live.storage) }}</span>
      </div>
      <div class="line sub">
        <span class="desc">
          Storage ends
          <span class="datefield" @click="openPicker">
            <CalendarDays :size="13" aria-hidden="true" />
            <input v-model="f.until" class="blank date" :class="{ invalid: errors.until }" :aria-invalid="!!errors.until" type="date" :max="today" aria-label="Storage ends (optional)"
              @input="touched('until')" />
          </span>
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
        <span class="val mono">{{ hasErrors ? '—' : usd(live.tax) }}</span>
      </div>
      <div class="line total">
        <span class="desc">Total recovery balance</span>
        <span class="val mono">{{ hasErrors ? '—' : usd(live.total) }}</span>
      </div>
    </div>

    <div v-if="hasErrors" class="field-errs" role="alert">
      <p v-for="(msg, k) in errors" :key="k" class="field-err">{{ msg }}</p>
      <p class="field-err-note">Nothing is saved until the figure is fixed.</p>
    </div>

    <p v-if="saveError" class="error-text">{{ saveError }}</p>

    <div class="inv-foot">
      <span class="hint">
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
.blank.date {
  width: 124px;
  text-align: left;
  font-size: 13px;
  padding-left: 4px;
}
/* Dates are the one figure people don't guess is editable — keep them looking like a
   field at all times, with a calendar glyph that opens the picker. The native picker
   icon follows the theme's color-scheme (a forced dark scheme drew it white on the light
   theme's white field). */
.datefield {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0 2px;
  padding-left: 7px;
  border-radius: 6px;
  background: var(--bg-raised);
  outline: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  transition: outline-color 0.12s;
}
.datefield:hover,
.datefield:focus-within {
  outline: 1.5px solid var(--accent);
}
.datefield .blank.date {
  outline: none;
  background: transparent;
  cursor: pointer;
}
.datefield .blank.date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.7;
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
