// Smoke test for the clinic/hospital pipeline: gestation, admission to a ward,
// delivery, company-property graduation, and black-market purchases by quantity.
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
const PORT = 9351;
const profile = mkdtempSync(join(tmpdir(), 'cdp-hospital-'));
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
    const pregnancyEngine = await import('/src/pregnancyEngine.ts');
    const hospitalEngine = await import('/src/hospitalEngine.ts');
    const saveState = await import('/src/saveState.ts');
    const { advancePregnancyWeek } = pregnancyEngine;
    const {
      GESTATION_DAYS, COMPANY_PROPERTY_AGE_DAYS, HOSPITAL_WARDS, HOSPITAL_EQUIPMENT,
      advanceHospitalWeek, createHospitalState, quoteWards, quoteEquipment, totalBeds
    } = hospitalEngine;

    const base = saveState.createInitialCampaign({ fresh: true }).roster[0];
    const makeMother = (overrides = {}) => ({
      ...base,
      id: 'mother-1',
      name: 'Test Mother',
      age: 29,
      gender: 'women',
      isSlave: true,
      assignedVenue: 'pleasure_house',
      pregnancy: undefined,
      pleasureStats: { vaginalCount: 10, analCount: 0, totalEarnings: 0 },
      ...overrides
    });
    const staff = { nurses: 2, midwives: 2, nurseBonus: 4, midwifeBonus: 6 };

    // 1. Conception on a Pleasure House week.
    let state = advancePregnancyWeek(
      [makeMother()],
      [makeMother({ pleasureStats: { vaginalCount: 11, analCount: 0, totalEarnings: 100 } })],
      [],
      () => 0.01
    );
    const conceived = state.roster[0].pregnancy?.status === 'pregnant' && state.roster[0].pregnancy.daysPregnant === 7;

    // 2. Ward stock: one standard maternity ward (2 beds) plus consumables.
    let hospital = createHospitalState();
    hospital = { ...hospital, wardCounts: { ...hospital.wardCounts, ward_standard: 1 } };
    hospital = {
      ...hospital,
      equipment: Object.fromEntries(HOSPITAL_EQUIPMENT.map(item => [item.id, item.perDelivery]))
    };

    // 3. No beds at all: she reaches term and must wait.
    const noBedHospital = createHospitalState();
    const notices = [];
    const blocked = advanceHospitalWeek(state.roster, state.dependents, noBedHospital, {
      week: 20, staff, hospitalLevel: 1, random: () => 0.9, onNotify: text => notices.push(text)
    });
    // Run the full pregnancy so she actually reaches term.
    let term = state;
    for (let week = 0; week < 21; week++) {
      term = advancePregnancyWeek(term.roster, term.roster, term.dependents, () => 0.99);
    }
    const atTerm = term.roster[0].pregnancy?.status === 'pregnant' && term.roster[0].pregnancy.daysPregnant >= GESTATION_DAYS;
    const termWeeks = Math.round(GESTATION_DAYS / 7);

    // 4. Admission: escort notice fires and the mother lands in a ward.
    notices.length = 0;
    const admitted = advanceHospitalWeek(term.roster, term.dependents, hospital, {
      week: termWeeks, staff, hospitalLevel: 1, random: () => 0.9, onNotify: text => notices.push(text)
    });
    const admittedMother = admitted.roster[0];
    const escortNotice = notices.some(text => text.includes('Test Mother') && text.includes('палату'));
    const bedBooked = admitted.hospital.patients.length === 1
      && admitted.hospital.patients[0].characterId === 'mother-1';

    // 5. Delivery the following week.
    const delivered = advanceHospitalWeek(admitted.roster, admitted.dependents, admitted.hospital, {
      week: termWeeks + 1, staff, hospitalLevel: 1, random: () => 0
    });
    const newborn = delivered.dependents[0];
    const newbornRecorded = delivered.dependents.length === 1
      && newborn.guardianName === 'Test Mother'
      && newborn.ageDays === 0
      && !('assignedVenue' in newborn)
      && !('isSlave' in newborn);
    const pregnancyCleared = !delivered.roster[0].pregnancy;
    const equipmentBurned = HOSPITAL_EQUIPMENT
      .filter(item => item.timing === 'always')
      .every(item => delivered.hospital.equipment[item.id] === 0);

    // 6. Company property at sixteen, with the parent written on the record.
    const graduated = advancePregnancyWeek([], [], [{ ...newborn, ageDays: COMPANY_PROPERTY_AGE_DAYS - 7 }], () => 0.5);
    const adult = graduated.roster[0];
    const becameProperty = adult?.age === 16
      && adult.isSlave === true
      && adult.slaveOrigin === 'birth:mother-1'
      && adult.role.includes('Test Mother');

    // 7. Black-market quotes scale with quantity and gate on hospital level.
    const wardQuote = quoteWards('ward_icu', 3, 999999, 3);
    const lockedQuote = quoteWards('ward_icu', 1, 999999, 1);
    const equipQuote = quoteEquipment('eq_sterile', 5, 999999);
    const purchasesScale = wardQuote.total === wardQuote.unitCost * 3 && equipQuote.total === equipQuote.unitCost * 5;
    const tierLocked = lockedQuote.locked === true && lockedQuote.lockReason.includes('3');
    const bedsForOneStandardWards = totalBeds({ ...createHospitalState(), wardCounts: { ward_standard: 1 } }) === 2;

    // 8. Recovery then discharge.
    let recovering = delivered;
    for (let week = 0; week < 5; week++) {
      recovering = advanceHospitalWeek(recovering.roster, recovering.dependents, recovering.hospital, {
        week: termWeeks + 2 + week, staff, hospitalLevel: 1, random: () => 0
      });
    }
    const discharged = recovering.hospital.patients.length === 0
      && recovering.roster[0].pregnancy === undefined
      && recovering.roster[0].exactHealth >= 60;

    // 9. A roster member in bad health is walked into a ward by an employee.
    const wardStock = quantity => ({
      ...createHospitalState(),
      wardCounts: { ward_standard: 1, ward_comfort: 0, ward_surgical: 0, ward_icu: 0 },
      equipment: Object.fromEntries(HOSPITAL_EQUIPMENT.map(item => [item.id, quantity]))
    });
    const sick = {
      ...base,
      id: 'sick-1',
      name: 'Test Patient',
      gender: 'men',
      isSlave: false,
      pregnancy: undefined,
      assignedVenue: 'trade',
      exactHealth: 15,
      healthLevel: 'Critical'
    };
    const treatStaff = { ...staff, escortNames: ['Ирина Орлова'] };
    const treatNotices = [];
    let treating = advanceHospitalWeek([sick], [], wardStock(5), {
      week: 5, staff: treatStaff, hospitalLevel: 1, random: () => 0.5,
      onNotify: text => treatNotices.push(text)
    });
    const treatBooked = treating.hospital.patients.length === 1
      && treating.hospital.patients[0].admission === 'treatment'
      && treating.hospital.patients[0].weeksRemaining > 0;
    const escortNamed = treatNotices.some(text =>
      text.includes('Test Patient') && text.includes('лечение') && text.includes('Ирина Орлова'));
    for (let week = 0; week < 6; week++) {
      treating = advanceHospitalWeek(treating.roster, treating.dependents, treating.hospital, {
        week: 6 + week, staff: treatStaff, hospitalLevel: 1, random: () => 0.5
      });
    }
    const treatedHealed = treating.hospital.patients.length === 0
      && treating.roster[0].exactHealth > 15
      && treating.roster[0].healthLevel !== 'Critical';

    // 10. No bed, a mission abroad or a rest programme: no bed is booked.
    const noBedWard = advanceHospitalWeek([sick], [], createHospitalState(), { week: 5, staff: treatStaff, hospitalLevel: 1 });
    const restingPatient = advanceHospitalWeek([sick], [], wardStock(5), {
      week: 5, staff: treatStaff, hospitalLevel: 1, restingCharacterIds: ['sick-1']
    });
    const deployedPatient = advanceHospitalWeek(
      [{ ...sick, assignedTask: 'capture_op:op-1' }], [], wardStock(5),
      { week: 5, staff: treatStaff, hospitalLevel: 1 }
    );
    const onlyTreatedWhenNeeded = noBedWard.hospital.patients.length === 0
      && restingPatient.hospital.patients.length === 0
      && deployedPatient.hospital.patients.length === 0;

    return {
      conceived,
      fullTermIsTwentyWeeks: atTerm && termWeeks === 20,
      waitsWhenNoBeds: blocked.hospital.patients.length === 0,
      escortNoticeFired: escortNotice,
      bedBooked,
      newbornRecorded,
      pregnancyCleared,
      equipmentBurned,
      becameProperty,
      purchasesScale: purchasesScale && tierLocked && bedsForOneStandardWards,
      discharged,
      wardsAndEquipmentDefined: HOSPITAL_WARDS.length === 4 && HOSPITAL_EQUIPMENT.length === 4,
      treatmentBooked: treatBooked,
      treatmentEscortNamed: escortNamed,
      treatmentHealed: treatedHealed,
      onlyTreatedWhenNeeded
    };
  })()`);

  const ok = report && Object.values(report).every(Boolean);
  console.log(JSON.stringify({ ok, report }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}