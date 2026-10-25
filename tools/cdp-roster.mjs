// Verifies the roster now renders three columns per card.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || "E:/emporium/app/tools";
const PORT = 9336;

const profile = mkdtempSync(join(tmpdir(), "cdp-roster-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--window-size=1600,1200",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const page = (
        await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      ).find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("no devtools");
}

const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
const errors = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
    return;
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown")
    errors.push(
      m.params.exceptionDetails.exception?.description ||
        m.params.exceptionDetails.text,
    );
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const evaluate = async (expr) =>
  (
    await send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
  ).result?.value;

await send("Runtime.enable");
await send("Network.enable");
await send("Page.enable");
await send("Page.navigate", { url: URL_ });
await sleep(4500);

// open the roster tab
await evaluate(
  `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Emporium Roster')?.click()`,
);
await sleep(2000);

const report = await evaluate(`(() => {
  const card = document.querySelector('select[class*="font-mono"]')?.closest('div.grid')
  const grid = card?.parentElement
  if (!grid) return { error: 'roster grid not found' }
  const cols = [...grid.children]
  const venue = grid.querySelector('select')
  const sell = [...grid.querySelectorAll('button')].find(b => b.innerText.includes('Transfer'))
  return {
    gridClass: grid.className,
    gridColumns: getComputedStyle(grid).gridTemplateColumns,
    cardCount: grid.children.length,
    cardColumns: cols.length,
    columnWidths: cols.map(c => Math.round(c.getBoundingClientRect().width)),
    col1Text: cols[0]?.innerText.replace(/\\n/g, ' | '),
    col2Text: cols[1]?.innerText.replace(/\\n/g, ' | '),
    hasVenueSelect: !!venue,
    venueOptions: venue ? [...venue.options].map(o => o.value) : [],
    hasSellButton: !!sell,
    col3HasImg: !!cols[2]?.querySelector('img'),
    col3ImgSrc: cols[2]?.querySelector('img')?.getAttribute('src'),
    col3ImgLoaded: (() => { const i = cols[2]?.querySelector('img'); return i ? i.complete && i.naturalWidth > 0 : false })(),
  }
})()`);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "roster-3col.png"), Buffer.from(shot.data, "base64"));

console.log(
  JSON.stringify(
    {
      ...report,
      consoleErrors: errors.slice(0, 15),
      screenshot: join(OUT, "roster-3col.png"),
    },
    null,
    2,
  ),
);
ws.close();
chrome.kill();
process.exit(0);
