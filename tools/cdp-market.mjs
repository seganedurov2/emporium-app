// Verifies the selected-candidate Global Marketplace, one-refresh reservations, and purchase flow.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ||
  "C:/Users/\u0442\u0442\u0442\u0442/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const URL_ = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || ".";
const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), "cdp-market-"));
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function getWsUrl() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = pages.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("DevTools endpoint did not start.");
}

const ws = new WebSocket(await getWsUrl());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(JSON.stringify(message.error)));
    else callbacks.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  ws.send(JSON.stringify({ id: messageId, method, params }));
});
const evaluate = async (expression) => (
  await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
).result?.value;
const clickByText = async (text, wait = 800) => {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.innerText.trim() === ${JSON.stringify(text)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await sleep(wait);
  return clicked;
};

try {
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL_ });
  await sleep(3500);

  if (!(await evaluate(`document.body.innerText.includes('Advance Week')`))) {
    await clickByText("Continue Campaign (Slot 1)");
    await clickByText("Launch Syndicate Empire", 1500);
  }
  if (!(await evaluate(`document.body.innerText.includes('Advance Week')`))) {
    throw new Error("Could not start or continue a campaign for the market check.");
  }
  await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    delete save.reservedMarketCharacterIds;
    localStorage.setItem('emporium_save_slot_1', JSON.stringify(save));
  })()`);
  await send("Page.navigate", { url: URL_ });
  await sleep(1800);
  const migrationLoaded = await clickByText("Continue Campaign (Slot 1)", 1000);
  const legacySaveMigrated = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return Array.isArray(save.reservedMarketCharacterIds) && save.reservedMarketCharacterIds.length === 0;
  })()`);
  if (!migrationLoaded || !legacySaveMigrated) throw new Error("Legacy marketplace reservation migration did not default to an empty list.");
  if (!(await clickByText("Global Marketplace"))) {
    throw new Error("Global Marketplace navigation button was not found.");
  }

  const initial = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    const candidates = [...document.querySelectorAll('aside[aria-label="Available slaves"] button')];
    const section = document.querySelector('section[aria-labelledby="global-market-title"]');
    const firstCandidate = save.marketPool.find(candidate => !candidate.acquired);
    const portrait = section?.querySelector('img');
    return {
      title: section?.querySelector('h1')?.innerText || null,
      candidates: candidates.length,
      firstId: firstCandidate?.id || null,
      firstImage: firstCandidate?.image || null,
      firstPortraitSource: portrait?.getAttribute('src') || null,
      firstPortraitLoaded: Boolean(portrait?.complete && portrait.naturalWidth > 0),
      availableIds: save.marketPool.filter(candidate => !candidate.acquired).map(candidate => candidate.id),
      campaignWeek: save.week,
      sideNavigation: !!document.querySelector('aside nav[aria-label="Game sections"]')
    };
  })()`);
  if (!initial || initial.candidates === 0) throw new Error("No market candidates rendered.");

  await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('aside[aria-label="Available slaves"] button')];
    if (buttons.length < 2) return { changed: true, id: buttons[0]?.getAttribute('data-candidate-id') };
    buttons[1].click();
    return { changed: true, selectedText: buttons[1].innerText };
  })()`);
  await sleep(300);

  const selectedId = await evaluate(`(() => {
    const selected = document.querySelector('aside[aria-label="Available slaves"] button[aria-pressed="true"]');
    const text = selected?.innerText || '';
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return save.marketPool.find(candidate => !candidate.acquired && text.includes(candidate.name))?.id || null;
  })()`);
  if (!selectedId) throw new Error("Selecting a candidate did not update the market list.");
  const selectedPriceVisible = await evaluate(`(() => {
    const selected = document.querySelector('aside[aria-label="Available slaves"] button[aria-pressed="true"]');
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    const candidate = save.marketPool.find(item => item.id === ${JSON.stringify(selectedId)});
    return !!candidate && document.querySelector('section[aria-labelledby="global-market-title"] header')?.innerText.includes(candidate.price.toLocaleString());
  })()`);
  const portraitSelection = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    const candidate = save.marketPool.find(item => item.id === ${JSON.stringify(selectedId)});
    const portrait = document.querySelector('section[aria-labelledby="global-market-title"] img');
    return {
      matchesCandidate: !!candidate && portrait?.getAttribute('src') === candidate.image,
      differsFromPrevious: !!candidate && candidate.image !== ${JSON.stringify(initial.firstImage)},
      loaded: Boolean(portrait?.complete && portrait.naturalWidth > 0),
      actualSource: portrait?.getAttribute('src') || null
    };
  })()`);

  const reserved = await clickByText("Reserve", 400);
  const reservationBeforeWeek = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return (save.reservedMarketCharacterIds || []).includes(${JSON.stringify(selectedId)});
  })()`);
  const weekBefore = await evaluate(`JSON.parse(localStorage.getItem('emporium_save_slot_1')).week`);
  await clickByText("Advance Week", 2600);
  const reservationAfterWeek = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return {
      weekAdvanced: save.week > ${JSON.stringify(weekBefore)},
      candidatePreserved: save.marketPool.some(candidate => candidate.id === ${JSON.stringify(selectedId)} && !candidate.acquired),
      reservationCleared: !(save.reservedMarketCharacterIds || []).includes(${JSON.stringify(selectedId)})
    };
  })()`);
  await evaluate(`(() => {
    const overlay = [...document.querySelectorAll('div.fixed.inset-0')].reverse().find(item => item.querySelector('button'));
    overlay?.querySelector('button')?.click();
  })()`);
  await sleep(500);

  await clickByText("Global Marketplace", 500);
  const buyBefore = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return { funds: save.funds, rosterCount: save.roster.length };
  })()`);
  const buyClicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.innerText.trim() === 'Buy slave');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  await sleep(800);
  const purchase = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return {
      fundsReduced: save.funds < ${JSON.stringify(buyBefore.funds)},
      rosterGrew: save.roster.length === ${JSON.stringify(buyBefore.rosterCount)} + 1,
      purchasedCandidateFlagged: save.marketPool.some(candidate => candidate.id === ${JSON.stringify(selectedId)} && candidate.acquired),
      slaveAddedToRoster: save.roster.some(character => character.id === ${JSON.stringify(selectedId)} && character.isSlave === true && character.slaveOrigin === 'global_market:' + character.region)
    };
  })()`);

  const report = {
    migration: { legacySaveMigrated },
    initial,
    selection: { selectedId, selectedPriceVisible, ...portraitSelection },
    reservation: { reserved, reservationBeforeWeek, ...reservationAfterWeek },
    purchase: { buyClicked, ...purchase },
    remainingCandidates: await evaluate(`document.querySelectorAll('aside[aria-label="Available candidates"] button').length`),
    consoleErrors: errors.slice(0, 15)
  };

  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, "market-3col.png"), Buffer.from(screenshot.data, "base64"));
  report.screenshot = join(OUT, "market-3col.png");

  const valid = report.initial.sideNavigation
    && report.selection.selectedPriceVisible
    && report.selection.matchesCandidate
    && report.selection.differsFromPrevious
    && report.selection.loaded
    && report.reservation.reservationBeforeWeek
    && report.reservation.weekAdvanced
    && report.reservation.candidatePreserved
    && report.reservation.reservationCleared
    && report.purchase.buyClicked
    && report.purchase.fundsReduced
    && report.purchase.rosterGrew
    && report.purchase.purchasedCandidateFlagged
    && report.purchase.slaveAddedToRoster
    && report.consoleErrors.length === 0;
  console.log(JSON.stringify({ ok: valid, ...report }, null, 2));
  if (!valid) process.exitCode = 1;
} finally {
  ws.close();
  chrome.kill();
}
