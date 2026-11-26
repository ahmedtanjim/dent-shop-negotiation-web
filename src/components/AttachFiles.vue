<script setup lang="ts">
import { computed, ref } from 'vue'
import { Paperclip, X, Upload } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { uploadDocument } from '@/api/negotiation'
import type { NegDocument } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { tooLargeMessage } from '@/utils/uploads'
import { MAX_ATTACHED_FILES, attachableKind, toggleAttached } from '@/utils/attachments'

/** Files for the assistant to read with a question (Ask AI) or with feedback on a draft
 *  (owner 2026-11-26). Always the case's own documents: pick from the case's uploads, or upload
 *  a new one here, which also adds it to the case's documents. The API reads them; this only
 *  keeps the chosen ids. */
const props = defineProps<{
  documents: NegDocument[]
  caseId: string
  /** unique on the page: ties the list to its button */
  id: string
  disabled?: boolean
}>()
const chosen = defineModel<string[]>({ required: true })
const emit = defineEmits<{ uploaded: [doc: NegDocument] }>()

const auth = useAuthStore()
const open = ref(false)
const uploading = ref(false)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
/** Uploaded here but not yet in the case the parent re-reads. */
const fresh = ref<NegDocument[]>([])

const all = computed(() => {
  const ids = new Set(props.documents.map((d) => d.id))
  return [...props.documents, ...fresh.value.filter((d) => !ids.has(d.id))]
})
const picked = computed(() => all.value.filter((d) => chosen.value.includes(d.id)))
const full = computed(() => chosen.value.length >= MAX_ATTACHED_FILES)

function toggle(doc: NegDocument) {
  error.value = null
  chosen.value = toggleAttached(chosen.value, doc.id)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = tooLargeMessage(file) ?? (attachableKind(file.name, file.type) ? null
    : 'The assistant reads PDFs, photos (JPEG, PNG, GIF, WebP) and text files such as a saved email.')
  if (error.value || full.value) return
  uploading.value = true
  try {
    const doc = await uploadDocument(auth.shopId as string, props.caseId, file)
    fresh.value = [...fresh.value, doc]
    chosen.value = toggleAttached(chosen.value, doc.id)
    emit('uploaded', doc)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'That file could not be uploaded. Try again.'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="af">
    <div class="af-row">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        :aria-expanded="open"
        :aria-controls="`af-list-${id}`"
        :disabled="disabled"
        @click="open = !open"
      >
        <Paperclip :size="14" aria-hidden="true" /> Attach files
      </button>
      <ul v-if="picked.length" class="af-chips" aria-label="Attached files">
        <li v-for="d in picked" :key="d.id" class="af-chip">
          <span class="af-name">{{ d.fileName }}</span>
          <button
            type="button"
            class="af-x"
            :aria-label="`Remove ${d.fileName}`"
            :disabled="disabled"
            @click="toggle(d)"
          >
            <X :size="12" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>
    <div v-show="open" :id="`af-list-${id}`" class="af-panel">
      <p class="af-hint">
        Pick files from this case for the assistant to read (up to {{ MAX_ATTACHED_FILES }}). A file you upload here
        is also kept with the case's documents.
      </p>
      <ul v-if="all.length" class="af-list">
        <li v-for="d in all" :key="d.id">
          <label class="af-pick">
            <input
              type="checkbox"
              :checked="chosen.includes(d.id)"
              :disabled="disabled || (full && !chosen.includes(d.id)) || !attachableKind(d.fileName, d.contentType)"
              @change="toggle(d)"
            />
            <span class="af-name">{{ d.fileName }}</span>
            <span v-if="!attachableKind(d.fileName, d.contentType)" class="af-cant">can't be read</span>
          </label>
        </li>
      </ul>
      <p v-else class="af-hint">This case has no documents yet.</p>
      <input
        ref="fileInput"
        type="file"
        class="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.eml,.csv,.md"
        tabindex="-1"
        aria-hidden="true"
        @change="onFile"
      />
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        :disabled="disabled || uploading || full"
        @click="fileInput?.click()"
      >
        <span v-if="uploading" class="spinner"></span>
        <Upload v-else :size="14" aria-hidden="true" />
        {{ uploading ? 'Uploading…' : 'Upload a file' }}
      </button>
      <p v-if="full" class="af-hint" role="status">That's the most files one message can carry.</p>
      <p v-if="error" class="error-text af-error" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.af-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.af-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}
.af-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 4px 2px 10px;
  font-size: 12px;
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.af-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.af-x {
  appearance: none;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
}
.af-x:hover {
  color: var(--text);
}
.af-panel {
  margin-top: 8px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.af-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
}
.af-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.af-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  min-width: 0;
}
.af-cant {
  font-size: 11.5px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.af-error {
  margin: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
