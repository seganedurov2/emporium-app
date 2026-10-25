// Smoke test for the Facilities & Staff expansion using an isolated Chromium profile.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSER = process.env.CHROME_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Yandex/YandexBrowser/Application/browser.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
].find(path => existsSync(path));
if (!BROWSER) throw new Error('No local Chromium-based browser found. Set CHROME_PATH to Chrome, Edge or Yandex Browser.');
const URL_ = process.argv[2] || 'http://localhost:5180/';
const PORT = 9341;
const profile = mkdtempSync(join(tmpdir(), 'cdp-expansion-'));
const chrome = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1600,1100',
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function getWebSocketUrl() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await response.json()).find(target => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not start');
}

const ws = new WebSocket(await getWebSocketUrl());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.result?.subtype === 'error') throw new Error(response.result.description);
  return response.result?.value;
};
const clickButton = async (text, contains = false) => {
  const result = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => ${contains ? `item.innerText.includes(${JSON.stringify(text)})` : `item.innerText.trim() === ${JSON.stringify(text)}`});
    if (!button || button.disabled) return false;
    button.click(); return true;
  })()`);
  if (!result) {
    const body = await evaluate('document.body.innerText');
    throw new Error(`Could not click button: ${text}. Page text: ${body}. Runtime errors: ${errors.join(' | ')}`);
  }
  await sleep(700);
};

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);
  await clickButton('New Game');
  await clickButton('Launch Syndicate Empire', true);
  await sleep(800);
  await clickButton('Buildings & Staff');
  const initial = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('emporium_save_slot_1'));
    return {
      version: state.version,
      candidates: state.employeeCandidates?.length || 0,
      buildingLevels: (state.auxiliaryBuildings || []).map(item => item.level),
      salaryOnCharacters: state.roster.some(character => 'salary' in character)
    };
  })()`);
  if (!initial || initial.version !== 2 || initial.candidates < 3 || initial.salaryOnCharacters) {
    throw new Error(`Unexpected initial expansion state: ${JSON.stringify(initial)}`);
  }

  await clickButton('Показать кандидатов');
  const hired = await evaluate(`(() => {
    const teacherRow = [...document.querySelectorAll('#employee-candidate-list li')].find(row => row.innerText.includes('Преподаватель'));
    if (!teacherRow) return false;
    const button = teacherRow.querySelector('button');
    if (!button) return false;
    button.click(); return true;
  })()`);
  if (!hired) throw new Error('Could not hire the teacher candidate');
  await sleep(600);

  await clickButton('Построить', true);
  await sleep(500);
  const assignResult = await evaluate(`(() => {
    const select = document.querySelector('#facility-employee-school');
    if (!select || !select.options[1]) return false;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!assignResult) throw new Error('Could not assign employee to the school');
  await sleep(700);

  const beforeWeek = await evaluate(`(() => JSON.parse(localStorage.getItem('emporium_save_slot_1')))()`);
  const expectedWages = beforeWeek.employees.reduce((sum, employee) => sum + employee.weeklyWage, 0);
  if (beforeWeek.auxiliaryBuildings.find(item => item.id === 'school')?.level !== 1) {
    throw new Error('School construction was not persisted');
  }
  if (beforeWeek.employees.length !== 1 || beforeWeek.employees[0].assignedBuildingId !== 'school') {
    throw new Error('Hiring/assignment state did not persist correctly');
  }

  await clickButton('Advance Week');
  await sleep(900);
  const afterWeek = await evaluate(`(() => JSON.parse(localStorage.getItem('emporium_save_slot_1')))()`);
  const wageEntry = (afterWeek.log || []).find(entry => entry.startsWith('Employee wages paid:'));
  if (afterWeek.week !== beforeWeek.week + 1 || !wageEntry || !wageEntry.includes(expectedWages.toLocaleString())) {
    throw new Error(`Employee wage/weekly update failed: ${JSON.stringify({ week: afterWeek.week, expectedWeek: beforeWeek.week + 1, wageEntry, expectedWages })}`);
  }

  await evaluate(`(() => { window.__testOriginalRandom = Math.random; Math.random = () => 0; })()`);
  await clickButton('Advance Week');
  await sleep(900);
  const expansionModalVisible = await evaluate(`document.body.innerText.includes('Грант на профессиональное обучение')`);
  await evaluate(`(() => { if (window.__testOriginalRandom) Math.random = window.__testOriginalRandom; })()`);
  if (!expansionModalVisible) throw new Error('Expected a condition-matched expansion event modal after advancing the week');
  const stateBeforeChoice = await evaluate(`(() => JSON.parse(localStorage.getItem('emporium_save_slot_1')))()`);
  await clickButton('Принять грант', true);
  await sleep(700);
  const afterEvent = await evaluate(`(() => JSON.parse(localStorage.getItem('emporium_save_slot_1')))()`);
  if (afterEvent.funds !== stateBeforeChoice.funds + 8000 || afterEvent.reputation !== Math.min(100, stateBeforeChoice.reputation + 2) || !afterEvent.seenExpansionEventIds.includes('expansion_local_education_grant')) {
    throw new Error(`Expansion event effects did not persist: ${JSON.stringify({ before: { funds: stateBeforeChoice.funds, reputation: stateBeforeChoice.reputation }, after: { funds: afterEvent.funds, reputation: afterEvent.reputation }, seen: afterEvent.seenExpansionEventIds })}`);
  }

  await evaluate(`(() => {
    const legacy = {
      version: 1, slot: 2, campaignName: 'Legacy Save', week: 7, funds: 41000, reputation: 62,
      isBankrupt: false, isReceivership: false, activeLoan: null,
      roster: [], marketPool: [], caravans: [], log: ['legacy log'],
      beautySalon: { level: 1, managerId: null, managerTraitId: null, supplies: 100, scheduledTreatments: [], totalRevenue: 0 },
      contracts: [], exhaustionUpgrades: { pleasure_house: 0, strip_club: 0, beauty_salon: 0 }
    };
    localStorage.setItem('emporium_save_slot_2', JSON.stringify(legacy));
  })()`);
  await clickButton('Menu / Save');
  const loadedLegacy = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.innerText.trim() === 'Load' && item.closest('div.bg-slate-950')?.innerText.includes('Legacy Save'));
    if (!button) return false;
    button.click(); return true;
  })()`);
  if (!loadedLegacy) throw new Error('Could not load the legacy test slot');
  await sleep(900);
  const migration = await evaluate(`(() => {
    const parsed = JSON.parse(localStorage.getItem('emporium_save_slot_2'));
    return {
      version: parsed.version,
      campaignName: parsed.campaignName,
      week: parsed.week,
      funds: parsed.funds,
      oldLogPreserved: parsed.log.includes('legacy log'),
      employees: parsed.employees?.length ?? -1,
      buildings: parsed.auxiliaryBuildings?.length ?? 0
    };
  })()`);
  if (migration.version !== 2 || migration.campaignName !== 'Legacy Save' || migration.week !== 7 || migration.funds !== 41000 || !migration.oldLogPreserved || migration.employees !== 0 || migration.buildings !== 3) {
    throw new Error(`Legacy save migration failed: ${JSON.stringify(migration)}`);
  }

  console.log(JSON.stringify({ ok: true, initial, employee: beforeWeek.employees[0], expectedWages, wageEntry, finalWeek: afterWeek.week, migration, runtimeErrors: errors }, null, 2));
} finally {
  ws.close();
  chrome.kill();
}
