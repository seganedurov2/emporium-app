// Focused check: does the Slave Ledger render its metric grid when slaves exist?
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9338;
const profile = mkdtempSync(join(tmpdir(), "cdp-ledger-"));
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
const clickByText = async (text, wait = 1200) => {
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
// Seed exactly two slaves.
await evaluate(`(() => {
  const k='emporium_save_slot_1'; const s=JSON.parse(localStorage.getItem(k));
  const mk=(i)=>({id:'sl_'+i,name:'Ledger Slave '+i,gender:'women',region:'08_central_africa',regionName:'Central Africa',country:'Cameroon',age:24,role:'Captured Thug (Slave)',price:8000,salary:200,skill:40,loyalty:20,image:'/portraits/08_central_africa/women/portrait08w_001.webp',assignedVenue:'pleasure_house',healthLevel:'Fair',exhaustionLevel:'Tired',exactHealth:70,exactExhaustion:40,headHairStyle:'Short',headHairLength:12,facialHairStyle:'None',pubicHairStyle:'Natural',pubicHairLength:'Short',tanningLevel:15,skinCondition:'Clear',submission:60,pleasureStats:{vaginalCount:0,analCount:0,totalEarnings:5000},isSlave:true,slaveOrigin:'seed'});
  s.roster=[...s.roster,mk(1),mk(2)]; localStorage.setItem(k,JSON.stringify(s)); return s.roster.filter(c=>c.isSlave).length;
})()`);
await send("Page.navigate", { url: URL_ });
await sleep(3500);
await clickByText("Continue Campaign (Slot 1)", 2000);
// Stay on dashboard; scroll to ledger.
await evaluate(
  `(() => { const el=[...document.querySelectorAll('h3')].find(h=>h.innerText.includes('Slave Ledger')); if(el) el.scrollIntoView({block:'center'}); })()`,
);
await sleep(800);
const ledger = await evaluate(`(() => {
  const t = document.body.innerText;
  return {
    hasLedger: t.includes('Slave Ledger'),
    hasTotalCaptives: t.includes('Total Captives'),
    hasAvgSubmission: t.includes('Avg Submission'),
    hasAvgLoyalty: t.includes('Avg Loyalty'),
    hasUnrest: t.includes('Unrest Index'),
    hasEscape: t.includes('Escape Risk'),
    hasLifetime: t.includes('Lifetime Slave Revenue'),
    isEmptyState: t.includes('No captives in your holding'),
    snippet: t.slice(t.indexOf('Slave Ledger'), t.indexOf('Slave Ledger') + 320)
  };
})()`);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(join(OUT, "ledger.png"), Buffer.from(shot.data, "base64"));
console.log(
  JSON.stringify({ ledger, consoleErrors: errors.slice(0, 10) }, null, 2),
);
ws.close();
chrome.kill();
process.exit(0);
