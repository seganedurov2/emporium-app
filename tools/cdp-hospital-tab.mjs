// Renders the Hospital tab in the live app and reports what is on screen.
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
const SHOT = process.argv[3] || 'tools/hospital-tab.png';
const PORT = 9352;
const profile = mkdtempSync(join(tmpdir(), 'cdp-hospital-tab-'));
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

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  await sleep(4000);

  const opened = await evaluate(`(async () => {
    const clickExact = async (label, wait = 600) => {
      const node = [...document.querySelectorAll('button')].find(el => el.innerText?.trim() === label);
      if (!node) return false;
      node.click();
      await new Promise(r => setTimeout(r, wait));
      return true;
    };
    await clickExact('New Game');
    await clickExact('Launch Syndicate Empire', 1200);
    const nav = [...document.querySelectorAll('button')].find(el => el.innerText?.trim() === 'Больница');
    if (!nav) return { foundNav: false };
    nav.click();
    await new Promise(r => setTimeout(r, 500));
    return {
      foundNav: true,
      body: document.body.innerText,
      quantityInputs: [...document.querySelectorAll('input[type=number]')].length
    };
  })()`);

  const text = opened?.body ?? '';
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));

  const report = {
    foundNav: opened?.foundNav === true,
    heading: text.includes('Больница и родильный дом'),
    wardsSection: text.includes('Палаты') && text.includes('Родильная палата') && text.includes('Реанимационная палата'),
    equipmentSection: text.includes('Медицинское оборудование') && text.includes('Стерильный хирургический набор'),
    quantitySteppers: opened?.quantityInputs >= 8,
    patientsSection: text.includes('Пациенты и роженицы'),
    staffSection: text.includes('Медсёстры и акушерки'),
    hireLink: text.includes('Нанять в отделе кадров'),
    ledgerSection: text.includes('Журнал больницы'),
    shot: SHOT
  };

  const ok = Object.values(report).filter(value => typeof value === 'boolean').every(Boolean);
  console.log(JSON.stringify({ ok, report }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
}