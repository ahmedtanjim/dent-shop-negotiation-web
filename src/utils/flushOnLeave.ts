import { onBeforeUnmount } from 'vue'

/**
 * Pending edits are SAVED when the user leaves, never dropped (NEG-6). Covers the three
 * ways out of a page:
 *  - in-app navigation / the component unmounting → flush right away;
 *  - the tab being hidden (switching apps on a phone, closing the tab) → flush with a
 *    keepalive request, which the browser finishes even as the page goes away;
 *  - closing/reloading the tab → flush (keepalive) AND ask the browser to confirm, in case
 *    the save doesn't make it.
 * `flush(keepalive)` must be a no-op when there is nothing to save.
 */
export function useFlushOnLeave(hasPending: () => boolean, flush: (keepalive: boolean) => void) {
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!hasPending()) return
    flush(true)
    e.preventDefault()
    // Legacy browsers need returnValue set to show the prompt.
    e.returnValue = ''
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden' && hasPending()) flush(true)
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('visibilitychange', onVisibility)
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('visibilitychange', onVisibility)
    if (hasPending()) flush(false)
  })
}
