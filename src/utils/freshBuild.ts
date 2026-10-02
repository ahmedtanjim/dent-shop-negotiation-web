import type { Router } from 'vue-router'

/** A tab can outlive the build it was loaded from: a phone browser restores a tab from
 *  weeks ago without reloading it, and the visitor sees screens that have since changed
 *  (e.g. a sign-in page that no longer matches what we tell them). Each deploy changes
 *  the hashed entry script in index.html, so comparing ours with the live one tells us
 *  a newer build is out. Once it is, the next in-app navigation becomes a full page
 *  load, and a tab coming back to the foreground on a sign-in page reloads straight away
 *  (nothing typed there is worth keeping). */

/** Public pages that hold no typed work — safe to reload under the visitor. */
const RELOAD_NOW = new Set(['welcome', 'login', 'not-found'])
const CHECK_EVERY_MS = 10 * 60_000

function entryScript(doc: ParentNode): string | null {
  const el = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
  return el ? new URL(el.getAttribute('src')!, location.origin).pathname : null
}

const ours = entryScript(document) // null in dev (Vite serves /src/main.ts)
let stale = false
let live: string | null = null
let lastCheck = 0

async function check(): Promise<boolean> {
  if (!ours || stale || Date.now() - lastCheck < 30_000) return stale
  lastCheck = Date.now()
  try {
    const r = await fetch('/index.html', { cache: 'no-store' })
    if (!r.ok) return false
    live = entryScript(new DOMParser().parseFromString(await r.text(), 'text/html'))
    stale = live !== null && live !== ours
  } catch {
    // offline or blocked: try again next time
  }
  return stale
}

export function watchForNewBuild(router: Router): void {
  if (!ours) return

  router.beforeEach((to, from) => {
    // The first navigation is the page load itself; after that, a stale build hands the
    // navigation to the browser so the new page comes from the new build.
    if (stale && from.matched.length) {
      window.location.assign(to.fullPath)
      return false
    }
  })

  const onForeground = async () => {
    if (document.visibilityState !== 'visible') return
    if (!(await check()) || !RELOAD_NOW.has(router.currentRoute.value.name as string)) return
    // Once per new build, in case a cache keeps handing back the old page.
    const KEY = 'dsm_reloaded_for_build'
    if (sessionStorage.getItem(KEY) === live) return
    sessionStorage.setItem(KEY, live!)
    window.location.reload()
  }
  document.addEventListener('visibilitychange', onForeground)
  // Restored from the back/forward cache: the page never reloaded.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) void onForeground()
  })
  window.setInterval(() => void check(), CHECK_EVERY_MS)
  // A tab reopened from the browser's cache runs this build's boot code again.
  void router.isReady().then(onForeground)
}
