export default async function run(page, ui) {
  const out = { steps: [] };
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const clickByText = async (text) => {
    const loc = page.getByRole("button", { name: text, exact: false }).first();
    if ((await loc.count()) === 0) return false;
    await loc.click();
    return true;
  };

  await clickByText("Новая игра");
  await page.waitForTimeout(2500);
  const start = page
    .getByRole("button", { name: /Создать и начать игру/i })
    .first();
  if ((await start.count()) > 0) {
    await start.click();
    await page.waitForTimeout(3000);
  }

  await page
    .getByRole("button", { name: "Котельная", exact: true })
    .first()
    .click();
  await page.waitForTimeout(1500);

  // Buy 200 coal.
  const buy = page.getByRole("button", { name: /Купить —/ }).first();
  out.buyCount = await buy.count();
  if (out.buyCount > 0) {
    await buy.click();
    await page.waitForTimeout(800);
  }
  out.afterBuy =
    (await page.locator("body").innerText()).match(
      /Котельная: топливо закуплено[^\n]*/,
    )?.[0] ?? null;

  // Advance a week.
  const nextWeek = page
    .getByRole("button", { name: /Следующая неделя/i })
    .first();
  out.nextWeekCount = await nextWeek.count();
  if (out.nextWeekCount > 0) {
    await nextWeek.click();
    await page.waitForTimeout(2500);
  }
  const text = await page.locator("body").innerText();
  out.week = text.match(/НЕДЕЛЯ\s*\n?\s*(\d+)/)?.[1] ?? null;
  out.boilerLog = text.match(/Котельная:[^\n]*/g)?.slice(0, 4) ?? [];
  out.temperature =
    text.match(/Температура контура\s*\n?\s*([\d.]+°C)/)?.[1] ?? null;
  out.coalStock = text.match(/Уголь\s*\n?\s*(\d+) ед\./)?.[1] ?? null;
  out.consoleErrors = [];
  return out;
}
