import {
  BLOCK_STYLES,
  generateCity,
  listBuildings,
  placeBuilding,
  type BuildingKind,
  type CityState,
} from './cityBuilder';
import { MEZZANINE_MAX_SEED, MEZZANINE_MIN_SEED } from './mezzanineViewState';

export const CITY_PLAN_SCHEMA_VERSION = 1;
export const MAX_CITY_PLAN_OFFLINE_MS = 8 * 60 * 60 * 1000;
export const CITY_PLAN_CHECKPOINT_MS = 1000;
const MAX_BUILDING_ID = 1_000_000_000;

export interface CityPlanBuildingRecord {
  id: number;
  lot: number;
  kind: BuildingKind;
  progress: number;
  condition: number;
}

export interface CityPlanSave {
  schemaVersion: typeof CITY_PLAN_SCHEMA_VERSION;
  seed: number;
  buildings: CityPlanBuildingRecord[];
  /** Unix milliseconds at the last bounded persistence checkpoint. */
  savedAt: number;
  /** True only if the city-plan view was active at this checkpoint. */
  wasOpenAtSave: boolean;
}

export interface CityPlanSnapshotMeta {
  savedAt?: number;
  wasOpenAtSave?: boolean;
}

export interface RestoredCityPlan {
  city: CityState;
  /** Updated checkpoint metadata prevents the same offline interval replaying. */
  save: CityPlanSave | null;
  appliedOfflineMs: number;
}

const BUILDING_KINDS = Object.keys(BLOCK_STYLES) as BuildingKind[];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function normalizeSeed(value: unknown): number | null {
  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed < MEZZANINE_MIN_SEED || seed > MEZZANINE_MAX_SEED) return null;
  return seed;
}

function clamp01(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(1, Math.max(0, parsed));
}

function lotCoordinates(city: CityState): Map<number, { x: number; y: number }> {
  const coordinates = new Map<number, { x: number; y: number }>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y]?.[x];
      if (cell?.type === 'lot' && !coordinates.has(cell.lot)) coordinates.set(cell.lot, { x, y });
    }
  }
  return coordinates;
}

/** Serializes only mutable building facts; generated terrain stays derived from the seed. */
export function serializeCityPlan(
  city: CityState,
  seedValue: unknown,
  meta: CityPlanSnapshotMeta = {},
): CityPlanSave | null {
  const seed = normalizeSeed(seedValue);
  if (seed === null) return null;

  const buildings: CityPlanBuildingRecord[] = listBuildings(city)
    .map(({ x, y, building }) => {
      const cell = city.cells[y]?.[x];
      if (cell?.type !== 'lot') return null;
      return {
        id: building.id,
        lot: cell.lot,
        kind: building.kind,
        progress: building.progress,
        condition: building.condition,
      };
    })
    .filter((record): record is CityPlanBuildingRecord => record !== null)
    .sort((a, b) => a.lot - b.lot);

  if (buildings.length === 0) return null;
  const savedAt = Number(meta.savedAt);
  return {
    schemaVersion: CITY_PLAN_SCHEMA_VERSION,
    seed,
    buildings,
    savedAt: Number.isFinite(savedAt) && savedAt >= 0 ? Math.floor(savedAt) : 0,
    wasOpenAtSave: meta.wasOpenAtSave === true && Number.isFinite(savedAt) && savedAt > 0,
  };
}

/** Validates and bounds untrusted save data. Invalid records are dropped, not fatal to the campaign. */
export function normalizeCityPlanSave(raw: unknown): CityPlanSave | null {
  if (!isRecord(raw) || raw.schemaVersion !== CITY_PLAN_SCHEMA_VERSION || !Array.isArray(raw.buildings)) return null;
  const seed = normalizeSeed(raw.seed);
  if (seed === null) return null;

  const availableLots = lotCoordinates(generateCity(seed));
  const buildings: CityPlanBuildingRecord[] = [];
  const seenIds = new Set<number>();
  const seenLots = new Set<number>();
  for (const candidate of raw.buildings) {
    if (!isRecord(candidate)) continue;
    const { id, lot, kind } = candidate;
    const progress = clamp01(candidate.progress);
    const condition = clamp01(candidate.condition);
    if (!Number.isSafeInteger(id) || Number(id) < 1 || Number(id) > MAX_BUILDING_ID) continue;
    if (!Number.isSafeInteger(lot) || !availableLots.has(Number(lot))) continue;
    if (typeof kind !== 'string' || !BUILDING_KINDS.includes(kind as BuildingKind)) continue;
    if (progress === null || condition === null) continue;
    if (seenIds.has(Number(id)) || seenLots.has(Number(lot))) continue;

    seenIds.add(Number(id));
    seenLots.add(Number(lot));
    buildings.push({
      id: Number(id),
      lot: Number(lot),
      kind: kind as BuildingKind,
      progress,
      condition,
    });
    if (buildings.length >= availableLots.size) break;
  }

  if (buildings.length === 0) return null;
  buildings.sort((a, b) => a.lot - b.lot);
  const savedAtRaw = Number(raw.savedAt);
  const savedAt = Number.isFinite(savedAtRaw) && savedAtRaw >= 0 ? Math.floor(savedAtRaw) : 0;
  return {
    schemaVersion: CITY_PLAN_SCHEMA_VERSION,
    seed,
    buildings,
    savedAt,
    // Invalid/missing timestamps disable catch-up while retaining the plan.
    wasOpenAtSave: raw.wasOpenAtSave === true && savedAt > 0,
  };
}

/** Regenerates the base grid, restores sparse buildings, then applies bounded offline construction. */
export function restoreCityPlan(
  raw: unknown,
  expectedSeedValue: unknown,
  now = Date.now(),
): RestoredCityPlan {
  const expectedSeed = normalizeSeed(expectedSeedValue) ?? 1101;
  const city = generateCity(expectedSeed);
  const normalized = normalizeCityPlanSave(raw);
  if (!normalized || normalized.seed !== expectedSeed) {
    return { city, save: null, appliedOfflineMs: 0 };
  }

  const coordinates = lotCoordinates(city);
  let maxId = 0;
  for (const record of normalized.buildings) {
    const coordinate = coordinates.get(record.lot);
    if (!coordinate) continue;
    const placed = placeBuilding(city, coordinate.x, coordinate.y, record.kind, normalized.savedAt);
    if (!placed.ok || !placed.building) continue;
    placed.building.id = record.id;
    placed.building.progress = record.progress;
    placed.building.condition = record.condition;
    maxId = Math.max(maxId, record.id);
  }
  city.nextId = Math.max(city.nextId, maxId + 1);

  const nowMs = Number.isFinite(now) && now >= 0 ? Math.floor(now) : Date.now();
  const elapsedMs = normalized.wasOpenAtSave && normalized.savedAt > 0
    ? Math.min(MAX_CITY_PLAN_OFFLINE_MS, Math.max(0, nowMs - normalized.savedAt))
    : 0;
  const elapsedSeconds = elapsedMs / 1000;
  if (elapsedSeconds > 0) {
    for (const { building } of listBuildings(city)) {
      if (building.progress >= 1) continue;
      building.progress = Math.min(1, building.progress + elapsedSeconds / BLOCK_STYLES[building.kind].buildSeconds);
    }
  }

  return {
    city,
    save: serializeCityPlan(city, expectedSeed, { savedAt: nowMs, wasOpenAtSave: normalized.wasOpenAtSave }),
    appliedOfflineMs: elapsedMs,
  };
}
