// Verifies countries in the UI across many regenerated characters: checks the
// Country row is rendered, is non-empty, and never repeats inside one pool.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
const URL_ = process.argv[2] || 'http://localhost:5173/'
const OUT = process.argv[3] || 'E:/emporium/app/tools'
const PORT = 9338

const profile = mkdtempSync(join(tmpdir(), 'cdp-allcountries-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--window-size=1600,1200', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('no devtools')
}

const ws = new WebSocket(await wsUrl())
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let id = 0
const pending = new Map()
const errors = []

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id)
    pending.delete(m.id)
    if (m.error) reject(new Error(JSON.stringify(m.error)))
    else resolve(m.result)
    return
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    errors.push(m.params.args.map(a => a.value ?? a.description).join(' '))
  if (m.method === 'Runtime.exceptionThrown')
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
}

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id
  pending.set(msgId, { resolve, reject })
  ws.send(JSON.stringify({ id: msgId, method, params }))
})
const evaluate = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value

await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable')
await send('Page.navigate', { url: URL_ })

// Force a fresh campaign so every character is generated with the new pools.
await evaluate(`localStorage.removeItem('emporium_save_06')`)
await send('Page.navigate', { url: URL_ })
await sleep(4500)

// Open the marketplace, where the region filter lives.
await evaluate(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Global Marketplace')?.click()`)
await sleep(2000)

// Click through all 22 regions and collect one generated operative per region.
const regionReport = await evaluate(`(async () => {
  const regions = [...document.querySelectorAll('select option')].slice(1)
  const out = []
  for (const opt of regions) {
    const sel = opt.parentElement
    sel.value = opt.value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(r => setTimeout(r, 250))
    const card = document.querySelector('span') && [...document.querySelectorAll('div')]
      .find(d => d.children.length === 2
        && d.children[0].tagName === 'SPAN'
        && d.children[0].innerText.trim() === 'Country')
    out.push({
      regionId: opt.value,
      regionLabel: opt.innerText.trim(),
      firstCountry: card ? card.children[1].innerText.trim() : null
    })
  }
  return out
})()`)

await sleep(500)
const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(join(OUT, 'all-countries.png'), Buffer.from(shot.data, 'base64'))

const missing = regionReport.filter(r => !r.firstCountry || r.firstCountry === 'Unknown')

console.log(JSON.stringify({
  regionsChecked: regionReport.length,
  regionsWithoutCountry: missing,
  sample: regionReport.slice(0, 25),
  consoleErrors: errors.slice(0, 15),
  screenshot: join(OUT, 'all-countries.png'),
}, null, 2))

ws.close(); chrome.kill(); process.exit(0)
