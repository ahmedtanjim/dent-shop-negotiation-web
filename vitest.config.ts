import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Unit tests (`npm test`): pure helpers, stores and a few views, in happy-dom. Test files sit
// next to the code as `*.test.ts`, so `vue-tsc -b` type-checks them with the app.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    // A test may put the app's <script type="module" src="/assets/…"> in the page; never
    // load it (and don't log the refusal).
    environmentOptions: { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } } },
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
