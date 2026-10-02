import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { initSentry } from './analytics/sentry'
import { watchForNewBuild } from './utils/freshBuild'

// A tab left open across a deploy references chunk files that no longer exist; the next
// navigation would then fail to load its page. Reload once to pick up the fresh build.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'dsm_reloaded_for_deploy'
  if (sessionStorage.getItem(KEY)) return // avoid a reload loop
  sessionStorage.setItem(KEY, '1')
  window.location.reload()
})
router.afterEach(() => sessionStorage.removeItem('dsm_reloaded_for_deploy'))
// A tab that never hits a missing chunk (left on one page, restored by the phone) still
// moves to the newest build — see utils/freshBuild.
watchForNewBuild(router)

const app = createApp(App)
app.use(createPinia())
app.use(router)
// Dormant unless VITE_SENTRY_DSN is set; loads as its own chunk on the first signed-in page.
void initSentry(app)
router.afterEach(() => void initSentry(app))
app.mount('#app')
