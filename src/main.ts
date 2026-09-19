import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// Old links (/cases/…, /login) predate the /app/ mount; the Static Web App falls back to
// this bundle for them, so carry them into the app. /welcome was the old in-app landing.
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
if (base && !window.location.pathname.startsWith(base)) {
  const { pathname, search } = window.location
  window.location.replace(pathname.startsWith('/welcome') ? '/' : `${base}${pathname}${search}`)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
