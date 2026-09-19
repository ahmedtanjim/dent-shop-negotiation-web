import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('@/views/WelcomeView.vue'),
      meta: { public: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { public: true },
    },
    {
      // The paywall: shops below the AI tier land here instead of their cases. Also
      // where Stripe sends the owner back (?status=success) to unlock the app.
      path: '/upgrade',
      name: 'paywall',
      component: () => import('@/views/PaywallView.vue'),
    },
    {
      path: '/',
      name: 'cases',
      component: () => import('@/views/CasesView.vue'),
    },
    {
      path: '/cases/:id',
      name: 'case',
      component: () => import('@/views/CaseWorkspaceView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.public) {
    if (auth.isAuthed) return { name: 'cases' }
    return true
  }
  if (!auth.isAuthed) {
    // Cold visitors to the root get the marketing landing page; deep links go to login.
    if (to.fullPath === '/') return { name: 'welcome' }
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // The plan gate. Read once per shop (fail-open on error — the API's 402 is the real
  // gate); below the AI tier every page becomes the paywall, and an AI shop that lands
  // on the paywall by an old link goes straight through. Stripe's return (?status=…)
  // always renders the paywall so it can confirm the switch and redirect itself.
  const ent = useEntitlementStore()
  await ent.load(auth.shopId!)
  if (to.name === 'paywall') {
    if (ent.isAi && !to.query.status) {
      const back = typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/') ? to.query.redirect : '/'
      return back
    }
    return true
  }
  if (!ent.isAi) {
    return { name: 'paywall', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  return true
})

export default router
