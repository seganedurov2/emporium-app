const BOOT = 45000;

export default async function run(page) {
  await page.waitForFunction(() => /Вход в аккаунт|EMPORIUM/.test(document.body.innerText), undefined, { timeout: BOOT });
  const textInputs = () => page.locator('input[type="text"]');
  const passInputs = () => page.locator('input[type="password"]');

  if (await page.getByText('Вход в аккаунт').count()) {
    await textInputs().first().fill('qa_mezzanine');
    await passInputs().first().fill('qa_mezzanine');
    await page.locator('button', { hasText: /^Войти$/ }).first().click();
    await page.waitForTimeout(1500);
  }
  const reg = page.locator('button', { hasText: /^Зарегистрироваться$/ }).first();
  if (await reg.count()) {
    await textInputs().first().fill('qa_mezzanine');
    const passes = passInputs();
    await passes.nth(0).fill('qa_mezzanine');
    await passes.nth(1).fill('qa_mezzanine');
    await reg.click();
    await page.waitForTimeout(2500);
  }

  const ng = page.getByRole('button', { name: 'Новая игра' }).first();
  if (await ng.count()) {
    await ng.click();
    await page.waitForTimeout(2500);
    const create = page.getByRole('button', { name: 'Создать и начать игру' }).first();
    if (await create.count()) { await create.click(); await page.waitForTimeout(4000); }
  }

  // Go to the achievements tab, where the script panel lives.
  const metaTab = page.getByRole('button', { name: /Достижения/ }).first();
  if (await metaTab.count()) { await metaTab.click(); await page.waitForTimeout(2000); }

  const heading = page.getByText('Сценарий кампании').first();
  const found = await heading.count();
  if (found) { await heading.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await page.screenshot({ path: 'logs/script-panel.png' }); }

  const text = await page.evaluate(() => document.body.innerText);
  return {
    panelFound: found,
    thesis: text.includes('От стартового капитала до первой стабильной прибыли'),
    objectives: ['Казна', 'Команда', 'Источники дохода'].filter(t => text.includes(t)),
    beat: text.includes('Первый серьёзный заказ'),
    weeksLeft: (text.match(/недель до конца акта: \d+/) || [null])[0],
    acts: ['Учреждение', 'Экспансия', 'Синдикат', 'Отчёт'].filter(t => text.includes(t)),
    headerBadge: text.includes('Акт 1 · Учреждение')
  };
}