// Checks that staff positions are purchasable: a full roster blocks hiring, the
// hiring page sells one more position, the headcount survives a reload, and the
// weekly upkeep for bought positions lands on the treasury.
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
const PORT = 9362;
const profile = mkdtempSync(join(tmpdir(), 'cdp-hiring-slots-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1440,2000',
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

const FUNDS = 500000;
const FIRST_SLOT_COST = 12000;
/** The second position costs 25% more than the first one. */
const SECOND_SLOT_COST = Math.round(FIRST_SLOT_COST * 1.25);

// A legacy-shaped save: no hiringSlots field, so it has to fall back to the free
// headcount of 12 while the roster already sits exactly on it.
const SEED = `(() => {
  const employee = (index, specialty) => ({
    id: 'emp_' + index,
    name: 'Employee ' + index,
    specialty,
    skill: 60,
    experience: 0,
    morale: 80,
    weeklyWage: 900,
    status: 'active',
    assignedBuildingId: null,
    hiredWeek: 3
  });
  localStorage.setItem('emporium_save_slot_1', JSON.stringify({
    version: 3, slot: 1, campaignName: 'Hiring Slots', week: 40, funds: ${FUNDS},
    reputation: 75, isBankrupt: false, isReceivership: false, activeLoan: null,
    roster: [],
    caravans: [],
    employees: Array.from({ length: 12 }, (_, index) => employee(index, 'guard')),
    restZone: { seats: 3, attendantIds: [], placements: [], totalWeeksHosted: 0, totalSpent: 0 },
    employeeCandidates: [
      { id: 'cand_1', name: 'Irina Sokolova', specialty: 'teacher', skill: 77, experience: 0, morale: 75, weeklyWage: 950 }
    ]
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

  const opened = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Продолжить кампанию', 1200);
    await clickByText('Найм', 900);
    return { body: document.body.innerText, slots: save().hiringSlots };
  })()`);

  const bought = await evaluate(`(async () => { ${HELPERS}
    const clicked = await clickByText('Купить место', 800);
    const state = save();
    return { clicked, slots: state.hiringSlots, funds: state.funds, body: document.body.innerText };
  })()`);

  const hired = await evaluate(`(async () => { ${HELPERS}
    const row = [...document.querySelectorAll('li')].find(li => li.innerText?.includes('Irina Sokolova'));
    const button = row ? [...row.querySelectorAll('button')].find(b => b.innerText?.trim() === 'Нанять') : null;
    if (button) button.click();
    await new Promise(r => setTimeout(r, 700));
    const state = save();
    return { hired: Boolean(button), employees: state.employees.length, slots: state.hiringSlots };
  })()`);

  // The bought position must survive a reload, i.e. the save keeps the paid headcount.
  await send('Page.reload');
  await sleep(3000);
  const reloaded = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Продолжить кампанию', 1200);
    const state = save();
    return { slots: state.hiringSlots, employees: state.employees.length };
  })()`);

  const nextWeek = await evaluate(`(async () => { ${HELPERS}
    const advanced = await clickByText('Следующая неделя', 1200);
    const state = save();
    return { advanced, week: state.week, log: (state.log || []).slice(0, 8) };
  })()`);

  // The staff department page sells positions too, and the price has already grown.
  const staffTab = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Отдел кадров', 900);
    const before = document.body.innerText;
    const clicked = await clickByText('Место · $', 800);
    const state = save();
    return { before, clicked, slots: state.hiringSlots, after: document.body.innerText };
  })()`);

  const report = {
    // A save without the field lands on the free 12 places, already full.
    legacySaveKeepsBaseSlots: opened?.slots === 12,
    showsFullStaff: (opened?.body ?? '').includes('12/12') && (opened?.body ?? '').includes('Штат заполнен'),
    offersFirstPosition: (opened?.body ?? '').includes(`Купить место · 13 мест · $${FIRST_SLOT_COST.toLocaleString()}`),
    boughtPosition: bought?.clicked === true && bought?.slots === 13 && bought?.funds === FUNDS - FIRST_SLOT_COST,
    showsBoughtPosition: (bought?.body ?? '').includes('12/13')
      && (bought?.body ?? '').includes('Куплено дополнительных мест: 1'),
    hiredIntoNewPosition: hired?.hired === true && hired?.employees === 13 && hired?.slots === 13,
    positionSurvivesReload: reloaded?.slots === 13 && reloaded?.employees === 13,
    weeklyUpkeepCharged: nextWeek?.week === 41
      && (nextWeek?.log ?? []).some(entry => entry.includes('Содержание дополнительных мест в штате: -$150')),
    staffDepartmentShowsHeadcount: (staffTab?.before ?? '').includes('13 из 13 в штате')
      && (staffTab?.before ?? '').includes(`Место · $${SECOND_SLOT_COST.toLocaleString()}`),
    staffDepartmentSellsPosition: staffTab?.clicked === true && staffTab?.slots === 14
      && (staffTab?.after ?? '').includes('13 из 14 в штате')
  };

  const ok = Object.entries(report).every(([, value]) => value === true);
console.log(JSON.stringify({ ok, report }, null, 2));
if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}