/**
 * Mezzanine map view state: the part of the map that survives tab switches and
 * a save/load round-trip (region, city, view mode, zoom and pan).
 *
 * Kept free of React and DOM access so save-state migration can normalize it
 * without pulling the map component in.
 */

export const MEZZANINE_VIEW_MODES = ['region', 'city', 'city_plan', '3d'] as const;
export type MezzanineViewMode = typeof MEZZANINE_VIEW_MODES[number];

export const MEZZANINE_MIN_TILE = 8;
export const MEZZANINE_MAX_TILE = 200;
export const MEZZANINE_DEFAULT_TILE = 64;
export const MEZZANINE_MIN_SEED = 1;
export const MEZZANINE_MAX_SEED = 999_999_999;

export interface MezzanineCityRef {
  name: string;
  lat: number;
  lon: number;
  seed: number;
}

export interface MezzanineViewState {
  /** Region id (e.g. 'gomel') or null when no region was picked yet. */
  selectedRegionId: string | null;
  /** Selected city, if any. */
  selectedCity: MezzanineCityRef | null;
  viewMode: MezzanineViewMode;
  /** Isometric tile size in px (zoom). */
  gridSize: number;
  /** Pan offset in px. */
  offset: { x: number; y: number };
  /** Seed of the city-builder plan. */
  citySeed: number;
}

export function createDefaultMezzanineView(): MezzanineViewState {
  return {
    selectedRegionId: null,
    selectedCity: null,
    viewMode: 'region',
    gridSize: MEZZANINE_DEFAULT_TILE,
    offset: { x: 0, y: 0 },
    citySeed: 1101
  };
}

export function clampTile(value: unknown, fallback = MEZZANINE_DEFAULT_TILE): number {
  const tile = Math.round(Number(value));
  if (!Number.isFinite(tile)) return fallback;
  return Math.min(MEZZANINE_MAX_TILE, Math.max(MEZZANINE_MIN_TILE, tile));
}

function finiteNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function normalizeMezzanineCity(raw: unknown): MezzanineCityRef | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const lat = finiteNumber(raw.lat, NaN);
  const lon = finiteNumber(raw.lon, NaN);
  const seed = Math.round(finiteNumber(raw.seed, NaN));
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(seed)) return null;
  return {
    name,
    lat: Math.min(90, Math.max(-90, lat)),
    lon: Math.min(180, Math.max(-180, lon)),
    seed: Math.min(MEZZANINE_MAX_SEED, Math.max(MEZZANINE_MIN_SEED, seed))
  };
}

/**
 * Normalizes a stored view state. Saves written before 0.3.7 have no mezzanine
 * block at all; they load the default empty view instead of failing.
 */
export function normalizeMezzanineViewState(raw: unknown): MezzanineViewState {
  const base = createDefaultMezzanineView();
  if (!isRecord(raw)) return base;

  const viewMode = MEZZANINE_VIEW_MODES.includes(raw.viewMode as MezzanineViewMode)
    ? (raw.viewMode as MezzanineViewMode)
    : base.viewMode;
  const selectedRegionId = typeof raw.selectedRegionId === 'string' && raw.selectedRegionId.trim()
    ? raw.selectedRegionId.trim()
    : null;
  const offset = isRecord(raw.offset)
    ? { x: finiteNumber(raw.offset.x, 0), y: finiteNumber(raw.offset.y, 0) }
    : { ...base.offset };

  const selectedCity = normalizeMezzanineCity(raw.selectedCity);

  return {
    selectedRegionId,
    selectedCity,
    // A city view without a city would render an empty map, so fall back.
    viewMode: viewMode !== 'region' && !selectedCity ? 'region' : viewMode,
    gridSize: clampTile(raw.gridSize),
    offset,
    citySeed: Math.min(
      MEZZANINE_MAX_SEED,
      Math.max(MEZZANINE_MIN_SEED, Math.round(finiteNumber(raw.citySeed, base.citySeed)))
    )
  };
}

/** View mode for the components that only distinguish these three screens. */
export function isMapMode(mode: MezzanineViewMode): boolean {
  return mode === 'region' || mode === 'city';
}
