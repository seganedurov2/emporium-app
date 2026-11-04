import { describe, expect, it } from 'vitest';
import { advanceCityEconomy, CITY_ECONOMY_BALANCE, GROWTH_DEPOSIT, KIND_LABELS } from './cityEconomyEngine';
import { cityStats, generateCity, placeBuilding, type BuildingKind } from './cityBuilder';
import { serializeCityPlan } from './cityPlanState';

const NOW = 1_000_000;

const findLots = (seed: number, count: number) => {
  const city = generateCity(seed);
  const lots: { x: number; y: number }[] = [];
  const seenLots = new Set<number>();
  for (let y = 0; y < city.size && lots.length < count; y++) {
    for (let x = 0; x < city.size && lots.length < count; x++) {
      const cell = city.cells[y][x];
      // One coordinate per lot: a lot is a 2x2 patch of cells.
      if (cell.type === 'lot' && !seenLots.has(cell.lot)) {
        seenLots.add(cell.lot);
        lots.push({ x, y });
      }
    }
  }
  if (lots.length < count) throw new Error('not enough lots');
  return { city, lots };
};

/** Builds a city with the requested kinds and returns it with a saved plan. */
const cityWith = (kinds: BuildingKind[], seed = 42) => {
  const { city, lots } = findLots(seed, kinds.length);
  kinds.forEach((kind, index) => {
    const placed = placeBuilding(city, lots[index].x, lots[index].y, kind, NOW);
    if (!placed.ok || !placed.building) throw new Error('place failed');
    placed.building.progress = 1;
    placed.building.condition = 1;
  });
  const plan = serializeCityPlan(city, seed, { savedAt: NOW, wasOpenAtSave: false });
  if (!plan) throw new Error('plan missing');
  return { city, plan };
};

const neverRandom = () => 0;

describe('city economy engine', () => {
  it('reports an empty town without money lines', () => {
    const result = advanceCityEconomy({ plan: null, week: 3, now: NOW });
    expect(result.report.income).toEqual({ employmentTax: 0, parks: 0 });
    expect(result.report.expenses).toEqual({ upkeep: 0, unemployment: 0 });
    expect(result.report.surplus).toBe(0);
    expect(result.plan).toBeNull();
  });

  it('does not pay a city that is still under construction', () => {
    const { city, lots } = findLots(7, 1);
    placeBuilding(city, lots[0].x, lots[0].y, 'office', NOW);
    const plan = serializeCityPlan(city, 7, { savedAt: NOW, wasOpenAtSave: false });

    const result = advanceCityEconomy({ plan, week: 2, now: NOW, random: neverRandom });
    expect(result.report.built).toBe(0);
    expect(result.report.surplus).toBe(0);
    expect(result.report.started).toEqual([]);
    expect(result.report.log.length).toBeGreaterThan(0);
  });

  it('pays employment tax when residents have local jobs', () => {
    const { plan } = cityWith(['factory', 'house']);
    const result = advanceCityEconomy({ plan, week: 5, now: NOW, random: neverRandom });
    const report = result.report;

    // 8 residents (house), 60 jobs (factory): every resident works.
    expect(report.built).toBe(2);
    expect(report.residents).toBe(8);
    expect(report.jobs).toBe(60);
    expect(report.filledJobs).toBe(8);
    expect(report.unemployed).toBe(0);
    expect(report.income.employmentTax).toBe(8 * (CITY_ECONOMY_BALANCE.taxPerResident + CITY_ECONOMY_BALANCE.taxPerJob));
    expect(report.expenses.upkeep).toBe(2 * CITY_ECONOMY_BALANCE.upkeepPerBuilding);
    expect(report.expenses.unemployment).toBe(0);
    expect(report.surplus).toBe(report.income.employmentTax + report.income.parks - report.expenses.upkeep);
    expect(report.surplus).toBeGreaterThan(0);
  });

  it('charges unemployment when houses have no jobs to offer', () => {
    const { plan } = cityWith(['house', 'house']);
    const result = advanceCityEconomy({ plan, week: 6, now: NOW, random: neverRandom });

    expect(result.report.jobs).toBe(0);
    expect(result.report.unemployed).toBe(16);
    expect(result.report.income.employmentTax).toBe(0);
    expect(result.report.expenses.unemployment).toBe(Math.round(16 * CITY_ECONOMY_BALANCE.unemploymentCostPerResident));
    expect(result.report.surplus).toBeLessThan(0);
    expect(result.report.started).toEqual([]);
  });

  it('adds the park subsidy and discourages growth below the occupancy floor', () => {
    const { plan } = cityWith(['park', 'park', 'park']);
    const result = advanceCityEconomy({ plan, week: 7, now: NOW, random: neverRandom });
    expect(result.report.income.parks).toBe(3 * CITY_ECONOMY_BALANCE.parkSubsidy);
    // No jobs and no residents: the parks give a surplus, but nobody works.
    expect(result.report.surplus).toBeGreaterThan(0);
    expect(result.report.started).toEqual([]);
  });

  it('scales taxes down for a run-down town', () => {
    const { city, plan } = cityWith(['house', 'shop']);
    const healthy = advanceCityEconomy({ plan, week: 8, now: NOW, random: neverRandom });
    for (const row of city.cells) {
      for (const cell of row) {
        if (cell.type === 'lot' && cell.building) cell.building.condition = 0.2;
      }
    }
    const worn = serializeCityPlan(city, 42, { savedAt: NOW, wasOpenAtSave: false });
    const wornReport = advanceCityEconomy({ plan: worn, week: 8, now: NOW, random: neverRandom });

    // house (8 residents) + shop (6 jobs): 6 residents employed.
    expect(wornReport.report.income.employmentTax).toBeLessThan(healthy.report.income.employmentTax);
    expect(wornReport.report.income.employmentTax).toBe(
      Math.round(6 * (CITY_ECONOMY_BALANCE.taxPerResident + CITY_ECONOMY_BALANCE.taxPerJob) * (0.6 + 0.4 * 0.2))
    );
  });

  it('never spends more than the growth budget allows', () => {
    const { plan } = cityWith(['factory', 'house']);
    const result = advanceCityEconomy({
      plan,
      week: 9,
      now: NOW,
      random: neverRandom,
      balance: { taxPerResident: 20, taxPerJob: 20, growthBudgetShare: 0.05 },
    });
    expect(result.report.constructionSpend).toBe(0);
    expect(result.report.started).toEqual([]);
  });

  it('keeps the plan in sync when growth adds a building', () => {
    // 60 factory jobs and 80 residents: the town is staffed and can grow.
    const houses = Array<BuildingKind>(10).fill('house');
    const { plan } = cityWith(['factory', ...houses]);
    const before = plan.buildings.length;
    const result = advanceCityEconomy({
      plan,
      week: 10,
      now: NOW,
      random: neverRandom,
      balance: { taxPerResident: 20, taxPerJob: 20, growthBudgetShare: 1 },
    });

    // random() === 0 draws houses; both fit inside the max-per-week cap.
    expect(result.report.started).toEqual(['house', 'house']);
    expect(result.report.constructionSpend).toBe(2 * GROWTH_DEPOSIT.house);
    expect(result.plan?.buildings.length).toBe(before + 2);
    expect(result.plan?.seed).toBe(plan.seed);
    expect(result.report.log.join(' ')).toContain('заложил');
    expect(result.report.log.join(' ')).toContain(KIND_LABELS.house);
  });

  it('does not replay the offline catch-up after applying a week', () => {
    const { plan } = cityWith(['house', 'shop']);
    const first = advanceCityEconomy({ plan, week: 10, now: NOW + 5_000, random: neverRandom });
    const second = advanceCityEconomy({ plan: first.plan, week: 11, now: NOW + 5_000, random: neverRandom });
    expect(second.report.residents).toBe(first.report.residents);
    expect(second.report.surplus).toBe(first.report.surplus);
  });

  it('survives a corrupt plan without inventing income', () => {
    const result = advanceCityEconomy({
      plan: { schemaVersion: 1, seed: 42, buildings: [{ id: 'x' } as never], savedAt: NOW, wasOpenAtSave: false },
      week: 1,
      now: NOW,
    });
    expect(result.report.built).toBe(0);
    expect(result.report.surplus).toBe(0);
  });

  it('matches the builder statistics it is derived from', () => {
    const { city, plan } = cityWith(['house', 'shop', 'park']);
    const stats = cityStats(city);
    const result = advanceCityEconomy({ plan, week: 12, now: NOW, random: neverRandom });
    expect(result.report.residents).toBe(stats.population);
    expect(result.report.jobs).toBe(stats.jobs);
    expect(result.report.built).toBe(stats.built);
  });
});
