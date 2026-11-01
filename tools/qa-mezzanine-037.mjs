/**
 * QA smoke for 0.3.7 (mezzanine persistence + hotkeys).
 *
 * Run: node "C:\Users\тттт\.codegpt\skills\browser-automation\browser.mjs" \
 *        http://localhost:4178/ --script ./tools/qa-mezzanine-037.mjs
 */
export default async function run(page, ui) {
  const report = { steps: [] };

  // The app may start on the login screen; enter a campaign if needed.
  const first = await ui.snapshot();
  if (/button "(Войти|Играть|Начать)"/.test(first) && !/Мезонин/.test(first)) {
    const start = first.match(/@(e\d+) button "[^"]*"/);
    if (start) await ui.click(start[1]);
    await page.waitForTimeout(800);
  }

  const mezz = page.getByText("Мезонин", { exact: false }).first();
  if (await mezz.count()) {
    await mezz.click();
    await page.waitForTimeout(1200);
  }

  const canvas = await page.locator("canvas").count();
  report.steps.push({ canvas });

  if (canvas === 0) {
    report.snapshot = (await ui.snapshot()).slice(0, 3000);
    report.bodyText = (await page.locator("body").innerText()).slice(0, 800);
    return report;
  }

  // Hotkey 3 -> Gomel, then K is not used; check keymap with '?'.
  const before = await page.evaluate(
    () => document.querySelectorAll("canvas").length,
  );
  await page.keyboard.press("3");
  await page.waitForTimeout(700);
  const afterRegion = await page.locator("body").innerText();
  report.steps.push({
    hotkey3:
      afterRegion.includes("Гомельская") || afterRegion.includes("Калинковичи"),
  });

  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  const keymapText = await page.locator("body").innerText();
  report.steps.push({
    keymap: keymapText.includes("Горячие клавиши"),
    canvasBefore: before,
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Persisted view: the campaign state should now carry gomel + city view.
  const saved = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.includes("emporium_save"),
    );
    for (const k of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(k));
        if (parsed && parsed.mezzanine)
          return { key: k, mezzanine: parsed.mezzanine };
      } catch {
        /* not JSON */
      }
    }
    return null;
  });
  report.steps.push({ savedInStorage: saved });

  // Reload and confirm the hub comes back on the same region.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const afterReload = await page.locator("body").innerText();
  report.steps.push({
    afterReloadShowsRegion:
      afterReload.includes("Гомельская") || afterReload.includes("Калинковичи"),
  });

  return report;
}
