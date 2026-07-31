/**
 * Executes the real production bundle in jsdom and asserts React mounts.
 *
 * A successful `vite build` only proves the code type-checks and bundles — it
 * does not run it. This loads the emitted JS into a DOM and confirms the app
 * actually mounts, catching runtime faults a build misses: undefined globals,
 * bad hook order, a broken import, a component that throws on first render.
 *
 * Run after building:
 *     npm run build && node scripts/render-check.mjs
 * Exit code: 0 = rendered cleanly, 1 = failed.
 */
import { JSDOM, VirtualConsole } from 'jsdom'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')

const errors = []
const vc = new VirtualConsole()
vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`))
vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`))

const assets = readdirSync(join(BUILD, 'assets'))
const jsFile = assets.find((f) => f.endsWith('.js'))
const cssFile = assets.find((f) => f.endsWith('.css'))
if (!jsFile) {
  console.error('No JS bundle in build/assets — run `npm run build` first.')
  process.exit(1)
}
const js = readFileSync(join(BUILD, 'assets', jsFile), 'utf8')

const dom = new JSDOM(
  `<!doctype html><html><head><title>31</title></head>
   <body><div id="root"></div></body></html>`,
  {
    url: 'http://localhost:3000/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  },
)

// The bundle is an ES module referencing import.meta.env (Vite); jsdom can't
// evaluate those, so neutralise them before injecting.
const script = dom.window.document.createElement('script')
script.textContent = js
  .replace(/import\.meta\.env\.[A-Z_]+/g, 'undefined')
  .replace(/import\.meta\.env/g, '({})')

try {
  dom.window.document.body.appendChild(script)
} catch (e) {
  errors.push(`throw during evaluation: ${e.message}`)
}

await new Promise((r) => setTimeout(r, 600))

const root = dom.window.document.getElementById('root')
const html = root?.innerHTML ?? ''
const text = root?.textContent ?? ''

console.log(`\nbundle: ${jsFile}  (${(js.length / 1024).toFixed(0)} kB)`)
console.log(`css:    ${cssFile}`)
console.log(`\n#root children: ${root?.children.length ?? 0}`)
console.log(`rendered text:  ${JSON.stringify(text.slice(0, 160))}`)

const checks = [
  ['React mounted content into #root', html.length > 50],
  ['main menu heading rendered', text.includes('31')],
  ['mode cards rendered', text.includes('Local Game') && text.includes('Online Multiplayer')],
  ['CTA buttons rendered', text.includes('Play Now')],
  ['no runtime errors', errors.length === 0],
]

console.log('')
let ok = true
for (const [label, pass] of checks) {
  ok &&= pass
  console.log(`  ${pass ? '✓' : '✗'} ${label}`)
}
if (errors.length) {
  console.log('\nErrors captured:')
  errors.forEach((e) => console.log('   ' + e))
}
console.log(`\n${ok ? 'RENDER OK' : 'RENDER FAILED'}\n`)
process.exit(ok ? 0 : 1)
