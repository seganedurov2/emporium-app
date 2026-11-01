export default async function run(page, ui) {
  const out = {};
  await page.evaluate(() => localStorage.setItem('emporium_auth_user', JSON.stringify({ login: 'qa_mezzanine', password: 'qa_mezzanine', createdAt: new Date().toISOString() })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('button', { hasText: 'Новая игра' }).first().click();
  await page.waitForTimeout(2500);
  const create = page.locator('button', { hasText: 'Создать и начать игру' }).first();
  if (await create.count()) { await create.click(); await page.waitForTimeout(3500); }
  const s = await ui.snapshot();
  const m = s.match(/@(e\d+) button "[^"]*Мезонин[^"]*"/);
  if (m) { await ui.click(m[1]); await page.waitForTimeout(2500); }
  await page.keyboard.press('3');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  out.geo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const b = c.getBoundingClientRect();
    return { top: Math.round(b.top), left: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), vh: innerHeight, scrollY: window.scrollY };
  });
  await page.screenshot({ path: 'logs/hub-now.png' });
  return out;
}