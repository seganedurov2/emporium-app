import { describe, expect, it } from 'vitest';
import {
  MEZZANINE_DEFAULT_TILE,
  MEZZANINE_MAX_TILE,
  MEZZANINE_MIN_TILE,
  createDefaultMezzanineView,
  isMapMode,
  normalizeMezzanineViewState
} from './mezzanineViewState';

describe('normalizeMezzanineViewState', () => {
  it('falls back to the default region view when nothing is stored', () => {
    expect(normalizeMezzanineViewState(undefined)).toEqual(createDefaultMezzanineView());
    expect(normalizeMezzanineViewState('garbage')).toEqual(createDefaultMezzanineView());
  });

  it('keeps a saved city view with region, city, zoom and pan', () => {
    const view = normalizeMezzanineViewState({
      selectedRegionId: 'gomel',
      selectedCity: { name: 'Калинковичи', lat: 52.1288, lon: 29.3325, seed: 1101 },
      viewMode: 'city',
      gridSize: 48,
      offset: { x: 120, y: -15 },
      citySeed: 1101
    });
    expect(view.selectedRegionId).toBe('gomel');
    expect(view.selectedCity).toEqual({ name: 'Калинковичи', lat: 52.1288, lon: 29.3325, seed: 1101 });
    expect(view.viewMode).toBe('city');
    expect(view.gridSize).toBe(48);
    expect(view.offset).toEqual({ x: 120, y: -15 });
  });

  it('clamps zoom to the supported tile range', () => {
    expect(normalizeMezzanineViewState({ gridSize: 1 }).gridSize).toBe(MEZZANINE_MIN_TILE);
    expect(normalizeMezzanineViewState({ gridSize: 9000 }).gridSize).toBe(MEZZANINE_MAX_TILE);
    expect(normalizeMezzanineViewState({ gridSize: 'abc' }).gridSize).toBe(MEZZANINE_DEFAULT_TILE);
  });

  it('drops a city view when the stored city is unusable', () => {
    const view = normalizeMezzanineViewState({ viewMode: 'city', selectedCity: { name: '', lat: 1, lon: 2, seed: 3 } });
    expect(view.selectedCity).toBeNull();
    expect(view.viewMode).toBe('region');
  });

  it('rejects unknown view modes and sanitizes coordinates', () => {
    const view = normalizeMezzanineViewState({
      viewMode: 'hyperspace',
      selectedCity: { name: 'Минск', lat: 999, lon: -999, seed: -5 }
    });
    expect(view.viewMode).toBe('region');
    expect(view.selectedCity?.lat).toBe(90);
    expect(view.selectedCity?.lon).toBe(-180);
    expect(view.selectedCity?.seed).toBe(1);
  });
});

describe('isMapMode', () => {
  it('treats only the region and city maps as canvas modes', () => {
    expect(isMapMode('region')).toBe(true);
    expect(isMapMode('city')).toBe(true);
    expect(isMapMode('city_plan')).toBe(false);
    expect(isMapMode('3d')).toBe(false);
  });
});
