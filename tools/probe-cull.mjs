export default async function run(page, ui) {
  await page.evaluate(() =>
    localStorage.setItem(
      "emporium_auth_user",
      JSON.stringify({
        login: "qa_mezzanine",
        password: "qa_mezzanine",
        createdAt: new Date().toISOString(),
      }),
    ),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.locator("button", { hasText: "Новая игра" }).first().click();
  await page.waitForTimeout(2500);
  const create = page
    .locator("button", { hasText: "Создать и начать игру" })
    .first();
  if (await create.count()) {
    await create.click();
    await page.waitForTimeout(3500);
  }
  const s = await ui.snapshot();
  const m = s.match(/@(e\d+) button "[^"]*Мезонин[^"]*"/);
  if (m) {
    await ui.click(m[1]);
    await page.waitForTimeout(2500);
  }
  await page.keyboard.press("3");
  await page.waitForTimeout(1500);

  // Read what the effect computes by replaying its geometry with the live
  // canvas size, then check a few tiles against the canvas box.
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    const tile = 48;
    const size = 64;
    const anchorSpan = 28; // city view_RADIUS * 2
    const ox = w / 2;
    const oy = h / 2 - (anchorSpan * tile) / 8;
    const halfW = tile / 2 + 2;
    const halfH = tile / 2 + 2;
    const visible = [];
    let total = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cx = ((x - y) * tile) / 2 + ox;
        const cy = ((x + y) * tile) / 4 + oy;
        if (cx + halfW < 0 || cx - halfW > w) continue;
        if (cy + halfH < 0 || cy - halfH > h) continue;
        total++;
        if (visible.length < 3)
          visible.push({ x, y, cx: Math.round(cx), cy: Math.round(cy) });
      }
    }
    return {
      canvasW: w,
      canvasH: h,
      tile,
      ox,
      oy,
      halfW,
      halfH,
      totalVisible: total,
      sample: visible,
    };
  });
}
