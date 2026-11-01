import { describe, expect, it } from 'vitest';
import { CITY_SIZE, generateCity, listBuildings, placeBuilding, type BuildingKind } from './cityBuilder';
import {
  MAX_CITY_PLAN_OFFLINE_MS,
  normalizeCityPlanSave,
  restoreCityPlan,
  serializeCityPlan,
} from './cityPlanState';

const findLots = (city: ReturnType<typeof generateCity>) => {
  const lots = new Map<number, { x: number; y: number }>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const cell = city.cells[y][x];
      if (cell.type === 'lot' && !lots.has(cell.lot)) lots.set(cell.lot, { x, y });
    }
  }
  return [...lots.entries()];
};

const build = (seed: number, kind: BuildingKind, lotIndex = 0) => {
  const city = generateCity(seed);
  const [lot, coordinate] = findLots(city)[lotIndex];
  const result = placeBuilding(city, coordinate.x, coordinate.y, kind, 1000);
  if (!result.building) throw new Error('expected a building');
  return { city, lot, building: result.building };
};

describe('city plan persistence', () => {
  it('stores an empty plan as null and never serializes the generated grid', () => {
    const city = generateCity(1101);
    expect(serializeCityPlan(city, 1101, { savedAt: 1000, wasOpenAtSave: true })).toBeNull();

    const built = build(1101, 'house');
    const save = serializeCityPlan(built.city, 1101, { savedAt: 2000, wasOpenAtSave: true });
    expect(save).toEqual({
      schemaVersion: 1,
      seed: 1101,
      buildings: [{ id: built.building.id, lot: built.lot, kind: 'house', progress: 0, condition: 1 }],
      savedAt: 2000,
      wasOpenAtSave: true,
    });
    expect(save).not.toHaveProperty('cells');
    expect(save).not.toHaveProperty('blocks');
    expect(JSON.stringify(save).length).toBeLessThan(1000);
    expect(city.cells).toHaveLength(CITY_SIZE);
  });

  it.each(['house', 'shop', 'office', 'factory', 'park'] as const)('round-trips %s buildings and derived fields', kind => {
    const original = build(1101, kind);
    original.building.progress = 0.42;
    original.building.condition = 0.73;
    const save = serializeCityPlan(original.city, 1101, { savedAt: 2000, wasOpenAtSave: true });
    const restored = restoreCityPlan(save, 1101, 2000);
    const building = listBuildings(restored.city)[0].building;

    expect(building).toMatchObject({
      id: original.building.id,
      kind,
      number: original.lot,
      progress: 0.42,
      condition: 0.73,
    });
    expect(building.street).toBe(original.building.street);
    expect(building.residents).toBe(original.building.residents);
    expect(building.jobs).toBe(original.building.jobs);
    expect(restored.city.nextId).toBe(original.building.id + 1);
  });

  it('normalizes a malformed plan by dropping invalid and duplicate records', () => {
    const save = normalizeCityPlanSave({
      schemaVersion: 1,
      seed: 1101,
      savedAt: 'invalid',
      wasOpenAtSave: true,
      buildings: [
        { id: 1, lot: 1, kind: 'house', progress: 2, condition: -1 },
        { id: 2, lot: 1, kind: 'shop', progress: 0.25, condition: 1 },
        { id: 1, lot: 2, kind: 'office', progress: 0, condition: 1 },
        { id: 3, lot: 2, kind: 'not-a-building', progress: 0.1, condition: 0.8 },
        { id: 4, lot: 9999, kind: 'park', progress: 0.1, condition: 0.8 },
        { id: 5, lot: 3, kind: 'factory', progress: Number.NaN, condition: 0.8 },
        { id: 6, lot: 3, kind: 'park', progress: 0.3, condition: 0.8 },
      ],
    });

    expect(save).toMatchObject({ savedAt: 0, wasOpenAtSave: false });
    expect(save?.buildings).toEqual([
      { id: 1, lot: 1, kind: 'house', progress: 1, condition: 0 },
      { id: 6, lot: 3, kind: 'park', progress: 0.3, condition: 0.8 },
    ]);
  });

  it('rejects unsupported schema and invalid seed', () => {
    const plan = { schemaVersion: 1, seed: 1101, savedAt: 1000, wasOpenAtSave: false, buildings: [{ id: 1, lot: 1, kind: 'house', progress: 0, condition: 1 }] };
    expect(normalizeCityPlanSave({ ...plan, schemaVersion: 2 })).toBeNull();
    expect(normalizeCityPlanSave({ ...plan, seed: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it('restores an empty generated plan for a seed mismatch', () => {
    const original = build(1101, 'house');
    const save = serializeCityPlan(original.city, 1101, { savedAt: 2000, wasOpenAtSave: true });
    const result = restoreCityPlan(save, 2202, 9000);
    expect(result.city).toEqual(generateCity(2202));
    expect(result.save).toBeNull();
    expect(result.appliedOfflineMs).toBe(0);
  });

  it('pauses progress after in-app navigation and applies no offline condition decay', () => {
    const original = build(1101, 'house');
    original.building.progress = 0.2;
    original.building.condition = 0.7;
    const save = serializeCityPlan(original.city, 1101, { savedAt: 1000, wasOpenAtSave: false });
    const result = restoreCityPlan(save, 1101, 10_000);
    expect(listBuildings(result.city)[0].building.progress).toBe(0.2);
    expect(listBuildings(result.city)[0].building.condition).toBe(0.7);
    expect(result.appliedOfflineMs).toBe(0);
  });

  it('catches up at 1x only for unfinished construction and caps elapsed time at eight hours', () => {
    const original = build(1101, 'house');
    original.building.progress = 0.2;
    original.building.condition = 0.7;
    const save = serializeCityPlan(original.city, 1101, { savedAt: 1000, wasOpenAtSave: true });
    const result = restoreCityPlan(save, 1101, 1000 + MAX_CITY_PLAN_OFFLINE_MS + 60_000);

    expect(result.appliedOfflineMs).toBe(MAX_CITY_PLAN_OFFLINE_MS);
    expect(listBuildings(result.city)[0].building.progress).toBe(1);
    expect(listBuildings(result.city)[0].building.condition).toBe(0.7);
    expect(result.save?.savedAt).toBe(1000 + MAX_CITY_PLAN_OFFLINE_MS + 60_000);
  });

  it('does not replay an offline interval after the first successful restore', () => {
    const original = build(1101, 'house');
    original.building.progress = 0.1;
    const save = serializeCityPlan(original.city, 1101, { savedAt: 1000, wasOpenAtSave: true });
    const first = restoreCityPlan(save, 1101, 3000);
    const second = restoreCityPlan(first.save, 1101, 3000);
    expect(second.appliedOfflineMs).toBe(0);
    expect(listBuildings(second.city)[0].building.progress).toBeCloseTo(0.3);
  });
});
