import { describe, expect, it } from 'vitest';
import {
  CITY_SIZE,
  addressOf,
  cityStats,
  demolish,
  generateCity,
  listBuildings,
  listStreets,
  placeBuilding,
  streetAt,
  tick,
} from './cityBuilder';

const findAnyLot = (city: ReturnType<typeof generateCity>) => {
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      if (city.cells[y][x].type === 'lot') return { x, y };
    }
  }
  throw new Error('no lots generated');
};

const findRoad = (city: ReturnType<typeof generateCity>) => {
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      if (city.cells[y][x].type === 'road') return { x, y };
    }
  }
  throw new Error('no roads generated');
};

describe('generateCity', () => {
  it('creates a city with roads, blocks and lots', () => {
    const city = generateCity(42);
    expect(city.size).toBe(CITY_SIZE);
    expect(city.blocks.length).toBeGreaterThan(0);
    expect(listStreets(city).length).toBeGreaterThan(3);
    expect(city.cells.flat().some(c => c.type === 'road')).toBe(true);
    expect(city.cells.flat().some(c => c.type === 'lot')).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = listStreets(generateCity(7));
    const b = listStreets(generateCity(7));
    expect(a).toEqual(b);
  });

  it('gives every lot a street name and number', () => {
    const city = generateCity(11);
    const { x, y } = findAnyLot(city);
    expect(streetAt(city, x, y)).toMatch(/^ул\.|^Пр\./);
    expect(addressOf(city, x, y)).toMatch(/^\S.*, \d+$/);
  });

  it('rejects building on roads', () => {
    const city = generateCity(3);
    const road = findRoad(city);
    const res = placeBuilding(city, road.x, road.y, 'house', 0);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/проезжей/);
  });
});

describe('construction', () => {
  it('fill the whole lot and reports numbers', () => {
    const city = generateCity(5);
    const { x, y } = findAnyLot(city);
    const res = placeBuilding(city, x, y, 'house', 0);
    expect(res.ok).toBe(true);
    const b = res.building!;
    expect(b.number).toBeGreaterThan(0);
    expect(b.residents).toBe(8);
    expect(b.progress).toBe(0);

    // second click on the same lot is refused
    expect(placeBuilding(city, x, y, 'shop', 0).ok).toBe(false);

    const occupied = city.cells.flat().filter(c => c.type === 'lot' && c.building === b);
    expect(occupied.length).toBeGreaterThan(1);
  });

  it('animates progress to 100% and only then counts population', () => {
    const city = generateCity(9);
    const { x, y } = findAnyLot(city);
    placeBuilding(city, x, y, 'house', 0);
    expect(cityStats(city).population).toBe(0);
    expect(cityStats(city).building).toBe(1);

    tick(city, 5, 1); // half of 10s build
    const mid = listBuildings(city)[0].building.progress;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);

    tick(city, 10, 1);
    expect(listBuildings(city)[0].building.progress).toBe(1);
    expect(cityStats(city).population).toBe(8);
    expect(cityStats(city).built).toBe(1);
    expect(cityStats(city).building).toBe(0);
  });

  it('pauses at speed 0', () => {
    const city = generateCity(9);
    const { x, y } = findAnyLot(city);
    placeBuilding(city, x, y, 'office', 0);
    tick(city, 100, 0);
    expect(listBuildings(city)[0].building.progress).toBe(0);
  });

  it('demolishes', () => {
    const city = generateCity(13);
    const { x, y } = findAnyLot(city);
    placeBuilding(city, x, y, 'factory', 0);
    expect(demolish(city, x, y)).toBe(true);
    expect(city.cells[y][x]).toMatchObject({ type: 'lot', building: null });
    expect(demolish(city, x, y)).toBe(false);
  });
});
