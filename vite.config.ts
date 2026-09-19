import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The app lives under /app/ — the static marketing site (./site, Astro) owns the root of
// ai.dentshopmanager.com. `npm run build:all` builds both into ./dist.
export default defineConfig({
  base: '/app/',
  plugins: [vue()],
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
