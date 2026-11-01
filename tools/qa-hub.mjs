// QA the mezzanine hub: log in, start a campaign (which opens Мезонин), open
// the "Разделы игры" panel, jump to a campaign tab, then come back to the map.
export default async function run(page, ui) {
  const result = {};

  await page.evaluate(() => {
    localStorage.setItem(
      "emporium_auth_user",
      JSON.stringify({ login: "qa", password: "qa", createdAt: new Date().toISOString() }),
    );
  });
  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const clickByText = async (text) => {
    const s = await ui.snapshot();
    const re = new RegExp(
      `@(e\\d+) [^\\n]*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    const m = s.match(re);
    if (!m) return false;
    await ui.click(m[1]);
    await page.waitForTimeout(600);
    return true;
  };

  const start = await ui.snapshot({ full: true });
  result.menu = start.split("\n").slice(0, 25).join("\n");

  result.started =
    (await clickByText("Создать и начать игру")) ||
    (await clickByText("Новая игра")) ||
    (await clickByText("Начать игру")) ||
    (await clickByText("Продолжить"));
  await page.waitForTimeout(2000);

  const tree = await ui.snapshot({ full: true });
  result.mezzanineOnStart = tree.includes("Разделы игры");

  result.openedSections = await clickByText("Разделы игры");
  await page.screenshot({ path: "tools/qa-hub.png" });

  result.jumpedToMarket = await clickByText("Глобальный рынок");
  await page.waitForTimeout(800);
  const market = await ui.snapshot({ full: true });
  result.marketShown = market.includes("Глобальный рынок");
  result.mapHiddenOnMarket = !market.includes("Разделы игры");

  result.backToMezzanine = await clickByText("Мезонин");
  await page.waitForTimeout(800);
  const back = await ui.snapshot({ full: true });
  result.mapShownAgain = back.includes("Разделы игры");
  await page.screenshot({ path: "tools/qa-hub-back.png" });
  return result;
}
