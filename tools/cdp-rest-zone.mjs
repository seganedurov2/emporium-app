// Drives the Rest Zone tab in the live app: seeds a campaign whose operative
// needs care, sends her on a program, then runs the weeks to the discharge.
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
const SHOT = process.argv[3] || 'tools/rest-zone.png';
const PORT = 9354;
const profile = mkdtempSync(join(tmpdir(), 'cdp-rest-zone-'));
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
const evaluate = async expression => (
  await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
).result?.value;

// Two operatives: one worn out and in need of care, one perfectly stable.
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
    version: 3, slot: 1, campaignName: 'Rest Zone Test', week: 20, funds: 500000,
    reputation: 80, isBankrupt: false, isReceivership: false, activeLoan: null,
    roster: [
      operative('op_worn', 'Fatima Al-Sayed', {
        healthLevel: 'Fair', exhaustionLevel: 'Burned Out', exactHealth: 60, exactExhaustion: 85,
        skinCondition: 'Dry', isSlave: true
      }),
      operative('op_fresh', 'Vera Volkova', {})
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
    await clickByText('Зона отдыха', 700);
    return { body: document.body.innerText, funds: save().funds };
  })()`);

  const initialText = opened?.body ?? '';
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));

  // The second route: an operative with skin damage goes to the beauty salon,
  // which should preselect her and the treatment her condition calls for.
  const salon = await evaluate(`(async () => { ${HELPERS}
    const clicked = await clickByText('В салон красоты', 900);
    const selects = [...document.querySelectorAll('select')];
    const state = save();
    const pick = needle => selects.find(node => [...node.options].some(option => option.textContent?.includes(needle)))?.value ?? null;
    return {
      clicked,
      operative: pick('Fatima Al-Sayed'),
      treatment: pick('Rejuvenating Skin Facial'),
      venue: state.roster.find(c => c.id === 'op_worn')?.assignedVenue,
      body: document.body.innerText
    };
  })()`);

  const sent = await evaluate(`(async () => { ${HELPERS}
    await clickByText('Зона отдыха', 600);
    const before = save().funds;
    const clicked = await clickByText('Отправить на отдых', 800);
    await clickByText('Зона отдыха', 400);
    await clickByText('Персонал синдиката', 500);
    const rosterText = document.body.innerText;
    await clickByText('Зона отдыха', 400);
    const state = save();
    return {
      clicked,
      before,
      funds: state.funds,
      placements: state.restZone?.placements ?? [],
      totalSpent: state.restZone?.totalSpent ?? 0,
      rosterText,
      body: document.body.innerText
    };
  })()`);

  const placement = sent?.placements?.[0];

  const advanced = await evaluate(`(async () => { ${HELPERS}
    const weeks = [];
    for (let i = 0; i < 5; i++) {
      await dismissModals();
      const button = [...document.querySelectorAll('button')].find(el => el.innerText?.trim() === 'Advance Week');
      if (!button || button.disabled) { weeks.push('blocked'); break; }
      button.click();
      await new Promise(r => setTimeout(r, 700));
      await dismissModals();
      const state = save();
      const first = state.restZone?.placements?.[0];
      weeks.push({
        week: state.week,
        weeksRemaining: first?.weeksRemaining ?? null,
        fatigue: first ? state.roster.find(c => c.id === 'op_worn')?.exhaustionLevel : state.roster.find(c => c.id === 'op_worn')?.exhaustionLevel,
        health: state.roster.find(c => c.id === 'op_worn')?.healthLevel,
        totalWeeksHosted: state.restZone?.totalWeeksHosted ?? 0
      });
    }
    await clickByText('Зона отдыха', 600);
    return { weeks, body: document.body.innerText, log: save().log ?? [] };
  })()`);

  const finalText = advanced?.body ?? '';
  const weekState = advanced?.weeks ?? [];

  const report = {
    tabInLeftMenu: initialText.includes('Нужен уход') && initialText.includes('Программа отдыха') && initialText.includes('Места и расширение'),
    listsWornOperative: initialText.includes('Fatima Al-Sayed') && initialText.includes('Отдых и восстановление'),
    hidesStableOperative: !initialText.includes('Vera Volkova'),
    recommendedRoute: initialText.includes('Рекомендовано: зона отдыха'),
    salonRouteOpens: salon?.clicked === true && salon?.body?.includes('Imperial Beauty Salon') === true,
    salonRoutePreselects: salon?.operative === 'op_worn'
      && salon?.treatment === 't_skin_condition'
      && salon?.venue === 'beauty_salon',
    sentToRest: sent?.clicked === true && placement?.programName === 'Полная реабилитация' && placement?.weeksTotal === 4,
    chargedUpfront: sent?.before - sent?.funds === 7200 && sent?.totalSpent === 7200,
    restingShowsInTab: sent?.body?.includes('Сейчас на отдыхе') === true && sent?.body?.includes('Fatima Al-Sayed'),
    restingBadgeInRoster: sent?.rosterText?.includes('ОТДЫХ · 4 НЕД.') === true,
    // 85 fatigue at -22 per week: Exhausted, Tired, Rested, then discharged on
    // the fourth week, after which she is out of the rest zone for good.
    weeklyRecovery: weekState[0]?.fatigue === 'Exhausted'
      && weekState[1]?.fatigue === 'Tired'
      && weekState[2]?.fatigue === 'Rested'
      && weekState[2]?.weeksRemaining === 1
      && weekState[3]?.health === 'Pristine',
    dischargedAfterProgram: weekState[3]?.weeksRemaining === null && finalText.includes('Зона отдыха пуста'),
    dischargeLogged: (advanced?.log ?? []).some(entry => entry.includes('REST ZONE')),
    shot: SHOT
  };

  const ok = Object.entries(report).filter(([, value]) => typeof value === 'boolean').every(([, value]) => value);
  console.log(JSON.stringify({ ok, report, weeks: weekState, logHead: (advanced?.log ?? []).slice(0, 4) }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}