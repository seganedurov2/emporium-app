// End-to-end check for the treatment rule: a roster member in bad health must be
// walked into a ward by a hospital employee, show up in the hospital tab and
// carry the roster badge, then heal and be discharged.
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
const SHOT = process.argv[3] || 'tools/hospital-treatment.png';
const PORT = 9353;
const profile = mkdtempSync(join(tmpdir(), 'cdp-hospital-treatment-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1440,2400',
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
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) {
    const thrown = response.exceptionDetails.exception?.description ?? response.exceptionDetails.text;
    throw new Error(`Page evaluation failed: ${thrown}`);
  }
  return response.result?.value;
};

/** Drives the running UI: clicks a button by its exact label, or a nav entry. */
const UI_DRIVER = `
  const clickButton = async (label, wait = 700) => {
    const node = [...document.querySelectorAll('button')].find(el => el.innerText?.trim() === label);
    if (!node) return false;
    node.click();
    await new Promise(r => setTimeout(r, wait));
    return true;
  };
  const clickNav = async (label, wait = 700) => {
    const node = [...document.querySelectorAll('button')].find(el => el.innerText?.trim() === label);
    if (!node) return false;
    node.click();
    await new Promise(r => setTimeout(r, wait));
    return true;
  };
`;

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);

  // Seed a campaign: one operative in bad health, a ward, and a staffed hospital.
  const seeded = await evaluate(`(async () => {
    const { createInitialCampaign } = await import('/src/saveState.ts');
    const state = createInitialCampaign({ fresh: true });
    const patient = state.roster[0];
    const nurse = {
      id: 'emp_nurse', name: 'Ирина Орлова', specialty: 'nurse', skill: 50, experience: 0,
      morale: 80, weeklyWage: 1200, status: 'active', assignedBuildingId: 'hospital', hiredWeek: 1
    };
    const midwife = {
      id: 'emp_midwife', name: 'Мария Соколова', specialty: 'midwife', skill: 45, experience: 0,
      morale: 80, weeklyWage: 1500, status: 'active', assignedBuildingId: 'hospital', hiredWeek: 1
    };
    const save = {
      ...state,
      hospital: {
        ...state.hospital,
        wardCounts: { ward_standard: 1, ward_comfort: 0, ward_surgical: 0, ward_icu: 0 },
        equipment: { eq_sterile: 6, eq_analgesia: 6, eq_infant: 6, eq_emergency: 4 }
      },
      employees: [nurse, midwife],
      auxiliaryBuildings: state.auxiliaryBuildings.map(building =>
        building.id === 'hospital'
          ? { ...building, level: 1, assignedEmployeeIds: ['emp_nurse', 'emp_midwife'] }
          : building),
      roster: state.roster.map((character, index) => index === 0
        ? { ...character, exactHealth: 22, healthLevel: 'Critical', assignedTask: undefined }
        : character)
    };
    localStorage.setItem('emporium_save_slot_1', JSON.stringify(save));
    return { patientName: patient.name, rosterSize: state.roster.length };
  })()`);

  await send('Page.reload');
  await sleep(2500);

  const run = await evaluate(`(async () => {
    ${UI_DRIVER}
    const body = () => document.body.innerText;
    const before = body();
    const opened = await clickButton('Continue Campaign (Slot 1)', 1800);
    const inGame = before.includes('Advance Week') || body().includes('Advance Week');

    const advanced = opened && await clickButton('Advance Week', 1800);

    // The roster tab must flag the patient that is being treated.
    const rosterNav = await clickNav('Персонал синдиката');
    const rosterText = body();
    const rosterFlag = rosterText.includes('БОЛЬНИЦА');

    // The hospital tab must list the stay and name the escort in its ledger.
    const hospitalNav = await clickNav('Больница');
    const hospitalText = body();
    const ledger = [...document.querySelectorAll('li')]
      .map(node => node.innerText)
      .filter(text => text.includes('лечение забирают'));

    return {
      inGame,
      advanced,
      rosterNav,
      hospitalNav,
      rosterFlag,
      treatmentListed: hospitalText.includes('лечение, +'),
      escortNamed: ledger.some(text => text.includes('Ирина Орлова')),
      escortLine: ledger[0] ?? '',
      wardTaken: hospitalText.includes('1/2 коек') || hospitalText.includes('2/2 коек')
    };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));

  const healed = await evaluate(`(async () => {
    ${UI_DRIVER}
    for (let week = 0; week < 6; week++) await clickButton('Advance Week', 900);
    await clickNav('Больница');
    const text = document.body.innerText;
    return { discharged: text.includes('выздоровел') || text.includes('выздоровела'), stillListed: text.includes('лечение, +') };
  })()`);

  const report = {
    patient: seeded?.patientName,
    inGame: run?.inGame === true,
    weekAdvanced: run?.advanced === true,
    rosterBadge: run?.rosterFlag === true,
    treatmentListed: run?.treatmentListed === true,
    escortNamed: run?.escortNamed === true,
    bedOccupied: run?.wardTaken === true,
    healedAndDischarged: healed?.discharged === true && healed?.stillListed === false,
    shot: SHOT
  };
  const ok = Object.values(report).filter(value => typeof value === 'boolean').every(Boolean);
  console.log(JSON.stringify({ ok, escortLine: run?.escortLine, report }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}