/**
 * Saved city-economy state: the last applied weekly report plus the "мезонин
 * открыт" first-open flag.
 *
 * Kept free of React and DOM access, like the mezzanine view state, so the save
 * migration can normalize it without pulling the app or the city renderer in.
 */

import type { BuildingKind } from "./cityBuilder";
import type { CityEconomyReport } from "./cityEconomyEngine";

export const CITY_ECONOMY_SCHEMA_VERSION = 1;
export const CITY_ECONOMY_MAX_LOG_LINES = 4;
const MAX_MONEY = 100_000_000_000;

const BUILDING_KINDS: BuildingKind[] = [
  "house",
  "shop",
  "office",
  "factory",
  "park",
];

export interface CityEconomyState {
  schemaVersion: typeof CITY_ECONOMY_SCHEMA_VERSION;
  /** Full report of the last week the city economy was applied; null until then. */
  lastReport: CityEconomyReport | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const finiteInt = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : fallback;
};

const nonNegative = (value: unknown): number =>
  Math.max(0, Math.min(MAX_MONEY, finiteInt(value)));

const clamp01 = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : 0;
};

function normalizeReport(raw: unknown): CityEconomyReport | null {
  if (!isRecord(raw)) return null;
  const income = isRecord(raw.income) ? raw.income : {};
  const expenses = isRecord(raw.expenses) ? raw.expenses : {};
  const started = Array.isArray(raw.started)
    ? raw.started.filter((kind): kind is BuildingKind =>
        BUILDING_KINDS.includes(kind as BuildingKind),
      )
    : [];
  const log = Array.isArray(raw.log)
    ? raw.log
        .filter((line): line is string => typeof line === "string")
        .slice(0, CITY_ECONOMY_MAX_LOG_LINES)
    : [];

  return {
    week: Math.max(1, finiteInt(raw.week, 1)),
    residents: nonNegative(raw.residents),
    jobs: nonNegative(raw.jobs),
    filledJobs: nonNegative(raw.filledJobs),
    occupancy: clamp01(raw.occupancy),
    built: nonNegative(raw.built),
    parks: nonNegative(raw.parks),
    unemployed: nonNegative(raw.unemployed),
    income: {
      employmentTax: nonNegative(income.employmentTax),
      parks: nonNegative(income.parks),
    },
    expenses: {
      upkeep: nonNegative(expenses.upkeep),
      unemployment: nonNegative(expenses.unemployment),
    },
    surplus: Math.max(-MAX_MONEY, Math.min(MAX_MONEY, finiteInt(raw.surplus))),
    started: started.slice(0, 2),
    constructionSpend: nonNegative(raw.constructionSpend),
    log,
  };
}

export function createCityEconomyState(): CityEconomyState {
  return { schemaVersion: CITY_ECONOMY_SCHEMA_VERSION, lastReport: null };
}

/** Validates the stored block; a corrupt report is dropped, never fatal to the campaign. */
export function normalizeCityEconomyState(raw: unknown): CityEconomyState {
  if (!isRecord(raw) || raw.schemaVersion !== CITY_ECONOMY_SCHEMA_VERSION)
    return createCityEconomyState();
  return {
    schemaVersion: CITY_ECONOMY_SCHEMA_VERSION,
    lastReport: normalizeReport(raw.lastReport),
  };
}

/** Stores a fresh report from the weekly advance. */
export function withCityEconomyReport(
  report: CityEconomyReport,
): CityEconomyState {
  return {
    schemaVersion: CITY_ECONOMY_SCHEMA_VERSION,
    lastReport: normalizeReport(report),
  };
}

/**
 * The week the player first opened the mezzanine hub, or null.
 * Older saves that already used the hub are backfilled with their current week.
 */
export function normalizeCityHubOpenedAt(
  raw: unknown,
  mezzanineRegionId: string | null,
  currentWeek: number,
): number | null {
  const parsed = Number(raw);
  if (Number.isSafeInteger(parsed) && parsed >= 1) return parsed;
  if (mezzanineRegionId) return Math.max(1, Math.floor(currentWeek));
  return null;
}
