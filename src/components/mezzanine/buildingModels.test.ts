import { describe, expect, it } from 'vitest';
import { buildBuildingModel } from './buildingModels';
import type { BuildingKind } from '../../cityBuilder';

const KINDS: BuildingKind[] = ['house', 'shop', 'office', 'factory', 'park'];

describe('buildBuildingModel', () => {
  it('builds a non-empty, coloured geometry for every kind', () => {
    for (const kind of KINDS) {
      const model = buildBuildingModel(kind, 1, 7);
      const pos = model.geometry.getAttribute('position');
      expect(pos, kind).toBeTruthy();
      expect(pos.count, kind).toBeGreaterThan(0);
      expect(model.geometry.getAttribute('color'), kind).toBeTruthy();
      model.geometry.dispose();
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildBuildingModel('house', 1, 42);
    const b = buildBuildingModel('house', 1, 42);
    expect(a.geometry.getAttribute('position').count).toBe(b.geometry.getAttribute('position').count);
    const va = a.geometry.getAttribute('position').array;
    const vb = b.geometry.getAttribute('position').array;
    expect(Array.from(va.slice(0, 30))).toEqual(Array.from(vb.slice(0, 30)));
    a.geometry.dispose();
    b.geometry.dispose();
  });

  it('starts a construction site with scaffolding and a crane', () => {
    const model = buildBuildingModel('office', 0.25, 3);
    expect(model.animated.some(a => a.type === 'crane')).toBe(true);
    model.geometry.dispose();
  });

  it('grows taller as construction progresses', () => {
    const low = buildBuildingModel('office', 0.2, 5);
    const high = buildBuildingModel('office', 0.9, 5);
    low.geometry.computeBoundingBox();
    high.geometry.computeBoundingBox();
    expect(high.geometry.boundingBox!.max.y).toBeGreaterThan(low.geometry.boundingBox!.max.y);
    low.geometry.dispose();
    high.geometry.dispose();
  });

  it('adds smoke to a finished factory and lights to an office', () => {
    const factory = buildBuildingModel('factory', 1, 1);
    expect(factory.animated.some(a => a.type === 'smoke')).toBe(true);
    factory.geometry.dispose();
    const office = buildBuildingModel('office', 1, 1);
    expect(office.animated.some(a => a.type === 'lights')).toBe(true);
    office.geometry.dispose();
  });
});
