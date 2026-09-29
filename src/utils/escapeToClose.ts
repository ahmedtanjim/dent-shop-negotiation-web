import { onBeforeUnmount, onMounted } from 'vue'

/** Escape closes the modal — unless the key was already handled inside it (an open
 *  customer-picker dropdown clears itself first) or an IME composition is in progress. */
export function useEscapeToClose(close: () => void) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return
    close()
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
