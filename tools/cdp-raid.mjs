// Verifies the caravan raid mini-event: forces a raid, screenshots the modal,
// picks "Fight", and reports the resulting state.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9335;

const profile = mkdtempSync(join(tmpdir(), "cdp-raid-"));
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
await send("Page.enable");

// Start a fresh campaign and seed a high-danger caravan, then force the raid roll.
await send("Page.navigate", { url: URL_ });
await sleep(3500);

const clickByText = async (text, wait = 1200) => {
  const ok = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)})
    if (!b) return false
    b.click(); return true
  })()`);
  await sleep(wait);
  return ok;
};

// Ensure we are in-game (start new campaign if on menu).
const inGame = await evaluate(`document.body.innerText.includes('Advance Week')`);
if (!inGame) {
  await clickByText("New Game");
  await clickByText("Launch Syndicate Empire");
  await sleep(1500);
}

// Seed a caravan into localStorage save.
const seeded = await evaluate(`(() => {
  const key = 'emporium_save_slot_1';
  const raw = localStorage.getItem(key);
  if (!raw) return 'no-save';
  const state = JSON.parse(raw);
  state.caravans = [{
    id: 'caravan_test',
    name: 'Raid Test Route',
    originRegion: 'Western Europe & Nordics',
    destRegion: 'Central Africa',
    leaderName: (state.roster && state.roster[0] && state.roster[0].name) || 'Leader',
    investment: 20000,
    potentialProfit: 30000,
    weeksTotal: 4,
    weeksRemaining: 3,
    status: 'traveling',
    raidResolved: false
  }];
  localStorage.setItem(key, JSON.stringify(state));
  return 'ok:roster=' + (state.roster ? state.roster.length : 0);
})()`);

// Reload so the seeded caravan is loaded, then re-enter the campaign.
await send("Page.navigate", { url: URL_ });
await sleep(3500);
await clickByText("Continue Campaign (Slot 1)", 2000);

// Bias Math.random low for the first N calls so the raid roll and success
// checks resolve deterministically, then fall back to the real generator.
const force = await evaluate(`(() => {
  const orig = Math.random;
  let n = 0;
  Math.random = function() {
    n++;
    if (n <= 200) return 0.01; // guaranteed raid spawn + successful resolution
    return orig();
  };
  return 'patched';
})()`);

// Go to Command Center and advance a week to trigger the raid roll.
await clickByText("Command Center", 800);

let raidSeen = false;
let raidText = "";
for (let i = 0; i < 6 && !raidSeen; i++) {
  // Dismiss any unrelated random-event modal lingering on screen.
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const ev = btns.find(b => b.innerText.trim().startsWith('Invest heavily') || b.innerText.trim().startsWith('Play it safe') || b.innerText.trim().startsWith('Pay the bribe') || b.innerText.trim().startsWith('Refuse'));
    if (ev) ev.click();
  })()`);
  await sleep(600);
  await clickByText("Advance Week", 2000);
  raidText = await evaluate(`document.body.innerText`);
  if (raidText.includes('Under Attack') || raidText.includes('Сражаться')) {
    raidSeen = true;
  }
}

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "raid-modal.png"), Buffer.from(shot.data, "base64"));

let afterChoice = null;
if (raidSeen) {
  // Click the first raid choice (Сражаться / Fight) — identified positionally to
  // avoid Cyrillic-string encoding issues between Node and the browser.
  const fought = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const fight = btns.find(b => /%/.test(b.innerText) && b.innerText.includes('Repel the raiders'));
    if (!fight) return false;
    fight.click(); return true;
  })()`);
  await sleep(2500);
  const bodyText = await evaluate(`document.body.innerText.slice(0, 900)`);
  // Inspect the persisted save for consequences (funds, roster, caravan status).
  const state = await evaluate(`(() => {
    const raw = localStorage.getItem('emporium_save_slot_1');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return {
      funds: s.funds,
      rosterLen: s.roster.length,
      slaveCount: s.roster.filter(c => c.isSlave).length,
      caravans: (s.caravans || []).map(c => ({ name: c.name, status: c.status, weeksRemaining: c.weeksRemaining })),
      lastLogs: (s.log || []).slice(0, 4)
    };
  })()`);
  afterChoice = { fought, bodyText, state };
}

console.log(
  JSON.stringify(
    {
      seeded,
      force,
      raidSeen,
      raidSnippet: raidText.slice(0, 500),
      afterChoice,
      consoleErrors: errors.slice(0, 20),
      screenshot: join(OUT, "raid-modal.png"),
    },
    null,
    2,
  ),
);

ws.close();
chrome.kill();
process.exit(0);
