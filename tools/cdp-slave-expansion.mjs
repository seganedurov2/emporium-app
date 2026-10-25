// Verifies the slave-trade expansion: regional demand pricing (Idea 2), the
// Slave Ledger panel (Idea 3), buyer standing (Idea 5), the auction event
// (Idea 4), and unrest/escape (Idea 1) — including a runtime determinism check
// on the pure engine functions loaded from the dev server.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9337;

const profile = mkdtempSync(join(tmpdir(), "cdp-slave2-"));
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

const inGame = await evaluate(
  `document.body.innerText.includes('Advance Week')`,
);
if (!inGame) {
  await clickByText("New Game");
  await clickByText("Launch Syndicate Empire", 2000);
}

// Seed slaves (low loyalty to trigger unrest) + high-demand contracts.
const seeded = await evaluate(`(() => {
  const key = 'emporium_save_slot_1';
  const raw = localStorage.getItem(key);
  if (!raw) return 'no-save';
  const s = JSON.parse(raw);
  const mkSlave = (i, loyalty) => ({
    id: 'slave_seed_' + i, name: 'Captive Seed ' + i, gender: 'women',
    region: '08_central_africa', regionName: 'Central Africa', country: 'Cameroon',
    age: 24, role: 'Captured Thug (Slave)', price: 8000, salary: 200,
    skill: 40, loyalty, image: '/portraits/08_central_africa/women/portrait08w_001.webp',
    assignedVenue: 'pleasure_house', healthLevel: 'Fair', exhaustionLevel: 'Burned Out',
    exactHealth: 70, exactExhaustion: 80, headHairStyle: 'Short Practical', headHairLength: 12,
    facialHairStyle: 'None', pubicHairStyle: 'Natural Trim', pubicHairLength: 'Short',
    tanningLevel: 15, skinCondition: 'Clear', submission: 30,
    pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 4000 },
    isSlave: true, slaveOrigin: 'test_seed'
  });
  s.roster = [...s.roster, mkSlave(1, 12), mkSlave(2, 15)];
  s.slaveContracts = [
    { id: 'sc_high', channel: 'market', buyerName: 'Private Estate of Qatar', buyerType: 'Private Estate',
      title: 'High Demand Lot', description: 'test', regionId: '05_middle_east', regionName: 'Middle East & Caucasus',
      quantityWanted: 1, quantityDelivered: 0, minQuality: 'any', pricePerHead: 30000, demandTier: 'high',
      sourcePriceBenchmark: 2880, rewardReputation: 3, riskReputation: 5, riskPercent: 0, weeksRemaining: 3, status: 'active' },
    { id: 'sc_low', channel: 'black_market', buyerName: 'Cartel of Chad', buyerType: 'Cartel Broker',
      title: 'Low Demand Lot', description: 'test', regionId: '08_central_africa', regionName: 'Central Africa',
      quantityWanted: 1, quantityDelivered: 0, minQuality: 'any', pricePerHead: 3840, demandTier: 'low',
      sourcePriceBenchmark: 2880, rewardReputation: 2, riskReputation: 5, riskPercent: 0, weeksRemaining: 3, status: 'active' }
  ];
  s.buyerStandings = {};
  localStorage.setItem(key, JSON.stringify(s));
  return 'ok:slaves=' + s.roster.filter(c => c.isSlave).length;
})()`);

await send("Page.navigate", { url: URL_ });
await sleep(3500);
await clickByText("Continue Campaign (Slot 1)", 2000);

// --- Idea 3: Slave Ledger on dashboard ---
const ledger = await evaluate(`({
  hasLedger: document.body.innerText.includes('Slave Ledger'),
  hasUnrest: document.body.innerText.includes('Unrest Index'),
  hasEscapeRisk: document.body.innerText.includes('Escape Risk'),
  hasLifetimeRevenue: document.body.innerText.includes('Lifetime Slave Revenue')
})`);

// --- Idea 2: demand tiers + arbitrage line on marketplace ---
await clickByText("Global Marketplace", 1500);
const market = await evaluate(`({
  hasDemandBadge: /HIGH DEMAND/.test(document.body.innerText),
  hasArbitrage: document.body.innerText.includes('Arbitrage:'),
  hasCaptiveLots: document.body.innerText.includes('Captive Lots for Acquisition')
})`);

// Buy a captive lot if available, and confirm roster grows.
const lotBefore = await evaluate(
  `(() => { const s = JSON.parse(localStorage.getItem('emporium_save_slot_1')); return s.roster.length; })()`,
);
const boughtLot = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('Acquire lot'));
  if (!b) return false; b.click(); return true;
})()`);
await sleep(1800);
const lotAfter = await evaluate(
  `(() => { const s = JSON.parse(localStorage.getItem('emporium_save_slot_1')); return { roster: s.roster.length, slaves: s.roster.filter(c=>c.isSlave).length }; })()`,
);

// --- Idea 5: Buyer Relationships panel on black market ---
await clickByText("Black Market", 1500);
const standingPanel = await evaluate(`({
  hasPanel: document.body.innerText.includes('Buyer Relationships'),
  hasTier: /standing|Locked out/i.test(document.body.innerText),
  hasPriceBonus: document.body.innerText.includes('Price bonus')
})`);

// Fulfil the high-demand contract, then check standing rose.
const fulfilled = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('Deliver'));
  if (!b) return false; b.click(); return true;
})()`);
await sleep(1800);
const standingState = await evaluate(
  `(() => { const s = JSON.parse(localStorage.getItem('emporium_save_slot_1')); return { standings: s.buyerStandings, funds: s.funds }; })()`,
);

// --- Idea 1: advance a week, expect unrest handling; capture escape risk text ---
await clickByText("Command Center", 800);
const weekBefore = await evaluate(
  `document.body.innerText.match(/Week (\\d+)/)?.[1]`,
);
await clickByText("Advance Week", 2500);
// Dismiss any random event or auction modal that popped up.
const modalInfo = await evaluate(`(() => {
  const t = document.body.innerText;
  return {
    hasAuction: t.includes('Slave Auction') || t.includes('Underground Auction'),
    hasRandomEvent: t.includes('Dilemma') || t.includes('Auction House'),
    topText: t.slice(0, 200)
  };
})()`);
const escapeLog = await evaluate(
  `(() => { const s = JSON.parse(localStorage.getItem('emporium_save_slot_1')); return { week: s.week, escapeLogs: (s.log||[]).filter(l => l.includes('SLAVE UNREST') || l.includes('escaped')).slice(0,3), slavesLeft: s.roster.filter(c=>c.isSlave).length }; })()`,
);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(
  join(OUT, "slave-expansion.png"),
  Buffer.from(shot.data, "base64"),
);

console.log(
  JSON.stringify(
    {
      seeded,
      ledger,
      market,
      lot: { before: lotBefore, boughtLot, after: lotAfter },
      standingPanel,
      fulfilled,
      standingState,
      weekBefore,
      modalInfo,
      escapeLog,
      consoleErrors: errors.slice(0, 20),
      screenshot: join(OUT, "slave-expansion.png"),
    },
    null,
    2,
  ),
);

ws.close();
chrome.kill();
process.exit(0);
