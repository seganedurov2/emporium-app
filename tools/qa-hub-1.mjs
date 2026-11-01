// Step 1 of the hub QA: log in, start a campaign and open the sections panel.
export default async function run(page, ui) {
  const result = {};
  await page.evaluate(() => {
    localStorage.setItem(
      "emporium_auth_user",
      JSON.stringify({
        login: "qa",
        password: "qa",
        createdAt: new Date().toISOString(),
      }),
    );
  });
  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const clickByText = async (text) => {
    const s = await ui.snapshot();
    const re = new RegExp(
      `@(e\\d+) [^\\n]*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    const m = s.match(re);
    if (!m) return false;
    await ui.click(m[1]);
    await page.waitForTimeout(1200);
    return true;
  };

  result.started =
    (await clickByText("Создать и начать игру")) ||
    (await clickByText("Новая игра")) ||
    (await clickByText("Продолжить кампанию"));
  await page.waitForTimeout(2500);

  // Character creation: start the campaign.
  result.confirmed = await clickByText("Создать и начать игру");
  if (result.confirmed) await page.waitForTimeout(3000);

  const tree = await ui.snapshot({ full: true });
  result.mezzanineOnStart = tree.includes("Разделы игры");
  result.screen = tree.split("\n").slice(0, 40).join("\n");

  result.openedSections = await clickByText("Разделы игры");

  // Jump to a campaign tab from the panel, then come back to the map.
  result.jumpedToMarket = await clickByText("Глобальный рынок");
  await page.waitForTimeout(1200);
  const market = await ui.snapshot({ full: true });
  result.marketShown = market.includes("Глобальный рынок");

  result.backToMap = await clickByText("Мезонин");
  await page.waitForTimeout(1200);
  const back = await ui.snapshot({ full: true });
  result.mapShownAgain = back.includes("Разделы игры");
  await page.screenshot({ path: "tools/qa-hub.png" });
  return result;
}
