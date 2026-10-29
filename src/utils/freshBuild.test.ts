import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

// A stale tab turns the next in-app navigation into a full page load. That load must stay on
// this app even for a route built from a crafted link.

async function staleApp() {
  // The build this tab was loaded from …
  document.body.innerHTML = '<script type="module" src="/assets/index-OLD.js"></script>'
  // … and the one that is live now.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => '<script type="module" src="/assets/index-NEW.js"></script>' })),
  )
  vi.resetModules()
  const { watchForNewBuild } = await import('./freshBuild')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
      { path: '/:rest(.*)*', name: 'any', component: { render: () => null } },
    ],
  })
  const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  watchForNewBuild(router)
  await router.push('/')
  // Coming back to the tab checks the live index.html and finds the newer build.
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
  await new Promise((r) => setTimeout(r, 0))
  return { router, assign }
}

describe('watchForNewBuild', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('reloads the page the user was going to', async () => {
    const { router, assign } = await staleApp()
    await router.push('/cases/1?tab=letters#draft')
    expect(assign).toHaveBeenLastCalledWith('/cases/1?tab=letters#draft')
  })

  it('never turns the reload into a trip to another site', async () => {
    const { router, assign } = await staleApp()
    // Same origin for new URL(), but the pathname is '//evil.test' — protocol-relative.
    await router.push('/.//evil.test')
    expect(assign).toHaveBeenLastCalledWith('/')
    await router.push('//evil.test/x')
    expect(assign).toHaveBeenLastCalledWith('/')
  })
})
