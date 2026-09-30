import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { initSentry } from './analytics/sentry'

const app = createApp(App)
app.use(createPinia())
app.use(router)
// Dormant unless VITE_SENTRY_DSN is set; loads as its own chunk on the first signed-in page.
void initSentry(app)
router.afterEach(() => void initSentry(app))
app.mount('#app')
