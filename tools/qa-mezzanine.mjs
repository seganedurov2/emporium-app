/**
 * Smoke test for the mezzanine hub: campaign -> hub hotkeys -> saved view ->
 * reload restore.
 *
 * Run against a built app (npm run build && npm run preview):
 *   npm run qa:mezzanine
 * or by hand:
 *   node "<browser-automation>/browser.mjs" http://localhost:4178/ \
 *        --script ./tools/qa-mezzanine.mjs
 *
 * The app opens behind a local-only auth screen. Its provider does not survive
 * a reload while a round-trip is in flight, so the script seeds the same
 * account the register form writes and reloads instead of typing it. Checks
 * avoid shared strings: "Горячие клавиши" also appears in the pause menu, so
 * the keymap is matched on its dialog element.
 */

const TEST_USER = { login: 'qa_mezzanine', password: 'qa_mezzanine' };

async function seedAccount(page) {
  // The auth provider only reads localStorage on mount, so seeding it and
  // reloading raced the first render. Sign in through the real form instead:
  // an unknown login switches to register, where the same test user is created.
  const textInputs = () => page.locator('input[type="text"]');
  const passInputs = () => page.locator('input[type="password"]');

  if (await textInputs().first().count()) {
    await textInputs().first().fill(TEST_USER.login);
    await passInputs().first().fill(TEST_USER.password);
    await page.locator('button', { hasText: /^Войти$/ }).first().click();
    await page.waitForTimeout(1200);
  }

  // Register screen (first run) — log in screen is gone, fill it and submit.
  const register = page.locator('button', { hasText: /^Зарегистрироваться$/ }).first();
  if (await register.count()) {
    await textInputs().first().fill(TEST_USER.login);
    const passes = passInputs();
    await passes.nth(0).fill(TEST_USER.password);
    await passes.nth(1).fill(TEST_USER.password);
    await register.click();
  }

  // Wait for the title screen instead of a fixed delay: a cold preview server
  // takes seconds to hydrate, and a short sleep leaves the auth screen up.
  await page.getByRole('button', { name: /Продолжить кампанию|Новая игра/ }).first().waitFor({ timeout: 40000 });
}

async function sampleVisibleCanvas(page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 0;
    const box = canvas.getBoundingClientRect();
    const dpr = canvas.width / Math.max(1, box.width);
    const x = Math.max(0, -box.left) * dpr;
    const y = Math.max(0, -box.top) * dpr;
    const w = Math.min(canvas.width - x, globalThis.innerWidth * dpr);
    const h = Math.min(canvas.height - y, globalThis.innerHeight * dpr);
    if (w <= 0 || h <= 0) return 0;
    const data = canvas.getContext('2d').getImageData(x, y, Math.floor(w), Math.floor(h)).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return painted;
  });
}

async function openHub(page, ui) {
  // "Продолжить" opens the character screen on a slot-less profile, so the
  // smoke test always starts a fresh campaign: Новая игра -> Создать игру.
  const newGame = page.locator('button', { hasText: 'Новая игра' }).first();
  if (await newGame.count()) {
    await newGame.click();
    await page.getByRole('button', { name: /Создать и начать игру/ }).first().waitFor({ timeout: 15000 });
  }
  const create = page.locator('button', { hasText: 'Создать и начать игру' }).first();
  if (await create.count()) {
    await create.click();
  }
  await page.getByRole('button', { name: /Мезонин/ }).first().waitFor({ timeout: 20000 });

  const snapshot = await ui.snapshot();
  const mezzanine = snapshot.match(/@(e\d+) button "[^"]*Мезонин[^"]*"/);
  if (!mezzanine) return { opened: false, snapshot };
  await ui.click(mezzanine[1]);
  await page.locator('canvas').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const canvasCount = await page.locator('canvas').count();
  return { opened: canvasCount > 0, canvasCount, snapshot };
}

export default async function run(page, ui) {
  await seedAccount(page);

  const campaign = await openHub(page, ui);
  const steps = { hubOpened: campaign.opened, canvasCount: campaign.canvasCount ?? 0 };
  if (!campaign.opened) {
    return { steps, snapshot: String(campaign.snapshot).slice(0, 2500) };
  }

  // 3 -> Gomel region, which lands on the Kalinkovichi city map.
  await page.keyboard.press('3');
  await page.waitForTimeout(1200);
  const afterRegion = await page.locator('body').innerText();
  steps.regionHotkey = /Гомельская|Калинковичи/.test(afterRegion);

  // The map really drew something. A blank canvas is the regression this
  // guards. The canvas is centred and larger than the viewport, so its origin
  // sits at negative screen coordinates: sample the part that is on screen.
  steps.canvasPaintedPx = await sampleVisibleCanvas(page);

  // Overlay checks use DOM state, not page text shared with other panels.
  await page.keyboard.press('?');
  await page.waitForTimeout(600);
  steps.keymapDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog) && dialog.getBoundingClientRect().height > 100;
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  steps.keymapClosed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  steps.pauseMenu = await page.locator('body').innerText().then(text => text.includes('Вернуться'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // The app autosaves the campaign while playing; check the serialized block.
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(name => /emporium_save_slot_\d/.test(name));
    if (!key) return null;
    try {
      return { key, mezzanine: JSON.parse(localStorage.getItem(key)).mezzanine ?? null };
    } catch {
      return null;
    }
  });
  steps.savedMezzanine = stored?.mezzanine ?? null;
  steps.savedIsGomelCity = stored?.mezzanine?.selectedRegionId === 'gomel'
    && stored?.mezzanine?.viewMode === 'city';

  // Reload: the hub must come back on the saved region, not a random map.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const resumed = await openHub(page, ui);
  const afterReload = await page.locator('body').innerText();
  steps.restoredRegionAfterReload = resumed.opened && /Гомельская|Калинковичи/.test(afterReload);
  steps.restoredPaintedPx = await sampleVisibleCanvas(page);

  return { steps };
}
