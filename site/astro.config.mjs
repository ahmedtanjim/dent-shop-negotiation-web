// @ts-check
import { defineConfig } from 'astro/config'

// The marketing site for ai.dentshopmanager.com. Static HTML; the Vue app is served
// beside it under /app/ from the same Static Web App (see ../package.json build:all).
export default defineConfig({
  site: 'https://ai.dentshopmanager.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
})
