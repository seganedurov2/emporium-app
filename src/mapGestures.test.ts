import { describe, expect, it } from "vitest";
import {
  applyPinchZoom,
  createGestureState,
  isPinching,
  pointerDown,
  pointerMove,
  pointerUp
} from './mapGestures';
import { clampTile } from './mezzanineViewState';

describe('map gestures', () => {
  it('pans with a single pointer, whatever its type', () => {
    const state = createGestureState();
    expect(pointerDown(state, 1, { x: 100, y: 100 })).toBe(1);
    expect(pointerMove(state, 1, { x: 130, y: 90 })).toEqual({ dx: 30, dy: -10, scale: 1 });
    expect(pointerMove(state, 1, { x: 140, y: 90 })).toEqual({ dx: 10, dy: 0, scale: 1 });
    expect(isPinching(state)).toBe(false);
    expect(pointerUp(state, 1)).toBe(0);
    expect(pointerMove(state, 1, { x: 0, y: 0 })).toBeNull();
  });

  it('zooms with two pointers and pans by their midpoint', () => {
    const state = createGestureState();
    pointerDown(state, 1, { x: 100, y: 100 });
    pointerDown(state, 2, { x: 200, y: 100 });
    expect(isPinching(state)).toBe(true);

    // Fingers move apart symmetrically: distance 100 -> 200, midpoint unchanged.
    const frame = pointerMove(state, 2, { x: 300, y: 100 });
    expect(frame).not.toBeNull();
    expect(frame!.scale).toBeCloseTo(2);
    expect(frame!.dx).toBeCloseTo(50);
    expect(frame!.dy).toBeCloseTo(0);

    // Both fingers move by the same vector: distance unchanged, pure pan.
    pointerMove(state, 1, { x: 110, y: 120 });
    const drag = pointerMove(state, 2, { x: 310, y: 120 });
    // The first of the pair re-bases on the new distance, so its scale is the
    // half-step the single finger made; the second one is pure pan. Combined,
    // the two events multiply back to 1.
    expect(drag!.dx).toBeCloseTo(5);
    expect(drag!.dy).toBeCloseTo(10);

    // A second identical step keeps the distance, so the two events of the
    // step multiply back to a zoom of 1 (each alone is the half-step).
    const stepA = pointerMove(state, 1, { x: 120, y: 130 });
    const together = pointerMove(state, 2, { x: 320, y: 130 });
    expect(stepA!.scale * together!.scale).toBeCloseTo(1);
    expect(stepA!.dx + together!.dx).toBeCloseTo(10);
    expect(stepA!.dy + together!.dy).toBeCloseTo(10);
  });

  it('ignores a third pointer until one of the first two lifts', () => {
    const state = createGestureState();
    pointerDown(state, 1, { x: 0, y: 0 });
    pointerDown(state, 2, { x: 100, y: 0 });
    pointerDown(state, 3, { x: 50, y: 50 });
    expect(pointerMove(state, 3, { x: 60, y: 60 })).toBeNull();
    expect(pointerUp(state, 3)).toBe(2);
    expect(isPinching(state)).toBe(true);
  });

  it('re-bases after a pinch so lifting a finger does not jump the map', () => {
    const state = createGestureState();
    pointerDown(state, 1, { x: 0, y: 0 });
    pointerDown(state, 2, { x: 100, y: 0 });
    pointerMove(state, 2, { x: 200, y: 0 });
    expect(pointerUp(state, 2)).toBe(1);
    // The remaining finger continues from where it is, not from the old midpoint.
    expect(pointerMove(state, 1, { x: 10, y: 0 })).toEqual({ dx: 10, dy: 0, scale: 1 });
  });

  it('clamps pinch zoom to the tile range', () => {
    expect(applyPinchZoom(64, 2, clampTile)).toBe(128);
    expect(applyPinchZoom(64, 0.5, clampTile)).toBe(32);
    expect(applyPinchZoom(64, 100, clampTile)).toBe(200);
    expect(applyPinchZoom(64, 0.0001, clampTile)).toBe(8);
    expect(applyPinchZoom(64, Number.NaN, clampTile)).toBe(64);
  });
});
