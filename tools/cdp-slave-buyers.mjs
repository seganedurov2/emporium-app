// Verifies the Slave-Buyers contract feature in the Global Marketplace and the
// Black Market: panels render, eligible captives are counted, and fulfilment
// pays out and removes slaves from the roster.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9336;

const profile = mkdtempSync(join(tmpdir(), "cdp-slave-"));
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

const inGame = await evaluate(`document.body.innerText.includes('Advance Week')`);
if (!inGame) {
  await clickByText("New Game");
  await clickByText("Launch Syndicate Empire", 2000);
}

// Seed two slaves into the roster so buyers have something to purchase.
const seeded = await evaluate(`(() => {
  const key = 'emporium_save_slot_1';
  const raw = localStorage.getItem(key);
  if (!raw) return 'no-save';
  const s = JSON.parse(raw);
  const mkSlave = (i) => ({
    id: 'slave_seed_' + i,
    name: 'Captive Seed ' + i,
    gender: 'women',
    region: '08_central_africa',
    regionName: 'Central Africa',
    country: 'Cameroon',
    age: 24,
    role: 'Captured Elite (Slave)',
    price: 8000,
    salary: 200,
    skill: 60,
    loyalty: 20,
    image: '/portraits/08_central_africa/women/portrait08w_001.webp',
    assignedVenue: 'pleasure_house',
    healthLevel: 'Fair',
    exhaustionLevel: 'Tired',
    exactHealth: 70,
    exactExhaustion: 40,
    headHairStyle: 'Short Practical',
    headHairLength: 12,
    facialHairStyle: 'None',
    pubicHairStyle: 'Natural Trim',
    pubicHairLength: 'Short',
    tanningLevel: 15,
    skinCondition: 'Clear',
    submission: 80,
    pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 },
    isSlave: true,
    slaveOrigin: 'test_seed'
  });
  s.roster = [...s.roster, mkSlave(1), mkSlave(2)];
  // Guarantee one contract per channel with quantity 1 and minQuality 'any'.
  const mkContract = (channel, n) => ({
    id: 'slavecontract_test_' + channel,
    channel,
    buyerName: channel === 'market' ? 'Private Estate of Kenya' : 'Cartel Broker of Somalia',
    buyerType: channel === 'market' ? 'Private Estate' : 'Cartel Broker',
    title: channel === 'market' ? 'Estate Workforce Procurement' : 'Cartel Labour Order',
    description: 'Test offer acquiring captives.',
    regionId: '08_central_africa',
    regionName: 'Central Africa',
    quantityWanted: n,
    quantityDelivered: 0,
    minQuality: 'any',
    pricePerHead: 12000,
    rewardReputation: 3,
    riskReputation: 5,
    riskPercent: 0, // no scandal during the test
    weeksRemaining: 3,
    status: 'active'
  });
  s.slaveContracts = [mkContract('market', 1), mkContract('black_market', 1)];
  localStorage.setItem(key, JSON.stringify(s));
  return 'ok:slaves=' + s.roster.filter(c => c.isSlave).length + ' contracts=' + s.slaveContracts.length;
})()`);

await send("Page.navigate", { url: URL_ });
await sleep(3500);
await clickByText("Continue Campaign (Slot 1)", 2000);

// Global Marketplace tab -> check Slave Buyers panel.
await clickByText("Global Marketplace", 1500);
const marketPanel = await evaluate(`({
  hasPanel: document.body.innerText.includes('Slave Buyers — Overt Tenders'),
  hasOffer: document.body.innerText.includes('Estate Workforce Procurement'),
  eligibleShown: /Eligible captives:\\s*\\d+\\s*\\/\\s*\\d+/.test(document.body.innerText),
  bodySnippet: document.body.innerText.slice(0, 200)
})`);

// Screenshot the marketplace Slave Buyers panel.
await evaluate(`(() => {
  const el = [...document.querySelectorAll('h3')].find(h => h.innerText.includes('Slave Buyers'));
  if (el) el.scrollIntoView({ block: 'center' });
})()`);
await sleep(600);
const marketShot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "slave-buyers-market.png"), Buffer.from(marketShot.data, "base64"));

// Fulfil the marketplace contract (first "Deliver" button on screen).
const marketFundsBefore = await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('emporium_save_slot_1')); return s.funds; })()`);
const deliveredMarket = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('Deliver'));
  if (!b) return false; b.click(); return true;
})()`);
await sleep(2000);
const marketState = await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
  return {
    funds: s.funds,
    slaves: s.roster.filter(c => c.isSlave).length,
    contracts: (s.slaveContracts || []).map(c => ({ channel: c.channel, delivered: c.quantityDelivered, status: c.status }))
  };
})()`);

// Black Market tab -> check Slave Buyers panel.
await clickByText("Black Market", 1500);
const blackPanel = await evaluate(`({
  hasPanel: document.body.innerText.includes('Slave Buyers — Black Market Channels'),
  hasOffer: document.body.innerText.includes('Cartel Labour Order')
})`);

await clickByText("Black Market", 300);
// Scroll the Slave Buyers panel into view for the screenshot.
await evaluate(`(() => {
  const el = [...document.querySelectorAll('h3')].find(h => h.innerText.includes('Slave Buyers'));
  if (el) el.scrollIntoView({ block: 'center' });
})()`);
await sleep(600);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "slave-buyers.png"), Buffer.from(shot.data, "base64"));

console.log(
  JSON.stringify(
    {
      seeded,
      marketPanel,
      marketFundsBefore,
      deliveredMarket,
      marketState,
      blackPanel,
      consoleErrors: errors.slice(0, 20),
      screenshot: join(OUT, "slave-buyers.png"),
    },
    null,
    2,
  ),
);

ws.close();
chrome.kill();
process.exit(0);
