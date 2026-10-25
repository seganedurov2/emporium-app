// Checks that a save written before purchasable seats existed still loads: the
// old tier level must convert into that many seats, and an attendant posted to a
// roster-less employee must be dropped.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSER = process.env.CHROME_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
].find(path => existsSync(path));
if (!BROWSER) throw new Error('No local Chromium-based browser found. Set CHROME_PATH.');

const URL_ = process.argv[2] || 'http://localhost:5173/';
const PORT = 9359;
const profile = mkdtempSync(join(tmpdir(), 'cdp-rest-migration-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1440,1600',
  'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getWsUrl() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = pages.find(target => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools endpoint did not start.');
}

const ws = new WebSocket(await getWsUrl());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const callbacks = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) callbacks.reject(new Error(JSON.stringify(message.error)));
  else callbacks.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  ws.send(JSON.stringify({ id: messageId, method, params }));
});
const evaluate = async expression => (
  await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
).result?.value;

// Tier 4 (12 seats) plus a ghost attendant id that no employee matches.
const SEED = `(() => {
  localStorage.setItem('emporium_save_slot_1', JSON.stringify({
    version: 3, slot: 1, campaignName: 'Legacy Rest Zone', week: 30, funds: 250000,
    reputation: 70, isBankrupt: false, isReceivership: false, activeLoan: null,
    roster: [{
      id: 'op_legacy', name: 'Legacy Operative', gender: 'women', region: '07_west_africa',
      regionName: 'West Africa', age: 26, role: 'Venue Hostess', price: 9000, skill: 50,
      loyalty: 50, image: 'portrait.png', assignedVenue: 'pleasure_house',
      healthLevel: 'Fair', exhaustionLevel: 'Tired', exactHealth: 65, exactExhaustion: 40,
      headHairStyle: 'Braids', headHairLength: 30, facialHairStyle: 'None',
      pubicHairStyle: 'Trimmed', pubicHairLength: 'Short', tanningLevel: 40,
      skinCondition: 'Clear', submission: 55,
      pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 }
    }],
    restZone: {
      level: 4,
      attendantIds: ['emp_ghost'],
      placements: [{
        id: 'rest_legacy', characterId: 'op_legacy', characterName: 'Legacy Operative',
        programName: 'Устаревший курс', weeksTotal: 4, weeksRemaining: 2,
        returnVenue: 'pleasure_house', admittedWeek: 28
      }],
      totalWeeksHosted: 9, totalSpent: 14400
    }
  }));
  return true;
})()`;

const HELPERS = `
  const findButton = label => [...document.querySelectorAll('button')].find(el => el.innerText?.trim().startsWith(label));
  const waitForButton = async (label, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const node = findButton(label);
      if (node) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  };
  const clickByText = async (label, wait = 500) => {
    const node = await waitForButton(label) ? findButton(label) : null;
    if (!node || node.disabled) return false;
    node.click();
    await new Promise(r => setTimeout(r, wait));
    return true;
  };
  const save = () => JSON.parse(localStorage.getItem('emporium_save_slot_1') || '{}');
`;

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: URL_ });
  await sleep(3000);
  await evaluate(SEED);
  await send('Page.reload');
  await sleep(3000);

  const loaded = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Continue Campaign (Slot 1)', 1200);
    await clickByText('Зона отдыха', 900);
    const state = save();
    return {
      restZone: state.restZone,
      body: document.body.innerText
    };
  })()`);

  const zone = loaded?.restZone ?? {};
  const body = loaded?.body ?? '';

  const report = {
    tierBecameSeats: zone.seats === 12,
    ghostAttendantDropped: Array.isArray(zone.attendantIds) && zone.attendantIds.length === 0,
    placementRewritten: zone.placements?.[0]?.programName === 'Полная реабилитация' && zone.placements?.[0]?.weeksRemaining === 2,
    recordsKept: zone.totalWeeksHosted === 9 && zone.totalSpent === 14400,
    showsTwelvePlaces: body.includes('12/12') || body.includes('12 мест'),
    showsUnlimitedCopy: body.includes('без верхнего ограничения'),
    showsNextSeatPrice: body.includes('Купить место · 13 мест')
  };

  const ok = Object.entries(report).every(([, value]) => value === true);
  console.log(JSON.stringify({ ok, report, restZone: zone }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}