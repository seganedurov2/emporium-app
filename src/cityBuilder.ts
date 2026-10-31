// City builder model: a grid of streets, blocks and lots, in the spirit of the
// old SimCity / Theo Town zoomed-in view. Everything here is pure logic so the
// mezzanine renderer (canvas) can stay dumb and the rules stay testable.

export const CITY_SIZE = 40;

export type BuildingKind = 'house' | 'shop' | 'office' | 'factory' | 'park';

export type CellType = 'empty' | 'road' | 'lot';

export interface Building {
  id: number;
  kind: BuildingKind;
  /** House number inside the block, e.g. 7. */
  number: number;
  street: string;
  residents: number;
  jobs: number;
  /** 0..1 construction progress. Buildings at 1 are finished. */
  progress: number;
  /** Unix ms when the construction was started. */
  startedAt: number;
  /** 0..1, drifting with the economy. */
  condition: number;
}

export type Cell =
  | { type: 'empty' }
  | { type: 'road'; street: string }
  | { type: 'lot'; lot: number; building: Building | null };

export interface CityState {
  size: number;
  /** cells[y][x] */
  cells: Cell[][];
  blocks: CityBlock[];
  nextId: number;
  nextLot: number;
}

export interface CityBlock {
  /** Block rectangle covering the lots (roads sit between blocks). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Building lots in row-major order within the block. */
  lots: number[];
}

export interface CityStats {
  population: number;
  jobs: number;
  /** Buildings finished (progress >= 1). */
  built: number;
  /** Buildings still under construction. */
  building: number;
  /** Average condition of finished buildings, 0..1. */
  condition: number;
}

export interface BlockStyle {
  kind: BuildingKind;
  residents: number;
  jobs: number;
  /** Construction seconds at 1x speed. */
  buildSeconds: number;
  label: string;
}

export const BLOCK_STYLES: Record<BuildingKind, BlockStyle> = {
  house: { kind: 'house', residents: 8, jobs: 0, buildSeconds: 10, label: 'Дом' },
  shop: { kind: 'shop', residents: 0, jobs: 6, buildSeconds: 14, label: 'Магазин' },
  office: { kind: 'office', residents: 0, jobs: 24, buildSeconds: 22, label: 'Офис' },
  factory: { kind: 'factory', residents: 0, jobs: 60, buildSeconds: 32, label: 'Завод' },
  park: { kind: 'park', residents: 0, jobs: 1, buildSeconds: 6, label: 'Парк' },
};

const STREET_NAMES = [
  'Ленина',
  '50 лет Октября',
  'Мира',
  'Комсомольская',
  'Советская',
  'Гагарина',
  'Пушкина',
  'Кирова',
  'Интернациональная',
  'Молодёжная',
  'Заводская',
  'Железнодорожная',
  'Полесская',
  'Строителей',
  'Набережная',
  'Свободы',
  'Октябрьская',
  'Пионерская',
];

const AVENUE_NAMES = [
  'Пр. Республики',
  'Ул. Победы',
  'Ул. Дружбы',
  'Ул. Лесная',
];

function emptyCity(size: number): CityState {
  const cells: Cell[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < size; x++) row.push({ type: 'empty' });
    cells.push(row);
  }
  return { size, cells, blocks: [], nextId: 1, nextLot: 1 };
}

/** Generate a city: a grid of roads every `pitch` cells, numbered blocks between. */
export function generateCity(seed: number, size: number = CITY_SIZE): CityState {
  const city = emptyCity(size);
  const rnd = mulberry32(seed);
  const pitch = 8;
  const roadXs: number[] = [];
  const roadYs: number[] = [];
  for (let x = 2; x < size; x += pitch) roadXs.push(x);
  for (let y = 2; y < size; y += pitch) roadYs.push(y);

  // One horizontal avenue gets a crossed name, old towns always had one main road.
  // A handful of avenues among the plain streets, so the plan reads like a town.
  const avenueCols = new Set([Math.floor(roadXs.length / 2), Math.floor(roadXs.length / 2) + 2]);
  let avenueIdx = 0;
  for (let i = 0; i < roadXs.length; i++) {
    const name = avenueCols.has(i)
      ? AVENUE_NAMES[avenueIdx++ % AVENUE_NAMES.length]
      : `ул. ${STREET_NAMES[(i + Math.floor(rnd() * 3)) % STREET_NAMES.length]}`;
    for (let y = 0; y < size; y++) city.cells[y][roadXs[i]] = { type: 'road', street: name };
  }
  const mainY = roadYs[Math.floor(roadYs.length / 2)];
  for (let j = 0; j < roadYs.length; j++) {
    const name =
      roadYs[j] === mainY
        ? 'ул. Интернациональная'
        : `ул. ${STREET_NAMES[(j * 3 + Math.floor(rnd() * 5)) % STREET_NAMES.length]}`;
    for (let x = 0; x < size; x++) city.cells[roadYs[j]][x] = { type: 'road', street: name };
  }

  // Blocks between consecutive roads, 3x3 lots each (one lot is left as a yard).
  for (let yi = 0; yi < roadYs.length - 1; yi++) {
    for (let xi = 0; xi < roadXs.length - 1; xi++) {
      const bx = roadXs[xi] + 1;
      const by = roadYs[yi] + 1;
      const bw = roadXs[xi + 1] - roadXs[xi] - 1;
      const bh = roadYs[yi + 1] - roadYs[yi] - 1;
      const lots: number[] = [];
      const lw = Math.floor(bw / 2);
      const lh = Math.floor(bh / 2);
      for (let ly = 0; ly < 2; ly++) {
        for (let lx = 0; lx < 2; lx++) {
          const lotId = city.nextLot++;
          lots.push(lotId);
          const x0 = bx + lx * lw;
          const y0 = by + ly * lh;
          for (let yy = y0; yy < y0 + lh; yy++) {
            for (let xx = x0; xx < x0 + lw; xx++) {
              city.cells[yy][xx] = { type: 'lot', lot: lotId, building: null };
            }
          }
        }
      }
      city.blocks.push({ x: bx, y: by, w: bw, h: bh, lots });
    }
  }
  return city;
}

/** The street name a cell belongs to: own road, or nearest road. */
export function streetAt(city: CityState, x: number, y: number): string {
  const cell = city.cells[y]?.[x];
  if (cell?.type === 'road') return cell.street;
  // Nearest road cell (Manhattan), falling back to the first road in the row.
  let best = '';
  let bestDist = Infinity;
  for (let yy = 0; yy < city.size; yy++) {
    for (let xx = 0; xx < city.size; xx++) {
      const c = city.cells[yy][xx];
      if (c.type !== 'road') continue;
      const d = Math.abs(xx - x) + Math.abs(yy - y);
      if (d < bestDist) {
        bestDist = d;
        best = c.street;
      }
      if (d === 1) return c.street;
    }
  }
  return best || 'ул. Без названия';
}

/** Address of a lot, e.g. "ул. Мира, 7". */
export function addressOf(city: CityState, x: number, y: number): string {
  const cell = city.cells[y]?.[x];
  if (!cell || cell.type !== 'lot') return '';
  return `${streetAt(city, x, y)}, ${cell.lot}`;
}



export interface PlaceResult {
  ok: boolean;
  error?: string;
  building?: Building;
}

/** Start a construction on the lot under (x, y). Returns the new building. */
export function placeBuilding(
  city: CityState,
  x: number,
  y: number,
  kind: BuildingKind,
  now: number = Date.now(),
): PlaceResult {
  const cell = city.cells[y]?.[x];
  if (!cell) return { ok: false, error: 'Вне карты' };
  if (cell.type === 'road') return { ok: false, error: 'На проезжей части нельзя строить' };
  if (cell.type !== 'lot') return { ok: false, error: 'Нет участка' };
  if (cell.building) return { ok: false, error: 'Участок уже занят' };

  const style = BLOCK_STYLES[kind];
  const building: Building = {
    id: city.nextId++,
    kind,
    number: cell.lot,
    street: streetAt(city, x, y),
    residents: style.residents,
    jobs: style.jobs,
    progress: 0,
    startedAt: now,
    condition: 1,
  };

  // Fill the whole lot with the same building.
  for (let yy = 0; yy < city.size; yy++) {
    for (let xx = 0; xx < city.size; xx++) {
      const c = city.cells[yy][xx];
      if (c.type === 'lot' && c.lot === cell.lot) {
        city.cells[yy][xx] = { type: 'lot', lot: c.lot, building };
      }
    }
  }
  return { ok: true, building };
}

/** Demolish whatever stands on the lot under (x, y). */
export function demolish(city: CityState, x: number, y: number): boolean {
  const cell = city.cells[y]?.[x];
  if (!cell || cell.type !== 'lot' || !cell.building) return false;
  const lot = cell.lot;
  for (let yy = 0; yy < city.size; yy++) {
    for (let xx = 0; xx < city.size; xx++) {
      const c = city.cells[yy][xx];
      if (c.type === 'lot' && c.lot === lot) {
        city.cells[yy][xx] = { type: 'lot', lot, building: null };
      }
    }
  }
  return true;
}

/**
 * Advance construction. `speed` is seconds of build time per real second
 * (1 = normal, 0 = paused). Returns the same object, mutated in place.
 */
export function tick(city: CityState, dt: number, speed: number): CityState {
  if (speed <= 0 || dt <= 0) return city;
  const seen = new Set<Building>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const c = city.cells[y][x];
      if (c.type !== 'lot' || !c.building) continue;
      const b = c.building;
      if (seen.has(b)) continue;
      seen.add(b);
      if (b.progress < 1) {
        const perSecond = 1 / BLOCK_STYLES[b.kind].buildSeconds;
        b.progress = Math.min(1, b.progress + perSecond * speed * dt);
      } else {
        // Slow decay, kept gentle so the city does not rot between screens.
        b.condition = Math.max(0.2, b.condition - 0.00002 * speed * dt);
      }
    }
  }
  return city;
}

export function cityStats(city: CityState): CityStats {
  let population = 0;
  let jobs = 0;
  let built = 0;
  let building = 0;
  let conditionSum = 0;
  const seen = new Set<Building>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const c = city.cells[y][x];
      if (c.type !== 'lot' || !c.building || seen.has(c.building)) continue;
      const b = c.building;
      seen.add(b);
      if (b.progress >= 1) {
        built++;
        population += b.residents;
        jobs += b.jobs;
        conditionSum += b.condition;
      } else {
        building++;
      }
    }
  }
  return {
    population,
    jobs,
    built,
    building,
    condition: built ? conditionSum / built : 1,
  };
}

/** All finished buildings with their lot coordinates, in draw order (back to front). */
export function listBuildings(city: CityState): { x: number; y: number; building: Building }[] {
  const out: { x: number; y: number; building: Building }[] = [];
  const seen = new Set<Building>();
  for (let y = 0; y < city.size; y++) {
    for (let x = 0; x < city.size; x++) {
      const c = city.cells[y][x];
      if (c.type !== 'lot' || !c.building || seen.has(c.building)) continue;
      seen.add(c.building);
      out.push({ x, y, building: c.building });
    }
  }
  return out;
}

/** Distinct street names, in the order the roads were generated. */
export function listStreets(city: CityState): { name: string; horizontal: boolean; index: number }[] {
  const seen = new Map<string, { name: string; horizontal: boolean; index: number }>();
  for (let y = 1; y < city.size - 1; y++) {
    for (let x = 1; x < city.size - 1; x++) {
      const c = city.cells[y][x];
      if (c.type !== 'road' || seen.has(c.street)) continue;
      // A road cell is horizontal when its left/right neighbours are roads too.
      const horiz =
        city.cells[y][x - 1].type === 'road' && city.cells[y][x + 1].type === 'road';
      seen.set(c.street, { name: c.street, horizontal: horiz, index: horiz ? y : x });
    }
  }
  return [...seen.values()].sort((a, b) => a.index - b.index);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
