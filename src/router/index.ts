import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { SIGNUP_URL } from '@/api/handoff'
import { CRM_URL } from '@/api/client'

const router = createRouter({
  history: createWebHistory(),
  // /welcome#pricing lands on the pricing section; every other navigation starts at the top.
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 72 }
    return { top: 0 }
  },
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
      // One account for both apps: sign-up happens on the shop system, which brings
      // the new owner back here once the AI plan is on.
      path: '/register',
      name: 'register',
      redirect: () => {
        window.location.replace(SIGNUP_URL)
        return { name: 'login' }
      },
    },
    {
      // A session carried over from the shop system (?code=…&redirect=…).
      path: '/auth/handoff',
      name: 'handoff',
      component: () => import('@/views/HandoffView.vue'),
      meta: { handoff: true },
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
    {
      // The Terms of Service are shared with the shop system and live there.
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/NotFoundView.vue'), // never shown — the hop happens first
      meta: { anyone: true },
      beforeEnter: () => {
        window.location.replace(`${CRM_URL}/terms`)
        return false
      },
    },
    {
      // Prices are on the landing page; a signed-in shop sees its plan on /upgrade.
      path: '/pricing',
      name: 'pricing',
      redirect: () => {
        const auth = useAuthStore()
        return auth.isAuthed ? { name: 'paywall' } : { name: 'welcome', hash: '#pricing' }
      },
    },
    {
      // Typos, stale links and pages that don't exist (e.g. /privacy) say so plainly.
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { anyone: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.handoff) return true // exchanges its own code, signed in or not
  if (to.meta.anyone) return true // the 404 page and the /terms hop, signed in or not
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
    // An AI shop bounced here by an old ?redirect link goes straight on; one that opens
    // /upgrade on purpose sees "Your AI plan is active" instead of a silent redirect.
    if (ent.isAi && !to.query.status && typeof to.query.redirect === 'string') {
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
