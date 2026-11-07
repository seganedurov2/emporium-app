# Release Plan 0.6.4 — "Экономика недели"

## Цель
Баланс доходов/расходов, отчёты, защита от NaN.

## Фокус
- Стабильность и обратная совместимость сохранений (`migrateCampaignState`).
- Модули `*Engine.ts` не переписывать радикально; React-обвязку выносить аккуратно.
- Тесты/линт/сборка должны проходить.

## Задачи
- [x] Реализовать/уточнить механики релиза: `weeklyEconomy.ts` (safeNumber/safeAmount/computeWeeklyTotals) для защиты недельных расчётов от NaN/Infinity.
- [ ] Обновить UI/тексты (i18n где применимо).
- [x] Добавить/обновить unit-тесты: `weeklyEconomy.test.ts`.
- [x] Обновить `changelog.txt` и версию в `package.json` (0.6.4).

## Критерии приёмки
- [ ] `npm run lint` — без ошибок (или зафиксированный baseline).
- [x] `npm test` / `vitest run` — проходят (weeklyEconomy/quests/gameEngine).
- [x] `npx tsc -b` — успешен.
- [x] Старые сохранения загружаются (без смены формата).

## Примечания
- Emporium-app (React/Vite/TS). Текущая ветка работы: `axiomatic-decision`.
- Не менять формат сохранений без миграции.
