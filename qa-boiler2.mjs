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

  out.clickedNewGame = await clickByText("Новая игра");
  await page.waitForTimeout(2500);
  out.afterNewGame = (await page.locator("body").innerText()).slice(0, 1200);

  const start = page
    .getByRole("button", { name: /Начать|Запустить|Создать кампанию|Старт/i })
    .first();
  if ((await start.count()) > 0) {
    await start.click();
    await page.waitForTimeout(3000);
    out.afterStart = (await page.locator("body").innerText()).slice(0, 1200);
  }

  const boiler = page
    .getByRole("button", { name: "Котельная", exact: true })
    .first();
  out.boilerCount = await boiler.count();
  if (out.boilerCount > 0) {
    await boiler.click();
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText();
    out.hasHeading = text.includes("Котельная — тепловой контур синдиката");
    out.hasFuel = text.includes("Топливный склад");
    out.hasForecast = text.includes("Прогноз на неделю");
    out.body = text.slice(0, 2500);
  }
  return out;
}
