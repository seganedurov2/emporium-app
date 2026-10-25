// Verifies the dedicated "Slave Market" tab: it exists in the nav, renders all
// four blocks (Ledger, Lots, Buyer offers x2, Relationships), and that those
// sections were removed from the Global Marketplace / Black Market tabs.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ||
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9341;
const profile = mkdtempSync(join(tmpdir(), "cdp-sm-"));
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
  throw new Error("no devtools");
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
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
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
await send("Page.enable");
await send("Page.navigate", { url: URL_ });
await sleep(3500);
const clickByText = async (text, wait = 1300) => {
  const ok = await evaluate(
    `(() => { const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(text)}); if(!b) return false; b.click(); return true; })()`,
  );
  await sleep(wait);
  return ok;
};
if (!(await evaluate(`document.body.innerText.includes('Advance Week')`))) {
  await clickByText("New Game");
  await clickByText("Launch Syndicate Empire", 2000);
}
if (!(await evaluate(`document.body.innerText.includes('Advance Week')`))) {
  throw new Error('Unable to enter a campaign before testing the Slave Market.');
}
// Seed slaves + a couple of buyer contracts so the tab has content.
await evaluate(`(() => {
  const k='emporium_save_slot_1'; const s=JSON.parse(localStorage.getItem(k));
  const mk=(i)=>({id:'sl_'+i,name:'Slave '+i,gender:'women',region:'08_central_africa',regionName:'Central Africa',country:'Cameroon',age:24,role:'Captured Thug (Slave)',price:8000,salary:200,skill:40,loyalty:20,image:'/portraits/08_central_africa/women/portrait08w_001.webp',assignedVenue:'pleasure_house',healthLevel:'Fair',exhaustionLevel:'Tired',exactHealth:70,exactExhaustion:40,headHairStyle:'Short',headHairLength:12,facialHairStyle:'None',pubicHairStyle:'Natural',pubicHairLength:'Short',tanningLevel:15,skinCondition:'Clear',submission:60,pleasureStats:{vaginalCount:0,analCount:0,totalEarnings:5000},isSlave:true,slaveOrigin:'seed'});
  s.roster=[...s.roster,mk(1),mk(2)];
  s.captiveLots=[
    {id:'lot_x',regionId:'08_central_africa',regionName:'Central Africa',quality:'low',quantity:1,cost:2448,pricePerHead:2880},
    {id:'lot_y',regionId:'09_east_south_africa',regionName:'East & South Africa',quality:'high',quantity:2,cost:9350,pricePerHead:5500}
  ];
  s.slaveContracts=[
    {id:'sc_m',channel:'market',buyerName:'Private Estate of Qatar',buyerType:'Private Estate',title:'Estate Requisition',description:'test',regionId:'05_middle_east',regionName:'Middle East & Caucasus',quantityWanted:1,quantityDelivered:0,minQuality:'any',pricePerHead:30000,demandTier:'high',sourcePriceBenchmark:2880,rewardReputation:3,riskReputation:5,riskPercent:0,weeksRemaining:3,status:'active'},
    {id:'sc_b',channel:'black_market',buyerName:'Cartel of Chad',buyerType:'Cartel Broker',title:'Cartel Order',description:'test',regionId:'08_central_africa',regionName:'Central Africa',quantityWanted:2,quantityDelivered:0,minQuality:'any',pricePerHead:3840,demandTier:'low',sourcePriceBenchmark:2880,rewardReputation:2,riskReputation:5,riskPercent:0,weeksRemaining:3,status:'active'}
  ];
  localStorage.setItem(k,JSON.stringify(s)); return s.roster.filter(c=>c.isSlave).length;
})()`);
await send("Page.navigate", { url: URL_ });
await sleep(3500);
await clickByText("Continue Campaign (Slot 1)", 2000);

// Nav must contain the new tab, and it must be clickable.
const navHasTab = await evaluate(
  `[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Slave Market')`,
);
const opened = await clickByText("Slave Market", 1500);

const tabContent = await evaluate(`(() => {
  const t = document.body.innerText;
  return {
    header: t.includes('Slave Market & Captive Trade'),
    ledger: t.includes('Slave Ledger'),
    lots: t.toLowerCase().includes('captive lots') && t.toLowerCase().includes('selected offer'),
    overtBuyers: t.includes('Buyer Offers') && t.includes('Overt Tenders'),
    blackBuyers: t.includes('Black Market Channels'),
    relationships: t.includes('Buyer Relationships'),
    hasHighDemand: /HIGH DEMAND/.test(t),
    hasArbitrage: t.includes('Arbitrage:'),
    lotPresent: t.toLowerCase().includes('captive lot')
  };
})()`);

const secondLotSelected = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.innerText.includes('East & South Africa'));
  if (!button) return false;
  button.click();
  return true;
})()`);
await sleep(300);
const selectedPriceUpdates = await evaluate(`document.body.innerText.includes('$9,350')`);
const purchaseBefore = await evaluate(`(() => {
  const raw = localStorage.getItem('emporium_save_slot_1');
  const save = raw ? JSON.parse(raw) : null;
  return save ? { funds: save.funds, rosterSize: save.roster.length, lotCount: save.captiveLots.length } : null;
})()`);
const buyClicked = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.innerText.trim() === 'Buy lot');
  if (!button || button.disabled) return false;
  button.click();
  return true;
})()`);
await sleep(900);
const purchaseAfter = await evaluate(`(() => {
  const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
  return {
    fundsReduced: save.funds < ${JSON.stringify(purchaseBefore?.funds)},
    rosterGrew: save.roster.length > ${JSON.stringify(purchaseBefore?.rosterSize)},
    lotRemoved: save.captiveLots.length < ${JSON.stringify(purchaseBefore?.lotCount)}
  };
})()`);
await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.innerText.includes('Central Africa'));
  button?.click();
})()`);
await sleep(300);
const reservedLotId = await evaluate(`(() => {
  const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
  return save.captiveLots?.[0]?.id || null;
})()`);
const reserveClicked = await clickByText('Reserve', 500);
const reservationBeforeWeek = await evaluate(`(() => {
  const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
  return (save.reservedCaptiveLotIds || []).includes(${JSON.stringify(reservedLotId)});
})()`);
const weekBeforeReservation = await evaluate(`JSON.parse(localStorage.getItem('emporium_save_slot_1')).week`);
await clickByText('Advance Week', 3000);
const reservationAfterWeek = await evaluate(`(() => {
  const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
  return {
    weekAdvanced: save.week > ${JSON.stringify(weekBeforeReservation)},
    lotPreserved: save.captiveLots.some(lot => lot.id === ${JSON.stringify(reservedLotId)}),
    reservationCleared: !(save.reservedCaptiveLotIds || []).includes(${JSON.stringify(reservedLotId)})
  };
})()`);

// Confirm sections were removed from the Marketplace tab.
await clickByText("Global Marketplace", 1500);
const marketClean = await evaluate(`(() => {
  const t = document.body.innerText;
  return { hasSlaveBuyers: t.includes('Slave Buyers'), hasCaptiveLots: t.includes('Captive Lots'), hasLedger: t.includes('Slave Ledger') };
})()`);

// Confirm sections were removed from the Black Market tab.
await clickByText("Black Market", 1500);
const blackClean = await evaluate(`(() => {
  const t = document.body.innerText;
  return { hasSlaveBuyers: t.includes('Slave Buyers'), hasRelationships: t.includes('Buyer Relationships') };
})()`);

// Back to the Slave Market and screenshot it.
await clickByText("Slave Market", 1200);
const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
});
writeFileSync(
  join(OUT, "slave-market-tab.png"),
  Buffer.from(shot.data, "base64"),
);

console.log(
  JSON.stringify(
    {
      navHasTab,
      opened,
      tabContent,
      selection: { secondLotSelected, selectedPriceUpdates },
      purchase: { buyClicked, ...purchaseAfter },
      reservation: { reserveClicked, reservationBeforeWeek, ...reservationAfterWeek },
      marketClean,
      blackClean,
      consoleErrors: errors.slice(0, 15),
      screenshot: join(OUT, "slave-market-tab.png"),
    },
    null,
    2,
  ),
);
ws.close();
chrome.kill();
process.exit(0);
