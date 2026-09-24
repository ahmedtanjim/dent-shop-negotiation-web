<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarDays, X } from 'lucide-vue-next'

/**
 * A date (or date + time) field that always reads in US format — "Sep 1, 2026" — no matter
 * the computer's regional settings. The native input still does the work (picker,
 * keyboard entry, screen-reader value); it sits invisibly on top of the formatted text,
 * which a native date input can't be told to use (it follows the OS locale: dd/mm/yyyy).
 */
const model = defineModel<string>({ default: '' })
const props = withDefaults(
  defineProps<{
    type?: 'date' | 'datetime-local'
    variant?: 'field' | 'chip'
    label: string
    max?: string
    min?: string
    invalid?: boolean
    clearable?: boolean
    placeholder?: string
  }>(),
  { type: 'date', variant: 'field', clearable: false },
)
const emit = defineEmits<{ input: [] }>()
const input = ref<HTMLInputElement | null>(null)
/* Typing goes into the native segments, whose order follows the OS (dd/mm on some
   machines) — so while someone types, the real control is shown; on blur the US-format
   text comes back. Mouse users pick from the calendar and never see the native text. */
const typing = ref(false)
function onKeydown(e: KeyboardEvent) {
  if (!['Tab', 'Shift', 'Escape', 'Enter'].includes(e.key)) typing.value = true
}

const display = computed(() => {
  const v = model.value
  if (!v) return props.placeholder ?? (props.type === 'date' ? 'mm/dd/yyyy' : 'mm/dd/yyyy, --:--')
  if (props.type === 'date') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return v
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const d = new Date(v) // "YYYY-MM-DDTHH:mm" is local time
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
})

function openPicker() {
  const el = input.value
  if (!el) return
  try {
    el.showPicker()
  } catch {
    el.focus()
  }
}

function clear() {
  model.value = ''
  emit('input')
}
</script>

<template>
  <span class="df" :class="[variant, { invalid, empty: !model, typing }]" @click="openPicker">
    <CalendarDays :size="13" class="df-icon" aria-hidden="true" />
    <span class="df-text" aria-hidden="true">{{ display }}</span>
    <input
      ref="input"
      v-model="model"
      class="df-input"
      :type="type"
      :max="max"
      :min="min"
      :aria-label="label"
      :aria-invalid="invalid || undefined"
      @input="emit('input')"
      @keydown="onKeydown"
      @blur="typing = false"
    />
    <button
      v-if="clearable && model"
      type="button"
      class="df-clear"
      :aria-label="`Clear ${label}`"
      @click.stop="clear"
    >
      <X :size="12" />
    </button>
  </span>
</template>

<style scoped>
.df {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--text);
  background: var(--bg-raised);
  border-radius: var(--radius-sm);
  outline: 1px solid var(--border);
  transition: outline-color 0.12s;
  font-variant-numeric: tabular-nums;
  /* inside a form's <label class="field"> it must not inherit the label-caption look */
  margin: 0;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
}
.df.field {
  display: flex;
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
}
.df.chip {
  margin: 0 2px;
  padding: 3px 8px 3px 7px;
  font-size: 13px;
  border-radius: 6px;
}
.df:hover,
.df:focus-within {
  outline: 1.5px solid var(--accent);
}
.df.invalid {
  outline: 1.5px solid var(--danger);
}
.df.empty .df-text {
  color: var(--text-faint);
}
.df-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.df-text {
  flex: 1;
  white-space: nowrap;
}
/* the real control: invisible, covering the whole field, so clicks and keys reach it */
.df-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: 0;
  padding: 0;
  margin: 0;
}
.df.typing .df-input {
  opacity: 1;
  background: transparent;
  color: var(--text);
  font: inherit;
  padding: 0 8px 0 26px;
  border-radius: inherit;
}
.df.typing .df-text {
  visibility: hidden;
}
.df.typing .df-input::-webkit-calendar-picker-indicator {
  display: none;
}
.df.chip {
  min-width: 132px;
}
.df-input::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.df-clear {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.df-clear:hover {
  color: var(--text);
  background: var(--border-soft);
}
</style>
