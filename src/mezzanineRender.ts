/**
 * Pure drawing helpers for the mezzanine isometric canvas.
 *
 * Splitting them out keeps the geometry testable and lets the component cache
 * the expensive per-tile work instead of rebuilding it on every pan/zoom frame.
 */
export const CITY_RADIUS = 14;
/** Pseudo-perspective scale used to place a city on its region map. */
export const CITY_GRID_SCALE = 600;

export function heightColor(h: number) {
  if (h < 0.2) return "#4a9b3c";
  if (h < 0.4) return "#6aa84f";
  if (h < 0.6) return "#8b7355";
  if (h < 0.8) return "#7a6244";
  return "#6b5b4a";
}

export function shade(c: string, k: number) {
  const c2 = c.slice(1);
  const n = parseInt(c2, 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) * k));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) * k));
  const b = Math.min(255, Math.max(0, (n & 0xff) * k));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * Deterministic grass strokes: a seeded PRNG instead of Math.random keeps the
 * tile cache valid between frames, so panning no longer re-rolls the blades.
 */
function seededNoise(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tile: number,
  h: number,
  seed = 0,
) {
  const half = tile / 2;
  const q = tile / 4;
  const color = heightColor(h);
  const top = shade(color, 1.15);
  const left = shade(color, 0.6);
  const right = shade(color, 0.35);

  const px = Math.floor(h * 8);
  const topY = cy - px;

  ctx.imageSmoothingEnabled = false;

  // top face (diamond)
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + half, topY + q);
  ctx.lineTo(cx, topY + q * 2);
  ctx.lineTo(cx - half, topY + q);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();

  // grass texture on lawn heights
  if (h < 0.4) {
    const random = seededNoise(seed + Math.floor(h * 1000));
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(30,80,20,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const gx = cx - half + random() * tile;
      const gy = topY + random() * (tile / 2);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (random() - 0.5) * 4, gy - 3 - random() * 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // left face
  ctx.beginPath();
  ctx.moveTo(cx - half, topY + q);
  ctx.lineTo(cx, topY + q * 2);
  ctx.lineTo(cx, topY + q * 2 + px);
  ctx.lineTo(cx - half, topY + q + px);
  ctx.closePath();
  ctx.fillStyle = left;
  ctx.fill();

  // right face
  ctx.beginPath();
  ctx.moveTo(cx + half, topY + q);
  ctx.lineTo(cx, topY + q * 2);
  ctx.lineTo(cx, topY + q * 2 + px);
  ctx.lineTo(cx + half, topY + q + px);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();

  // outline for pixel-art crispness
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export interface IsometricRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  centerX: number;
  centerY: number;
}

/**
 * Visible window of a city map around the selected city. Rounding the bounds to
 * tile multiples makes the window stable while panning, which is what allows
 * the per-chunk tile cache to hit.
 */
export function cityVisibleRect(
  size: number,
  cityLon: number,
  cityLat: number,
  refLon: number,
  refLat: number,
  tile: number,
): IsometricRect {
  const cxGrid = Math.round(((cityLon - refLon) * CITY_GRID_SCALE) / tile);
  const cyGrid = Math.round((-(cityLat - refLat) * CITY_GRID_SCALE) / tile);
  // The city does not have to sit inside its region centre: Kalinkovichi is
  // ~20 cells west of the Gomel reference point, which used to clamp the
  // window to zero width and leave the city view a blank field. Slide the
  // window back inside the map instead, keeping the full radius.
  const span = Math.min(2 * CITY_RADIUS, size);
  const startX = Math.min(Math.max(0, cxGrid - CITY_RADIUS), size - span);
  const startY = Math.min(Math.max(0, cyGrid - CITY_RADIUS), size - span);
  const endX = startX + span;
  const endY = startY + span;
  return {
    startX,
    startY,
    endX,
    endY,
    centerX: (startX + endX) / 2,
    centerY: (startY + endY) / 2,
  };
}

/** Chunk size (in tiles per axis) used to cache blocks for big maps. */
export const CHUNK_SIZE = 16;

/** Tile counts that must be drawn for a region map, back-to-front. */
export function regionTileCount(size: number): number {
  return size * size;
}
