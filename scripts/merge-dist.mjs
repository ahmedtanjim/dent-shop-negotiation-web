// Lays the static site (site/dist) over ./dist next to the Vue bundle (./dist/app) so one
// Static Web App serves both: "/" is the marketing page, "/app/…" is the Negotiator.
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const from = resolve('site/dist')
const to = resolve('dist')
if (!existsSync(from)) throw new Error('site/dist is missing — run `npm run build:site` first')
if (!existsSync(resolve(to, 'app/index.html'))) throw new Error('dist/app is missing — run `npm run build` first')
cpSync(from, to, { recursive: true })
console.log('merged site/dist into dist/ (app stays under dist/app)')
