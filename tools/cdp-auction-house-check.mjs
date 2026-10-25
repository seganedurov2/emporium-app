import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Yandex/YandexBrowser/Application/browser.exe";
const URL_ = process.argv[2] || "http://localhost:5190/";
const PORT = 9346;
const profile = mkdtempSync(join(tmpdir(), "cdp-auction-house-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"
], { stdio: "ignore" });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getWsUrl() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find(target => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("DevTools endpoint did not start.");
}

const ws = new WebSocket(await getWsUrl());
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
const browserErrors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) {
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') browserErrors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
    return;
  }
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
  await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
).result?.value;

try {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL_ });
  await sleep(10000);
  const report = await evaluate(`(async () => {
    const auction = await import('/src/auctionHouseEngine.ts');
    const buildingsEngine = await import('/src/buildingsEngine.ts');
    const employeesEngine = await import('/src/employeesEngine.ts');
    const save = await import('/src/saveState.ts');
    const caravan = { id: 'caravan-test', name: 'Тестовый караван', originRegion: 'Европа', destRegion: 'Азия', leaderName: 'CEO', investment: 10000, potentialProfit: 35000, weeksTotal: 1, weeksRemaining: 0, status: 'completed' };
    const autoLot = auction.createGoodsLot(caravan, 8, () => 0);
    const auctioneer = { id: 'auctioneer-1', name: 'Тестовый аукционист', specialty: 'auctioneer', gender: 'men', skill: 70, experience: 0, morale: 80, weeklyWage: 1000, status: 'active', assignedBuildingId: 'auction_house', hiredWeek: 1 };
    const appraiser = { id: 'appraiser-1', name: 'Тестовый оценщик', specialty: 'appraiser', gender: 'women', skill: 70, experience: 0, morale: 80, weeklyWage: 900, status: 'active', assignedBuildingId: 'auction_house', hiredWeek: 1 };
    const buildings = buildingsEngine.createInitialBuildings().map(building => building.id === 'auction_house'
      ? { ...building, level: 1, assignedEmployeeIds: [auctioneer.id, appraiser.id] }
      : building);
    const staff = auction.getAuctionHouseStaff(buildings, [auctioneer, appraiser]);
    const effects = buildingsEngine.calculateBuildingWeeklyEffects(buildings, [auctioneer, appraiser]);
    const appraisedLot = auction.createGoodsLot(caravan, 8, () => 0, staff.appraiser);
    const baseQuote = auction.quoteGoodsSale(autoLot);
    const staffedQuote = auction.quoteGoodsSale(appraisedLot, staff.auctioneer, effects.auctioneerSaleBonus);
    const initial = auction.createEmptyAuctionHouse();
    initial.pendingLots.push(appraisedLot);
    const saleResult = auction.sellGoodsLot(initial, appraisedLot.id, 9, staff.auctioneer, effects.auctioneerSaleBonus);
    const repeatSale = auction.sellGoodsLot(saleResult.state, appraisedLot.id, 9, staff.auctioneer, effects.auctioneerSaleBonus);
    const vacancySpecialties = employeesEngine.getVacantSpecialties(buildings, [], [], 0);
    const fullPool = Array.from({ length: 5 }, (_, index) => ({ id: 'candidate-' + index, name: 'Кандидат ' + index, specialty: 'guard', gender: 'men', skill: 50, experience: 0, morale: 70, weeklyWage: 800 }));
    const prioritizedPool = employeesEngine.ensureEmployeeCandidatesForVacancies(fullPool, vacancySpecialties, 9);
    const oldSave = save.createInitialCampaign({ fresh: true, week: 4 });
    delete oldSave.auctionHouse;
    oldSave.version = 3;
    const migrated = save.migrateCampaignState(oldSave);
    const assignedCharacter = { id: 'character-workplace-only', assignedVenue: 'auction_house' };
    return {
      automaticValuation: autoLot.appraisedValue === 35000 && autoLot.appraisedBy === 'Автоматическая оценка',
      appraiserRecorded: appraisedLot.appraisedBy === appraiser.name,
      productLotHasCaravanProvenance: appraisedLot.caravanId === caravan.id && appraisedLot.caravanName === caravan.name && appraisedLot.arrivalWeek === 8,
      auctioneerImprovesProceeds: effects.auctioneerSaleBonus === 5 && baseQuote.saleProceeds === 35000 && staffedQuote.saleProceeds === 36750 && staffedQuote.auctioneerBonusPercent === 5,
      saleRemovesLotAndRecordsHistory: saleResult.sale?.saleProceeds === 36750 && saleResult.state.pendingLots.length === 0 && saleResult.state.recentSales.length === 1,
      repeatedSaleIsNoOp: repeatSale.sale === null && repeatSale.state === saleResult.state,
      vacanciesIncludeBothAuctionRoles: vacancySpecialties.includes('auctioneer') && vacancySpecialties.includes('appraiser') && prioritizedPool.some(candidate => candidate.specialty === 'auctioneer') && prioritizedPool.some(candidate => candidate.specialty === 'appraiser'),
      legacySaveMigratesAuctionStateAndBuilding: migrated.version === 4 && migrated.auctionHouse.pendingLots.length === 0 && migrated.auctionHouse.recentSales.length === 0 && migrated.auxiliaryBuildings.some(building => building.id === 'auction_house' && building.level === 0),
      venueAssignmentDoesNotCreateSale: assignedCharacter.assignedVenue === 'auction_house' && !('saleProceeds' in assignedCharacter)
    };
  })()`);

  const initialMenuText = await evaluate(`document.body.innerText.slice(0, 600)`);
  const initialButtonLabels = await evaluate(`[...document.querySelectorAll('button')].map(button => button.innerText.trim())`);
  await evaluate(`(() => [...document.querySelectorAll('button')].find(button => button.innerText.includes('Новая игра'))?.click())()`);
  await sleep(700);
  await evaluate(`(() => [...document.querySelectorAll('button')].find(button => button.innerText.includes('Запустить империю синдиката'))?.click())()`);
  await sleep(1200);
  const navigationLabels = await evaluate(`[...document.querySelectorAll('nav[aria-label="Разделы игры"] button')].map(button => button.innerText.trim())`);
  await evaluate(`(() => [...document.querySelectorAll('nav[aria-label="Разделы игры"] button')].find(button => button.innerText.includes('Аукционный дом'))?.click())()`);
  await sleep(200);
  const auctionText = await evaluate(`document.querySelector('main')?.innerText || ''`);
  const auctionHouseVisible = auctionText.includes('Товаров и персонала для продажи нет') && auctionText.includes('Торговые караваны');
  await evaluate(`(() => [...document.querySelectorAll('nav[aria-label="Разделы игры"] button')].find(button => button.innerText.includes('Отдел кадров'))?.click())()`);
  await sleep(200);
  const hrText = await evaluate(`document.querySelector('main')?.innerText || ''`);
  await evaluate(`(() => [...document.querySelectorAll('article')].find(row => row.querySelector('h4')?.innerText.trim() === 'Аукционный дом')?.querySelector('button')?.click())()`);
  await sleep(250);
  const auctionPosts = await evaluate(`(() => {
    const row = [...document.querySelectorAll('article')].find(item => item.querySelector('h4')?.innerText.trim() === 'Аукционный дом');
    return { selects: row?.querySelectorAll('select').length ?? 0, text: row?.innerText ?? '' };
  })()`);
  await evaluate(`(() => [...document.querySelectorAll('button')].find(button => button.innerText.includes('Показать кандидатов'))?.click())()`);
  await sleep(200);
  const candidateText = await evaluate(`document.querySelector('#employee-candidate-list')?.innerText || ''`);
  report.initialMenuShowsNewGame = initialMenuText.includes('EMPORIUM') && initialButtonLabels.some(label => label.includes('Новая игра'));
  report.sidebarAuctionHouse = navigationLabels.some(label => label.includes('Аукционный дом'));
  report.goodsOnlyEmptyState = auctionHouseVisible;
  report.hrAuctionFacilityVisible = hrText.includes('Аукционный дом') && hrText.includes('оценщик — дополнительный пост');
  report.auctionHouseBuildAndPosts = auctionPosts.selects === 2 && auctionPosts.text.includes('Уровень 1');
  report.auctionHiringCandidates = candidateText.includes('Аукционист') && candidateText.includes('Оценщик товаров');
  report.browserErrors = browserErrors;

  const ok = report && Object.values(report).every(Boolean);
  console.log(JSON.stringify({ ok, report }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws.close();
  chrome.kill();
}
