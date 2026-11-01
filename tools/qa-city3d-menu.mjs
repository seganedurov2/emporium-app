// QA the 3D toggle lives in the palette panel and the 2D mode still works.
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
  await clickByText("Новая игра");
  await page.waitForTimeout(2500);
  await clickByText("Создать и начать игру");
  await page.waitForTimeout(3000);
  await clickByText("Стройка города");
  await page.waitForTimeout(3000);

  // 3D -> 2D -> 3D toggle from the palette panel.
  result.to2d = await clickByText("2D");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "tools/qa-city2d.png" });
  result.to3d = await clickByText("3D");
  await page.waitForTimeout(1500);

  // Build a few through the 2D-ish path: palette click then canvas click.
  await clickByText("Офис");
  const box = await page.locator("canvas").last().boundingBox();
  if (box) {
    await page.mouse.click(
      box.x + box.width / 2 + 40,
      box.y + box.height / 2 - 20,
    );
    await page.waitForTimeout(600);
  }
  result.detail = (await ui.snapshot({ full: true }))
    .split("\n")
    .slice(0, 20)
    .join("\n");
  await page.screenshot({ path: "tools/qa-city3d-office.png" });
  return result;
}
