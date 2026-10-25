// Verifies the Country row appears in both marketplace and roster, and that the
// country actually belongs to the character's region.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || "E:/emporium/app/tools";
const PORT = 9337;

const profile = mkdtempSync(join(tmpdir(), "cdp-country-"));
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

const clickTab = async (label) => {
  await evaluate(
    `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(label)})?.click()`,
  );
  await sleep(1800);
};

// Pull "Country / Region" pairs out of every card on the current tab.
const readPairs = () =>
  evaluate(`(() => {
  const out = []
  for (const row of document.querySelectorAll('div')) {
    const spans = row.children
    if (spans.length === 2 && spans[0].tagName === 'SPAN' && spans[0].innerText.trim() === 'Country') {
      // the following sibling row is Region
      const next = row.nextElementSibling
      out.push({
        country: spans[1].innerText.trim(),
        region: next?.children?.[1]?.innerText.trim() || null,
        saved: JSON.parse(localStorage.getItem('emporium_save_06') || '{}')
      })
    }
  }
  return out.map(({ country, region }) => ({ country, region }))
})()`);

await send("Runtime.enable");
await send("Network.enable");
await send("Page.enable");
await send("Page.navigate", { url: URL_ });
await sleep(4500);

await clickTab("Global Marketplace");
const market = await readPairs();

await clickTab("Emporium Roster");
const roster = await readPairs();

// Cross-check against the source-of-truth: the saved campaign state.
const saved = await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('emporium_save_06') || '{}')
  const pick = (arr) => (arr || []).map(c => ({ name: c.name, region: c.region, regionName: c.regionName, country: c.country || null }))
  return { roster: pick(s.roster), market: pick(s.marketPool) }
})()`);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "country-check.png"), Buffer.from(shot.data, "base64"));

console.log(
  JSON.stringify(
    {
      marketCards: market.length,
      rosterCards: roster.length,
      marketPairs: market.slice(0, 5),
      rosterPairs: roster,
      savedRoster: saved.roster,
      savedMarket: saved.market.slice(0, 5),
      anyMissingCountry: [...saved.roster, ...saved.market].some(
        (c) => !c.country,
      ),
      consoleErrors: errors.slice(0, 15),
      screenshot: join(OUT, "country-check.png"),
    },
    null,
    2,
  ),
);

ws.close();
chrome.kill();
process.exit(0);
