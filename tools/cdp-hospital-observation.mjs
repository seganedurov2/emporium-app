// Smoke test for the pregnancy risk watch: automatic admission before term, the
// outcome of the stay (pregnancy held or lost), and the cases where no bed, no
// staff or a mission abroad must suppress the admission.
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
const PORT = 9354;
const profile = mkdtempSync(join(tmpdir(), 'cdp-observation-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
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
    const thrown = response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text
      ?? 'unknown error';
    throw new Error(`Page evaluation failed: ${thrown}`);
  }
  return response.result?.value;
};

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(1500);

  const report = await evaluate(`(async () => {
    const hospitalEngine = await import('/src/hospitalEngine.ts');
    const saveState = await import('/src/saveState.ts');
    const {
      GESTATION_DAYS, HOSPITAL_EQUIPMENT, OBSERVATION_MAX_WEEKS, PREGNANCY_RISK_ADMIT,
      advanceHospitalWeek, assessObservation, assessPregnancyRisk, createHospitalState,
      isObservationStay, needsPregnancyObservation
    } = hospitalEngine;

    const base = saveState.createInitialCampaign({ fresh: true }).roster[0];
    const staff = { nurses: 2, midwives: 2, nurseBonus: 4, midwifeBonus: 6, escortNames: ['Ирина Орлова'] };
    const fullStock = Object.fromEntries(HOSPITAL_EQUIPMENT.map(item => [item.id, 5]));
    const wards = createHospitalState();
    const wardState = (stock = fullStock, counts = { ward_standard: 1, ward_comfort: 1 }) => ({
      ...wards,
      wardCounts: { ...wards.wardCounts, ...counts },
      equipment: stock
    });

    // A mother 10 weeks in, health and fatigue both in the bad range.
    const risky = (overrides = {}) => ({
      ...base,
      id: 'risky-1',
      name: 'Risk Mother',
      age: 29,
      gender: 'women',
      isSlave: true,
      assignedVenue: 'pleasure_house',
      exactHealth: 30,
      exactExhaustion: 90,
      pregnancy: { status: 'pregnant', daysPregnant: 70, hospitalWeeksRemaining: 0 },
      ...overrides
    });

    // 1. The score crosses the admission line and names the reasons.
    const risk = assessPregnancyRisk(risky(), fullStock);
    const scoresHigh = risk.score >= PREGNANCY_RISK_ADMIT && risk.reasons.length > 0;

    // 2. A healthy early pregnancy stays on the floor.
    const healthy = risky({
      exactHealth: 95,
      exactExhaustion: 5,
      pregnancy: { status: 'pregnant', daysPregnant: 14, hospitalWeeksRemaining: 0 }
    });
    const healthyNotFlagged = needsPregnancyObservation(healthy, fullStock) === false
      && assessPregnancyRisk(healthy, fullStock).score < PREGNANCY_RISK_ADMIT;

    // 3. Automatic admission before term, with an escort notice.
    const notices = [];
    const booked = advanceHospitalWeek([risky()], [], wardState(), {
      week: 10, staff, hospitalLevel: 1, random: () => 0.5, onNotify: text => notices.push(text)
    });
    const patient = booked.hospital.patients[0];
    const admittedEarly = booked.hospital.patients.length === 1
      && isObservationStay(patient)
      && patient.weeksRemaining <= OBSERVATION_MAX_WEEKS
      && patient.survivalChance > 0;
    const noticeFired = notices.some(text =>
      text.includes('Risk Mother') && text.includes('наблюдение') && text.includes('Ирина Орлова'));
    const stillPregnant = booked.roster[0].pregnancy?.status === 'pregnant'
      && booked.roster[0].pregnancy.daysPregnant === 70;

    // 4. The stay holds the pregnancy: she goes back to work still pregnant.
    const holdRandom = () => 0;
    let held = booked;
    for (let week = 0; week < OBSERVATION_MAX_WEEKS + 1; week++) {
      held = advanceHospitalWeek(held.roster, held.dependents, held.hospital, {
        week: 11 + week, staff, hospitalLevel: 1, random: holdRandom
      });
    }
    const pregnancyHeld = held.hospital.patients.length === 0
      && held.roster[0].pregnancy?.status === 'pregnant'
      && held.roster[0].pregnancy.daysPregnant === 70
      && held.roster[0].exactHealth > 30;

    // 5. A bad outcome loses the pregnancy and the mother pays for it.
    const lostRandom = () => 0.999;
    let lost = booked;
    for (let week = 0; week < OBSERVATION_MAX_WEEKS + 1; week++) {
      lost = advanceHospitalWeek(lost.roster, lost.dependents, lost.hospital, {
        week: 11 + week, staff, hospitalLevel: 1, random: lostRandom
      });
    }
    const pregnancyLost = lost.hospital.patients.length === 0
      && !lost.roster[0].pregnancy
      && lost.roster[0].loyalty < 100;

    // 6. Better wards and stocked consumables raise the survival chance.
    const poor = assessObservation({}, 'ward_standard', staff, risk);
    const good = assessObservation(fullStock, 'ward_icu', staff, risk);
    const careScales = good.survivalChance > poor.survivalChance && good.weeklyGain >= poor.weeklyGain;

    // 7. No beds, no staff on duty, or a mission abroad: nobody is booked.
    const noBed = advanceHospitalWeek([risky()], [], createHospitalState(), { week: 10, staff, hospitalLevel: 1 });
    const noStaff = advanceHospitalWeek([risky()], [], wardState(), {
      week: 10, staff: { ...staff, nurses: 0, midwives: 0 }, hospitalLevel: 1
    });
    const deployed = advanceHospitalWeek([risky({ assignedTask: 'capture_op:op-1' })], [], wardState(), {
      week: 10, staff, hospitalLevel: 1
    });
    const resting = advanceHospitalWeek([risky()], [], wardState(), {
      week: 10, staff, hospitalLevel: 1, restingCharacterIds: ['risky-1']
    });
    const onlyWatchedWhenPossible = noBed.hospital.patients.length === 0
      && noStaff.hospital.patients.length === 0
      && deployed.hospital.patients.length === 0
      && resting.hospital.patients.length === 0;

    // 8. At term the maternity path still wins over the risk watch.
    const atTerm = advanceHospitalWeek(
      [risky({ pregnancy: { status: 'pregnant', daysPregnant: GESTATION_DAYS, hospitalWeeksRemaining: 0 } })],
      [], wardState(), { week: 20, staff, hospitalLevel: 1, random: () => 0.5 }
    );
    const termUsesBirthBed = atTerm.hospital.patients.length === 1
      && atTerm.hospital.patients[0].admission === 'birth';

    return {
      scoresHigh,
      healthyNotFlagged,
      admittedEarly,
      noticeFired,
      stillPregnant,
      pregnancyHeld,
      pregnancyLost,
      careScales,
      onlyWatchedWhenPossible,
      termUsesBirthBed
    };
  })()`);

  const ok = report && Object.values(report).every(Boolean);
  console.log(JSON.stringify({ ok, report }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}