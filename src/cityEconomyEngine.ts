/**
 * City economy — the weekly bridge between the city-builder plan and the
 * campaign treasury.
 *
 * The city plan (`src/cityBuilder.ts`) knows how many residents and jobs the
 * town has; this module turns that into money once per week: municipal taxes
 * from residents holding jobs, a small park subsidy, utility upkeep for every
 * finished building, a social cost for residents nobody employs, and — when the
 * town is healthy enough — new plots breaking ground.
 *
 * Everything is pure and deterministic (randomness is injected), so the weekly
 * cycle is testable without React, the DOM or localStorage.
 */

import {
  BLOCK_STYLES,
  cityStats,
  placeBuilding,
  type BuildingKind,
  type CityState,
} from './cityBuilder';
import { restoreCityPlan, serializeCityPlan, type CityPlanSave } from './cityPlanState';

export interface CityEconomyBalance {
  /** Weekly municipal tax per employed resident. */
  taxPerResident: number;
  /** Weekly municipal tax per filled working job. */
  taxPerJob: number;
  /** Fixed weekly subsidy for every finished park. */
  parkSubsidy: number;
  /** Weekly street/utility upkeep for every finished building. */
  upkeepPerBuilding: number;
  /** Weekly social cost for every resident who has no job in town. */
  unemploymentCostPerResident: number;
  /** Share of jobs that must be filled before the town starts growing (0..1). */
  growthMinOccupancy: number;
  /** Share of the weekly surplus set aside to fund new construction. */
  growthBudgetShare: number;
  /** Maximum number of new constructions started in one week. */
  maxGrowthStarts: number;
}

export const CITY_ECONOMY_BALANCE: CityEconomyBalance = {
  taxPerResident: 3,
  taxPerJob: 5,
  parkSubsidy: 95,
  upkeepPerBuilding: 18,
  unemploymentCostPerResident: 1.6,
  growthMinOccupancy: 0.6,
  growthBudgetShare: 0.5,
  maxGrowthStarts: 2,
};

/** Money the town pays to break ground on each kind, funded from the surplus. */
export const GROWTH_DEPOSIT: Record<BuildingKind, number> = {
  house: 120,
  shop: 180,
  office: 260,
  factory: 400,
  park: 90,
  auction_house: 300,
};

/** Kinds the town builds on its own; the factory is left to the player. */
const GROWTH_PREFERENCE: BuildingKind[] = ['house', 'house', 'shop', 'park', 'office'];

export interface CityEconomyReport {
  week: number;
  residents: number;
  jobs: number;
  filledJobs: number;
  /** 0..1 share of the town's jobs that are filled by residents. */
  occupancy: number;
  /** Finished buildings only; unfinished ones pay and earn nothing. */
  built: number;
  parks: number;
  /** Residents with no job in town. */
  unemployed: number;
  income: {
    /** Tax paid on employment: residents holding jobs and the jobs they fill. */
    employmentTax: number;
    parks: number;
  };
  expenses: {
    upkeep: number;
    unemployment: number;
  };
  /** income - expenses (before construction costs). */
  surplus: number;
  /** Kinds of buildings started this week (empty when the town stagnated). */
  started: BuildingKind[];
  /** Money spent on the started constructions. */
  constructionSpend: number;
  /** Human-readable lines for the campaign log. */
  log: string[];
}

export interface CityEconomyInput {
  plan: CityPlanSave | null | undefined;
  week: number;
  now?: number;
  random?: () => number;
  balance?: Partial<CityEconomyBalance>;
}

export interface CityEconomyResult {
  report: CityEconomyReport;
  /** Plan to persist; null when there is no city to keep. */
  plan: CityPlanSave | null;
}

/** Display names for buildings the weekly report may have started. */
export const KIND_LABELS: Record<BuildingKind, string> = {
  house: BLOCK_STYLES.house.label,
  shop: BLOCK_STYLES.shop.label,
  office: BLOCK_STYLES.office.label,
  factory: BLOCK_STYLES.factory.label,
  park: BLOCK_STYLES.park.label,
  auction_house: BLOCK_STYLES.auction_house.label,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function emptyReport(week: number): CityEconomyReport {
  return {
    week,
    residents: 0,
    jobs: 0,
    filledJobs: 0,
    occupancy: 0,
    built: 0,
    parks: 0,
    unemployed: 0,
    income: { employmentTax: 0, parks: 0 },
    expenses: { upkeep: 0, unemployment: 0 },
    surplus: 0,
    started: [],
    constructionSpend: 0,
    log: [],
  };
}

/** Finished buildings grouped by kind, counted once per building. */
function countFinished(city: CityState): Record<BuildingKind, number> {
  const counts: Record<BuildingKind, number> = { house: 0, shop: 0, office: 0, factory: 0, park: 0, auction_house: 0 };
  const seen = new Set<number>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y][x];
      if (cell.type !== 'lot' || !cell.building) continue;
      const building = cell.building;
      if (building.progress < 1 || seen.has(building.id)) continue;
      seen.add(building.id);
      counts[building.kind] += 1;
    }
  }
  return counts;
}

function firstEmptyLot(city: CityState): { x: number; y: number } | null {
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y][x];
      if (cell.type === 'lot' && !cell.building) return { x, y };
    }
  }
  return null;
}

/**
 * Starts up to `maxStarts` constructions, spending at most `budget`. Only the
 * starting deposit is charged here (construction itself is free in the
 * builder). A draw that does not fit the remaining budget is dropped, so a poor
 * week builds a house instead of a factory it cannot afford.
 */
function grow(
  city: CityState,
  budget: number,
  maxStarts: number,
  random: () => number,
): { kinds: BuildingKind[]; spend: number } {
  const kinds: BuildingKind[] = [];
  let spend = 0;
  for (let i = 0; i < maxStarts; i++) {
    const lot = firstEmptyLot(city);
    if (!lot) break;
    const kind = GROWTH_PREFERENCE[Math.floor(random() * GROWTH_PREFERENCE.length)] ?? GROWTH_PREFERENCE[0];
    const deposit = GROWTH_DEPOSIT[kind];
    if (spend + deposit > budget) continue;
    const result = placeBuilding(city, lot.x, lot.y, kind);
    if (!result.ok) continue;
    spend += deposit;
    kinds.push(kind);
  }
  return { kinds, spend };
}

/**
 * Applies one week of city economy to a saved city plan.
 *
 * The plan goes through `restoreCityPlan`, so the same normalisation and capped
 * offline catch-up used by the builder view applies here; the returned plan is
 * re-serialised with fresh checkpoint metadata, so the offline interval is not
 * replayed twice.
 */
export function advanceCityEconomy(input: CityEconomyInput): CityEconomyResult {
  const balance: CityEconomyBalance = { ...CITY_ECONOMY_BALANCE, ...(input.balance ?? {}) };
  const week = Number.isFinite(input.week) ? Math.max(1, Math.floor(input.week)) : 1;
  const now = input.now ?? Date.now();
  const random = input.random ?? Math.random;

  if (!input.plan || !Array.isArray(input.plan.buildings) || input.plan.buildings.length === 0) {
    return { report: emptyReport(week), plan: input.plan ?? null };
  }

  const restored = restoreCityPlan(input.plan, input.plan.seed, now);
  const city = restored.city;
  const stats = cityStats(city);
  const report = emptyReport(week);
  report.residents = stats.population;
  report.jobs = stats.jobs;
  report.built = stats.built;

  if (stats.built === 0) {
    report.log.push('Город: стройка идёт, но ни одно здание ещё не сдано — муниципальных доходов нет.');
    return { report, plan: restored.save ?? input.plan };
  }

  const counts = countFinished(city);
  report.parks = counts.park;

  // Residents can only take the jobs the town actually offers; the rest stay
  // unemployed even if the wider syndicate would happily hire them.
  const filledJobs = Math.min(stats.jobs, stats.population);
  const occupancy = stats.jobs > 0 ? clamp01(filledJobs / stats.jobs) : 0;
  report.filledJobs = filledJobs;
  report.occupancy = occupancy;
  report.unemployed = Math.max(0, stats.population - filledJobs);

  // A run-down city still collects taxes, but less of them.
  const conditionFactor = 0.6 + 0.4 * clamp01(stats.condition);
  const employmentTax = Math.round(filledJobs * (balance.taxPerResident + balance.taxPerJob) * conditionFactor);
  const parkIncome = Math.round(counts.park * balance.parkSubsidy);
  const upkeep = Math.round(stats.built * balance.upkeepPerBuilding);
  const unemployment = Math.round(report.unemployed * balance.unemploymentCostPerResident);

  report.income.employmentTax = employmentTax;
  report.income.parks = parkIncome;
  report.expenses.upkeep = upkeep;
  report.expenses.unemployment = unemployment;
  report.surplus = employmentTax + parkIncome - upkeep - unemployment;

  report.log.push(
    `Город: ${stats.built} зданий, ${stats.population} жителей, ${filledJobs}/${stats.jobs} рабочих мест `
    + `(${Math.round(occupancy * 100)}%).`
  );
  if (employmentTax + parkIncome > 0) {
    report.log.push(`Город принёс ${employmentTax + parkIncome} AX муниципального дохода.`);
  }
  if (upkeep + unemployment > 0) {
    report.log.push(`Город израсходовал ${upkeep + unemployment} AX: обслуживание и пособия безработным.`);
  }

  let nextPlan = restored.save;
  if (report.surplus > 0 && occupancy >= balance.growthMinOccupancy) {
    const budget = Math.floor(report.surplus * balance.growthBudgetShare);
    const started = grow(city, budget, balance.maxGrowthStarts, random);
    report.started = started.kinds;
    report.constructionSpend = started.spend;
    if (started.kinds.length > 0) {
      report.log.push(
        `Город заложил стройку: ${started.kinds.map(kind => KIND_LABELS[kind]).join(', ')} `
        + `(-${started.spend} AX).`
      );
      nextPlan = serializeCityPlan(city, input.plan.seed, {
        savedAt: now,
        wasOpenAtSave: input.plan.wasOpenAtSave,
      });
    }
  } else if (report.surplus <= 0) {
    report.log.push('Город не может начать новую стройку: неделя ушла в минус.');
  } else {
    report.log.push('Город замер: слишком мало жителей заняты на местных работах.');
  }

  return { report, plan: nextPlan };
}
