// QA the mezzanine city builder: load campaign, open the tab, enter the city
// plan, place a house, wait for construction and take a screenshot.
export default async function run(page, ui) {
  const result = { steps: [] };
  const snap = async (label) => {
    const s = await ui.snapshot();
    result.steps.push({ label, has: (needle) => s.includes(needle) });
    return s;
  };

  const clickByText = async (text) => {
    const s = await snap(`look for ${text}`);
    const re = new RegExp(
      `@(e\\d+) [^\\n]*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    const m = s.match(re);
    if (!m) return false;
    await ui.click(m[1]);
    await page.waitForTimeout(400);
    return true;
  };

  // Main menu: start a campaign. Buttons are Russian, try the known labels.
  const opened =
    (await clickByText("Создать и начать игру")) ||
    (await clickByText("Новая игра")) ||
    (await clickByText("Начать игру")) ||
    (await clickByText("Продолжить"));
  result.steps.push({ step: "start campaign", opened });

  if (opened) await page.waitForTimeout(1200);

  // Sidebar -> Мезонин
  result.openedMezzanine = await clickByText("Мезонин");
  await page.waitForTimeout(600);

  // City builder button
  result.openedCity = await clickByText("Стройка города");
  await page.waitForTimeout(900);

  // Place a building on the canvas, then a second one further right.
  const box = await page.locator("canvas").first().boundingBox();
  result.canvas = box;
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);
    await page.mouse.click(cx + 70, cy + 35);
    await page.waitForTimeout(400);
    await page.mouse.click(cx - 70, cy - 35);
  }

  // Let the crane animation run.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "tools/qa-city.png" });
  result.after = await ui.snapshot({ full: true });
  return result;
}
