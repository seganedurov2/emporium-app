// Drives the Rest Zone tab in the live app: buys extra seats past the old tier
// cap, posts a hired attendant, and checks the resting operative's submission
// climbs faster than the base programme rate.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
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
const SHOT = process.argv[3] || 'tools/rest-attendants.png';
const PORT = 9357;
const profile = mkdtempSync(join(tmpdir(), 'cdp-rest-attendants-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1440,2600',
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

// One worn operative plus an attendant already on the payroll, posted to nothing.
const SEED = `(() => {
  const operative = (id, name, patch) => ({
    id, name, gender: 'women', region: '07_west_africa', regionName: 'West Africa',
    age: 24, role: 'Venue Hostess', price: 12000, skill: 55, loyalty: 45,
    image: 'portrait.png', assignedVenue: 'pleasure_house',
    healthLevel: 'Pristine', exhaustionLevel: 'Rested', exactHealth: 95, exactExhaustion: 10,
    headHairStyle: 'Braids', headHairLength: 30, facialHairStyle: 'None',
    pubicHairStyle: 'Trimmed', pubicHairLength: 'Short', tanningLevel: 40,
    skinCondition: 'Flawless', submission: 60,
    pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 },
    ...patch
  });
  localStorage.setItem('emporium_save_slot_1', JSON.stringify({
    version: 3, slot: 1, campaignName: 'Rest Attendants Test', week: 20, funds: 5000000,
    reputation: 80, isBankrupt: false, isReceivership: false, activeLoan: null,
    roster: [
      operative('op_worn', 'Fatima Al-Sayed', {
        healthLevel: 'Fair', exhaustionLevel: 'Burned Out', exactHealth: 60, exactExhaustion: 85,
        skinCondition: 'Dry', isSlave: true
      })
    ],
    employees: [{
      id: 'emp_att', name: 'Nadia Volkova', specialty: 'attendant', skill: 90,
      experience: 0, morale: 80, weeklyWage: 900, status: 'active', assignedBuildingId: null, hiredWeek: 5
    }]
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
  const dismissModals = async () => {
    for (let i = 0; i < 6; i++) {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      if (!modal) return true;
      if (modal.innerText?.includes('Auction')) await clickByText('Withdraw from Auction');
      else {
        const choice = [...modal.querySelectorAll('button')].find(b => !b.disabled);
        if (!choice) return false;
        choice.click();
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  };
  const save = () => JSON.parse(localStorage.getItem('emporium_save_slot_1') || '{}');
  const seatText = () => {
    const node = [...document.querySelectorAll('div')].find(el =>
      el.innerText?.trim() === 'Мест' && el.className.includes('uppercase'));
    return node?.parentElement?.innerText ?? '';
  };
`;

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: URL_ });
  await sleep(3000);
  await evaluate(SEED);
  await send('Page.reload');
  await sleep(3000);

  const opened = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Continue Campaign (Slot 1)', 1200);
    await clickByText('Зона отдыха', 900);
    return { body: document.body.innerText, seats: save().restZone?.seats };
  })()`);

  const initialText = opened?.body ?? '';

  // Buy seats repeatedly: the old build capped the zone at 12, this one must not.
  const bought = await evaluate(`(async () => { ${HELPERS}
    const results = [];
    for (let i = 0; i < 12; i++) {
      const before = save().funds;
      if (!(await clickByText('Купить место', 450))) { results.push({ blocked: true }); break; }
      results.push({ seats: save().restZone?.seats, spent: before - save().funds });
    }
    await clickByText('Зона отдыха', 600);
    return { results, seatBadge: seatText(), upkeep: save(), body: document.body.innerText };
  })()`);

  const seatResults = bought?.results ?? [];
  const finalSeats = seatResults[seatResults.length - 1]?.seats ?? 3;
  const upkeepLine = bought?.body ?? '';

  // Post the attendant, then send the operative to rest.
  const posted = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Зона отдыха', 400);
    const assigned = await clickByText('Назначить в зону', 700);
    const body = document.body.innerText;
    await clickByText('Зона отдыха', 300);
    const state = save();
    return { assigned, attendantIds: state.restZone?.attendantIds ?? [], body };
  })()`);

  const sent = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Зона отдыха', 600);
    await clickByText('Отправить на отдых', 800);
    const state = save();
    return { submission: state.roster.find(c => c.id === 'op_worn')?.submission, placements: state.restZone?.placements ?? [] };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));

  const advanced = await evaluate(`(async () => { ${HELPERS}
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      await dismissModals();
      const button = [...document.querySelectorAll('button')].find(el => el.innerText?.trim() === 'Advance Week');
      if (!button || button.disabled) { weeks.push('blocked'); break; }
      button.click();
      await new Promise(r => setTimeout(r, 800));
      await dismissModals();
      const state = save();
      weeks.push({
        week: state.week,
        submission: state.roster.find(c => c.id === 'op_worn')?.submission ?? null
      });
    }
    return { weeks, log: save().log ?? [] };
  })()`);

  const weekState = advanced?.weeks ?? [];

  const report = {
    startsAtThreeSeats: opened?.seats === 3,
    showsAttendantSection: initialText.includes('Смотрители зоны') && initialText.includes('Nadia Volkova'),
    showsBaseSubmissionRate: initialText.includes('/нед.'),
    // 12 purchases from the 3-seat start must exceed the old 12-seat hard cap.
    seatsUnlimited: finalSeats > 12,
    seatCostsEscalate: seatResults[0]?.spent === 6000
      && seatResults[1]?.spent > seatResults[0]?.spent
      && seatResults[11]?.spent > seatResults[10]?.spent,
    upkeepTracksSeats: upkeepLine.includes('СОДЕРЖАНИЕ ЗОНЫ'),
    attendantPosted: posted?.assigned === true && posted?.attendantIds?.includes('emp_att') === true,
    attendantCountedInTab: (posted?.body ?? '').includes('на посту'),
    sentToRest: (sent?.placements?.length ?? 0) === 1,
    // Skill 90 attendant: 1 base point + floor(90 / 50) = 2 per week.
    weeklySubmission: weekState[0]?.submission === 62 && weekState[1]?.submission === 64,
    submissionLogged: (advanced?.log ?? []).some(entry => entry.includes('REST ZONE')),
    shot: SHOT
  };

  const ok = Object.entries(report).filter(([, value]) => typeof value === 'boolean').every(([, value]) => value);
  console.log(JSON.stringify({ ok, report, seatResults, weeks: weekState }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}