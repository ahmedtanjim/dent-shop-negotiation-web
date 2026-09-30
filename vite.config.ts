import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * The production CSP lives in public/staticwebapp.config.json and is strict by default.
 * Analytics hosts are added to the BUILT copy only when the matching env var is set, so a
 * build without GA/Sentry keeps the strict policy byte-for-byte:
 *  - VITE_GA_MEASUREMENT_ID → gtag.js from googletagmanager.com; hits to google-analytics.com
 *  - VITE_SENTRY_DSN        → the DSN's ingest host (the SDK itself is bundled — no script host)
 */
function analyticsCsp(env: Record<string, string>): Plugin {
  const add: Record<string, string[]> = { 'script-src': [], 'connect-src': [], 'img-src': [] }
  if (env.VITE_GA_MEASUREMENT_ID?.trim()) {
    add['script-src'].push('https://www.googletagmanager.com')
    add['connect-src'].push(
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://www.googletagmanager.com',
    )
    add['img-src'].push('https://*.google-analytics.com', 'https://www.googletagmanager.com')
  }
  const dsn = env.VITE_SENTRY_DSN?.trim()
  if (dsn) {
    try {
      add['connect-src'].push(new URL(dsn).origin)
    } catch {
      throw new Error('VITE_SENTRY_DSN is not a valid URL')
    }
  }
  let outDir = 'dist'
  return {
    name: 'analytics-csp',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, 'staticwebapp.config.json')
      if (!existsSync(file) || Object.values(add).every((v) => v.length === 0)) return
      const config = JSON.parse(readFileSync(file, 'utf8'))
      const csp: string = config.globalHeaders['Content-Security-Policy']
      config.globalHeaders['Content-Security-Policy'] = csp
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const [name] = d.split(/\s+/)
          return add[name]?.length ? `${d} ${add[name].join(' ')}` : d
        })
        .join('; ')
      writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue(), analyticsCsp(env)],
    server: {
      port: 5174,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
