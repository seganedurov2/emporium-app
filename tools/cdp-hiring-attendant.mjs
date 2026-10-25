// Checks the hiring tab: the rest zone shows up as a vacant post whenever it
// needs an attendant, and attendants can be hired straight from the candidate list.
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
const PORT = 9361;
const profile = mkdtempSync(join(tmpdir(), 'cdp-hiring-attendant-'));
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

// A wide zone (20 seats, so 5 attendants wanted) with a full attendant candidate pool.
const SEED = `(() => {
  const attendant = (id, name, skill, wage) => ({
    id, name, specialty: 'attendant', skill, experience: 0, morale: 80,
    weeklyWage: wage, status: 'active', assignedBuildingId: null, hiredWeek: 3
  });
  const candidate = (id, name, skill, wage) => ({
    id, name, specialty: 'attendant', skill, experience: 0, morale: 75, weeklyWage: wage
  });
  localStorage.setItem('emporium_save_slot_1', JSON.stringify({
    version: 3, slot: 1, campaignName: 'Hiring Attendants', week: 40, funds: 900000,
    reputation: 75, isBankrupt: false, isReceivership: false, activeLoan: null,
    roster: [],
    employees: [
      attendant('emp_a1', 'Nadia Volkova', 88, 900),
      attendant('emp_a2', 'Olga Petrova', 64, 820)
    ],
    restZone: { seats: 20, attendantIds: [], placements: [], totalWeeksHosted: 0, totalSpent: 0 },
    employeeCandidates: [
      candidate('cand_a1', 'Irina Sokolova', 77, 950),
      candidate('cand_a2', 'Marta Kowalska', 55, 760),
      candidate('cand_a3', 'Zofia Nowak', 71, 880)
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
  const hireCandidate = async name => {
    const row = [...document.querySelectorAll('li')].find(li => li.innerText?.includes(name));
    const button = row ? [...row.querySelectorAll('button')].find(b => b.innerText?.trim() === 'Нанять') : null;
    if (!button) return false;
    button.click();
    await new Promise(r => setTimeout(r, 600));
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
    await clickByText('Continue Campaign (Slot 1)', 1200);
    await clickByText('Найм', 900);
    return { body: document.body.innerText };
  })()`);

  const initialText = opened?.body ?? '';

  const hired = await evaluate(`(async () => { ${HELPERS}
    const before = save().employees.length;
    const hired = await hireCandidate('Irina Sokolova');
    const state = save();
    return {
      hired,
      before,
      after: state.employees.length,
      specialties: state.employees.map(e => e.specialty),
      body: document.body.innerText
    };
  })()`);

  // Posting the two hired/hired earlier attendants fills the zone to its recommendation.
  const posted = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Зона отдыха', 700);
    const clicks = [];
    for (let i = 0; i < 5; i++) {
      const node = findButton('Назначить в зону');
      if (!node || node.disabled) break;
      clicks.push(node.innerText?.trim());
      node.click();
      await new Promise(r => setTimeout(r, 500));
    }
    const state = save();
    const posted = state.employees.filter(e => (state.restZone?.attendantIds ?? []).includes(e.id));
    const expectedGain = posted.reduce((sum, e) => sum + 1 + Math.floor(e.skill / 50), 0);
    return {
      clicks,
      attendantIds: state.restZone?.attendantIds ?? [],
      expectedGain,
      body: document.body.innerText
    };
  })()`);

  const report = {
    restZonePostListed: initialText.includes('Зона отдыха') && initialText.includes('Смотритель зоны отдыха'),
    showsGap: initialText.includes('0/5'),
    explainsEffect: initialText.includes('Смотритель повышает покорность отдыхающих'),
    candidatesMatched: initialText.includes('Подходит на пост: Зона отдыха'),
    hiredAttendant: hired?.hired === true && hired?.after === hired?.before + 1
      && hired?.specialties?.includes('attendant') === true,
    allThreePosted: (posted?.attendantIds?.length ?? 0) === 3,
    // One flat point per attendant plus floor(skill / 50) each.
    gainShown: (posted?.body ?? '').includes(`+${posted?.expectedGain}/нед.`) && posted?.expectedGain === 6
  };

  const ok = Object.entries(report).every(([, value]) => value === true);
  console.log(JSON.stringify({ ok, report, attendantIds: posted?.attendantIds }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}