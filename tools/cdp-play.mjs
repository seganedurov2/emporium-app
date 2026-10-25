// Drives the running game: clicks every tab, advances a week, screenshots.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9334;

const profile = mkdtempSync(join(tmpdir(), "cdp-play-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--window-size=1600,1100",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await r.json()).find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("DevTools endpoint never came up");
}

const ws = new WebSocket(await getWsUrl());
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
const errors = [];
const httpErrors = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
    return;
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(
      m.params.exceptionDetails.exception?.description ||
        m.params.exceptionDetails.text,
    );
  }
  if (
    m.method === "Network.responseReceived" &&
    m.params.response.status >= 400
  ) {
    httpErrors.push(
      `HTTP ${m.params.response.status} ${m.params.response.url}`,
    );
  }
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
await sleep(4000);

const clickByText = async (text) => {
  const ok = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)})
    if (!b) return false
    b.click(); return true
  })()`);
  await sleep(1200);
  return ok;
};

const results = {};
const tabs = [
  "Global Marketplace",
  "Emporium Roster",
  "Trade Caravans",
  "Beauty Salon & Services",
  "VIP Contracts",
  "Finances & Loans",
  "World Regions",
  "Command Center",
];

for (const tab of tabs) {
  const clicked = await clickByText(tab);
  const info = await evaluate(`({
    imgs: document.querySelectorAll('img').length,
    broken: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 8),
    sampleSrc: document.querySelector('img')?.getAttribute('src') || null,
    text: document.body.innerText.slice(0, 260)
  })`);
  results[tab] = { clicked, ...info };
}

// Back to dashboard and advance one week for real
await clickByText("Command Center");
const weekBefore = await evaluate(
  `document.body.innerText.match(/Week (\\d+)/)?.[1]`,
);
await clickByText("Advance Week");
await sleep(2000);
const weekAfter = await evaluate(
  `document.body.innerText.match(/Week (\\d+)/)?.[1]`,
);
const modal = await evaluate(`document.body.innerText.slice(0, 200)`);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "game.png"), Buffer.from(shot.data, "base64"));

console.log(
  JSON.stringify(
    {
      tabs: results,
      advanceWeek: { weekBefore, weekAfter, topOfScreen: modal },
      consoleErrors: errors.slice(0, 20),
      httpErrors: httpErrors.slice(0, 20),
      screenshot: join(OUT, "game.png"),
    },
    null,
    2,
  ),
);

ws.close();
chrome.kill();
process.exit(0);
