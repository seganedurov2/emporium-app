// QA the 3D city plan: log in, start a campaign, open "Стройка города",
// autobuild a district and look at the rendered town.
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
    await page.waitForTimeout(1000);
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

  result.started = await clickByText("Новая игра");
  await page.waitForTimeout(2500);
  result.confirmed = await clickByText("Создать и начать игру");
  await page.waitForTimeout(3000);

  result.openedCity = await clickByText("Стройка города");
  await page.waitForTimeout(3000);

  const canvasBefore = await page.locator("canvas").count();
  result.canvases = canvasBefore;

  result.autobuilt = await clickByText("Застройка");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "tools/qa-city3d-building.png" });

  // Let several buildings finish.
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(2500);
    await clickByText("Застройка");
  }
  await page.waitForTimeout(14000);
  await page.screenshot({ path: "tools/qa-city3d.png" });

  // Click the middle of the 3D canvas to place a building there.
  const box = await page.locator("canvas").last().boundingBox();
  result.canvasBox = box;
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1500);
  }
  result.toastOrDetail = (await ui.snapshot({ full: true }))
    .split("\n")
    .slice(0, 12)
    .join("\n");
  await page.screenshot({ path: "tools/qa-city3d-click.png" });
  return result;
}
