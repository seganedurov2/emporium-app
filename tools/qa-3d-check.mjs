/**
 * 3D hub smoke test for the split three.js chunks.
 *
 * Opens the mezzanine, switches to the 3D map (the view that used to throw
 * "a is not a constructor" from a three-vendor chunk), and reports whatever the
 * page logged. Run against a preview server:
 *   npx vite preview --port 4178 --strictPort
 *   node "<browser-automation>/browser.mjs" http://localhost:4178/ \
 *        --script ./tools/qa-3d-check.mjs
 */
const TEST_USER = { login: "qa_3d", password: "qa_3d" };

async function signIn(page) {
  const textInputs = page.locator('input[type="text"]');
  if (await textInputs.first().count()) {
    await textInputs.first().fill(TEST_USER.login);
    await page
      .locator('input[type="password"]')
      .first()
      .fill(TEST_USER.password);
    await page
      .locator("button", { hasText: /^Войти$/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  const register = page
    .locator("button", { hasText: /^Зарегистрироваться$/ })
    .first();
  if (await register.count()) {
    await textInputs.first().fill(TEST_USER.login);
    const passes = page.locator('input[type="password"]');
    await passes.nth(0).fill(TEST_USER.password);
    await passes.nth(1).fill(TEST_USER.password);
    await register.click();
  }
  await page
    .getByRole("button", { name: /Продолжить кампанию|Новая игра/ })
    .first()
    .waitFor({ timeout: 40000 });
}

async function openHub(page) {
  const newGame = page.locator("button", { hasText: "Новая игра" }).first();
  if (await newGame.count()) {
    await newGame.click();
    await page
      .getByRole("button", { name: /Создать и начать игру/ })
      .first()
      .waitFor({ timeout: 15000 });
    await page
      .locator("button", { hasText: "Создать и начать игру" })
      .first()
      .click();
  }
  await page
    .getByRole("button", { name: /Мезонин/ })
    .first()
    .waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Мезонин/ }).first().waitFor({ timeout: 20000 });
  // "Мезонин" is also the warehouse tab ("Складской мезонин"); click the hub link
  // by its exact accessible name.
  await page.getByRole("button", { name: "Мезонин", exact: true }).first().click();
  await page.locator("canvas").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
}

export default async function run(page, ui) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/localhost:5175/.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });

  await signIn(page);
  try {
    await openHub(page);
  } catch (openError) {
    return {
      openFailed: openError.message.split("\n")[0],
      snapshot: (await ui.snapshot()).slice(0, 4000),
      errors,
    };
  }

  // K toggles the 3D map; the hotkey table owns it.
  await page.keyboard.press("k");
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    return {
      canvases: canvases.length,
      sized: canvases.filter(
        (canvas) => canvas.width > 100 && canvas.height > 100,
      ).length,
      loading3d: document.body.innerText.includes("Загрузка 3D-карты"),
      gps: /GPS/.test(document.body.innerText),
    };
  });

  return { ...state, errors };
}
