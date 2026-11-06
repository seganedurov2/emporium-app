/**
 * Pointer gestures for the mezzanine map (region and city views).
 *
 * The map used to listen to mouse events only, so a pen or a finger could not
 * pan it and there was no pinch zoom. This module is the pure part of the
 * replacement: it turns a set of active pointers into a pan delta and a zoom
 * factor, with no DOM access, so the behaviour can be unit tested.
 *
 * Rules:
 * - one pointer (mouse, pen or a single finger) pans by its movement;
 * - two pointers pinch: the zoom follows the change in distance between them
 *   and the pan follows the midpoint, so the map stays under the fingers;
 * - a third pointer is ignored until one of the first two lifts.
 */

export interface PointerPoint {
  x: number;
  y: number;
}

export interface GestureFrame {
  /** Pan delta in CSS pixels since the previous frame. */
  dx: number;
  dy: number;
  /** Zoom multiplier since the previous frame (1 = unchanged). */
  scale: number;
}

export interface GestureState {
  /** Active pointers by id, in the order they went down. */
  pointers: Map<number, PointerPoint>;
  /** Midpoint of the tracked pointers at the previous frame. */
  anchor: PointerPoint | null;
  /** Distance between the two tracked pointers at the previous frame. */
  distance: number;
}

export function createGestureState(): GestureState {
  return { pointers: new Map(), anchor: null, distance: 0 };
}

const midpoint = (a: PointerPoint, b: PointerPoint): PointerPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
});

const distanceBetween = (a: PointerPoint, b: PointerPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** The pointer ids a frame is computed from: the first one, or the first two. */
function trackedIds(state: GestureState): number[] {
  return [...state.pointers.keys()].slice(0, 2);
}

/** The pointers a frame is computed from: the first one, or the first two. */
function tracked(state: GestureState): PointerPoint[] {
  return trackedIds(state).map(id => state.pointers.get(id)!);
}

/** Recomputes the anchor/distance baseline after a pointer went down or up. */
function rebase(state: GestureState): void {
  const points = tracked(state);
  if (points.length === 0) {
    state.anchor = null;
    state.distance = 0;
    return;
  }
  state.anchor = points.length === 2 ? midpoint(points[0], points[1]) : { ...points[0] };
  state.distance = points.length === 2 ? distanceBetween(points[0], points[1]) : 0;
}

/** Registers a pointer that went down. Returns the new pointer count. */
export function pointerDown(state: GestureState, id: number, point: PointerPoint): number {
  state.pointers.set(id, { ...point });
  rebase(state);
  return state.pointers.size;
}

/** Removes a pointer that went up or was cancelled. Returns the remaining count. */
export function pointerUp(state: GestureState, id: number): number {
  state.pointers.delete(id);
  rebase(state);
  return state.pointers.size;
}

/**
 * Moves a tracked pointer and returns the pan/zoom since the previous frame.
 * Returns null when the pointer is not tracked (a third finger, or an id that
 * never went down).
 *
 * Each pointer event is applied independently: pan follows the midpoint
 * movement and zoom follows the distance change, so rapid interleaved finger
 * events never accumulate a stale baseline. A transient scale change while one
 * finger of a two-finger drag moves alone is real (the distance did change) and
 * is balanced by the other finger's following event.
 */
export function pointerMove(state: GestureState, id: number, point: PointerPoint): GestureFrame | null {
  if (!state.pointers.has(id)) return null;
  state.pointers.set(id, { ...point });

  const points = tracked(state);
  if (points.length === 0) return null;
  // A third finger is tracked but does not drive the map.
  if (!trackedIds(state).includes(id)) return null;

  const anchor = points.length === 2 ? midpoint(points[0], points[1]) : { ...points[0] };
  const distance = points.length === 2 ? distanceBetween(points[0], points[1]) : 0;
  const previous = state.anchor ?? anchor;
  const frame: GestureFrame = {
    dx: anchor.x - previous.x,
    dy: anchor.y - previous.y,
    scale: 1
  };
  if (points.length === 2 && state.distance > 0 && distance > 0) {
    frame.scale = distance / state.distance;
  }
  state.anchor = anchor;
  state.distance = distance;
  return frame;
}

/** True while two pointers are down, i.e. a pinch is in progress. */
export function isPinching(state: GestureState): boolean {
  return state.pointers.size >= 2;
}

/**
 * Applies a pinch frame to the tile size. The zoom is clamped to the same
 * range the wheel and the +/- buttons use, so a pinch can never leave the map
 * unreadable or zoomed past the saved maximum.
 */
export function applyPinchZoom(
  tile: number,
  scale: number,
  clamp: (value: number, fallback?: number) => number
): number {
  if (!Number.isFinite(scale) || scale <= 0) return tile;
  return clamp(tile * scale, tile);
}
