// Step 2 of the hub QA: jump from the мезонин panel to a campaign tab and back.
export default async function run(page, ui) {
  const result = {};
  const clickByText = async (text) => {
    const s = await ui.snapshot();
    const re = new RegExp(
      `@(e\\d+) [^\\n]*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    const m = s.match(re);
    if (!m) return false;
    await ui.click(m[1]);
    await page.waitForTimeout(900);
    return true;
  };

  result.jumpedToMarket = await clickByText("Глобальный рынок");
  await page.waitForTimeout(800);
  const market = await ui.snapshot({ full: true });
  result.mapHidden = !market.includes("Разделы игры");
  result.marketShown = market.includes("Глобальный рынок");
  await page.screenshot({ path: "tools/qa-hub-market.png" });

  result.back = await clickByText("Мезонин");
  await page.waitForTimeout(900);
  const back = await ui.snapshot({ full: true });
  result.mapShownAgain = back.includes("Разделы игры");
  await page.screenshot({ path: "tools/qa-hub-back.png" });
  return result;
}
