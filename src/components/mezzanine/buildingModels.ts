// Procedural 3D models for the mezzanine city builder. Every model is built from
// primitives (boxes, cylinders, cones) so a whole block of town costs almost
// nothing: static parts are merged into one vertex-coloured geometry, and the
// few animated bits (crane jib, smoke puffs, window lights) stay as separate
// meshes. No asset files, no external models — the look is entirely
// deterministic from the building seed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildingKind } from '../../cityBuilder';

export interface BuiltModel {
  /** Static, baked geometry for the whole building (vertex colours). */
  geometry: THREE.BufferGeometry;
  /**
   * Animated details. Their transforms are authored in the building's local
   * space and they are re-parented by the caller, so disposal is handled there.
   */
  animated: AnimatedPart[];
}

export type AnimatedPart =
  | { type: 'crane'; pivot: THREE.Vector3; height: number; phase: number }
  | { type: 'smoke'; origin: THREE.Vector3; phase: number }
  | { type: 'lights'; floors: number; seed: number };

/** Tiny deterministic PRNG so a seed always yields the same façade. */
function hash(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const colorCache = new Map<string, THREE.Color>();
function col(hex: string) {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

/**
 * Collects primitives into one geometry. Every primitive is translated to its
 * place in the building's local space and painted a flat vertex colour, so the
 * whole model is one draw call with one standard material.
 */
class Builder {
  private parts: THREE.BufferGeometry[] = [];

  box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    return this.push(g, hex);
  }

  /** Box with the pivot at its bottom face — the usual case for walls. */
  block(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, rotY = 0) {
    return this.box(w, h, d, x, y + h / 2, z, hex, rotY);
  }

  cyl(rTop: number, rBottom: number, h: number, x: number, y: number, z: number, hex: string, seg = 12) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    g.translate(x, y + h / 2, z);
    return this.push(g, hex);
  }

  cone(r: number, h: number, x: number, y: number, z: number, hex: string, seg = 8, rotY = 0) {
    const g = new THREE.ConeGeometry(r, h, seg);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    return this.push(g, hex);
  }

  /** Triangular prism, used for gabled roofs. Ridge runs along z. */
  prism(w: number, h: number, d: number, x: number, y: number, z: number, hex: string) {
    const g = new THREE.CylinderGeometry(1, 1, d, 3, 1);
    // A 3-sided cylinder standing on a face, scaled into a roof wedge.
    g.rotateY(Math.PI / 2);
    g.rotateX(Math.PI / 2);
    g.scale(w / 1.732, h / 1.5, 1);
    g.translate(x, y + h / 3, z);
    return this.push(g, hex);
  }

  /** HM-style pyramid roof for apartment blocks. */
  pyramid(w: number, d: number, h: number, x: number, y: number, z: number, hex: string) {
    const g = new THREE.ConeGeometry(0.5, h, 4);
    g.rotateY(Math.PI / 4);
    g.scale(w * Math.SQRT2, 1, d * Math.SQRT2);
    g.translate(x, y + h / 2, z);
    return this.push(g, hex);
  }

  private push(g: THREE.BufferGeometry, hex: string) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    // Drop uv/normal noise so every part merges cleanly.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }
    const c = col(hex);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(geo);
    return this;
  }

  build(): THREE.BufferGeometry {
    if (this.parts.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false) ?? new THREE.BufferGeometry();
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Footprint of a lot: models are authored inside a unit square centred on 0. */
const HALF = 0.42;
const FLOOR = 0.34;

function windows(
  b: Builder,
  opts: {
    width: number;
    depth: number;
    floors: number;
    y0: number;
    cols: number;
    glass: string;
    frame: string;
    rnd: () => number;
    litChance?: number;
  },
) {
  const { width, depth, floors, y0, cols, glass, frame, rnd } = opts;
  const ww = Math.min(0.11, (width - 0.06) / (cols * 1.9));
  const wh = Math.min(0.16, FLOOR * 0.52);
  for (let f = 0; f < floors; f++) {
    const wy = y0 + f * FLOOR + FLOOR * 0.42;
    for (let c = 0; c < cols; c++) {
      const t = (c + 0.5) / cols;
      const x = -width / 2 + t * width;
      const z = -depth / 2 + t * depth;
      const lit = rnd() < (opts.litChance ?? 0.35);
      // Sills stick out a hair so the façade reads in flat light.
      b.box(ww + 0.02, wh + 0.02, 0.012, x, wy, depth / 2 + 0.004, frame);
      b.box(ww, wh, 0.02, x, wy, depth / 2 + 0.006, lit ? '#ffe7a3' : glass);
      b.box(0.012, wh + 0.02, ww + 0.02, width / 2 + 0.004, wy, z, frame);
      b.box(0.02, wh, ww, width / 2 + 0.006, wy, z, lit ? '#ffe7a3' : glass);
    }
  }
}

function house(rnd: () => number): THREE.BufferGeometry {
  const b = new Builder();
  const wall = ['#e8dcc0', '#f0e2c8', '#dfd0b4', '#e6d8bd'][Math.floor(rnd() * 4)];
  const roof = ['#a8493a', '#8f3f33', '#b3543f', '#7c4a3a'][Math.floor(rnd() * 4)];
  const floors = 2 + Math.floor(rnd() * 2);
  const h = floors * FLOOR;

  // Plinth and walls.
  b.block(HALF * 2, 0.08, HALF * 2, 0, 0, 0, '#8c8375');
  b.block(HALF * 1.82, h, HALF * 1.82, 0, 0.08, 0, wall);
  windows(b, { width: HALF * 1.82, depth: HALF * 1.82, floors, y0: 0.14, cols: 3, glass: '#4a6274', frame: '#f7f1e3', rnd });

  // Door with a small canopy.
  b.box(0.16, 0.24, 0.02, 0, 0.08 + 0.12, HALF * 0.91 + 0.01, '#5a3a26');
  b.box(0.24, 0.02, 0.08, 0, 0.36, HALF * 0.91 + 0.04, '#f0e6d2');

  // Gabled roof with a chimney.
  b.prism(HALF * 2.04, 0.3, HALF * 2.04, 0, 0.08 + h, 0, roof);
  b.block(0.09, 0.2, 0.09, HALF * 0.45, 0.08 + h + 0.09, -HALF * 0.45, '#9c6b52');

  // A fence post pair and a tree in the yard corner.
  b.block(0.03, 0.12, 0.03, -HALF * 0.88, 0, HALF * 0.9, '#efeadd');
  b.block(0.03, 0.12, 0.03, HALF * 0.1, 0, HALF * 0.98, '#efeadd');
  b.cyl(0.012, 0.016, 0.12, -HALF * 0.8, 0, -HALF * 0.82, '#6b4a33');
  b.cone(0.11, 0.24, -HALF * 0.8, 0.1, -HALF * 0.82, '#3f8a45', 7);
  return b.build();
}

function shop(rnd: () => number): THREE.BufferGeometry {
  const b = new Builder();
  const accent = ['#2f6fae', '#2f8e73', '#a3492f', '#7b4aa8'][Math.floor(rnd() * 4)];
  const floors = 3;
  const h = 0.1 + 0.3 + (floors - 1) * FLOOR;

  b.block(HALF * 2, 0.08, HALF * 2, 0, 0, 0, '#8f8b82');
  b.block(HALF * 1.86, h - 0.08, HALF * 1.86, 0, 0.08, 0, '#e9e4d8');

  // Shopfront: a big glazed band plus an awning over the pavement.
  b.box(HALF * 1.6, 0.22, 0.02, 0, 0.2, HALF * 0.93 + 0.008, '#2b3f4c');
  b.box(HALF * 1.6, 0.03, 0.03, 0, 0.32, HALF * 0.93 + 0.012, '#f4f1e6');
  for (const side of [-1, 1]) {
    b.box(0.02, 0.22, HALF * 1.6, side * (HALF * 0.93 + 0.008), 0.2, 0, '#2b3f4c');
  }
  // Striped awning, alternating panels keeps it readable at any zoom.
  for (let i = 0; i < 6; i++) {
    const px = -HALF * 0.8 + (i + 0.5) * (HALF * 1.6 / 6);
    b.box(HALF * 1.6 / 6, 0.02, 0.1, px, 0.35, HALF * 0.98, i % 2 ? '#f5f0e3' : accent);
  }

  windows(b, { width: HALF * 1.86, depth: HALF * 1.86, floors: floors - 1, y0: 0.4, cols: 3, glass: '#48616f', frame: '#fbf7ec', rnd });

  // Sign band and cornice.
  b.block(HALF * 1.9, 0.07, HALF * 1.9, 0, h, 0, accent);
  b.block(HALF * 2, 0.03, HALF * 2, 0, h + 0.07, 0, '#cfc8b8');

  // Roof clutter: HVAC units.
  b.block(0.13, 0.07, 0.13, -0.1, h + 0.1, -0.08, '#b8bcc0');
  b.block(0.09, 0.05, 0.09, 0.12, h + 0.1, 0.05, '#9aa0a6');
  return b.build();
}

function office(rnd: () => number): THREE.BufferGeometry {
  const b = new Builder();
  const floors = 7 + Math.floor(rnd() * 3);
  const glass = ['#3d6f8f', '#3f7f7a', '#456a92', '#5a6d8a'][Math.floor(rnd() * 4)];
  const h = 0.12 + floors * FLOOR;

  // Two-tier footprint: a wider base and a slimmer tower above it.
  b.block(0.9, 0.12, 0.9, 0, 0, 0, '#6f7680');
  b.block(0.78, h, 0.78, 0, 0.12, 0, '#d3d9de');
  // Curtain wall: continuous horizontal glass bands per floor.
  for (let f = 0; f < floors; f++) {
    const y = 0.18 + f * FLOOR;
    b.box(0.79, FLOOR * 0.5, 0.79, 0, y, 0, glass);
    if ((f + 1) % 3 === 0) {
      // Sun-shade louvres on every third floor.
      b.block(0.86, 0.015, 0.86, 0, y + FLOOR * 0.52, 0, '#eef2f5');
    }
  }
  // Core sticking out of the roof, a lift overrun and an antenna.
  b.block(0.3, 0.16, 0.3, 0.02, 0.12 + h, 0, '#aab2ba');
  b.block(0.26, 0.04, 0.26, 0.02, 0.28 + h, 0, '#8b939b');
  b.cyl(0.008, 0.012, 0.3, 0.02, 0.32 + h, 0, '#c9ced3', 6);
  // Entrance canopy.
  b.box(0.3, 0.02, 0.1, 0, 0.24, 0.44, '#f1f4f7');
  return b.build();
}

function factory(rnd: () => number): THREE.BufferGeometry {
  const b = new Builder();
  const wall = ['#9a8d78', '#8f8578', '#a09380'][Math.floor(rnd() * 3)];
  const h = 0.55;

  b.block(0.96, 0.06, 0.82, 0, 0, -0.04, '#7a7266');
  b.block(0.92, h, 0.78, 0, 0.06, -0.04, wall);

  // Sawtooth roof — the classic industrial silhouette.
  for (let i = 0; i < 4; i++) {
    const z = -0.4 + i * 0.2;
    b.box(0.92, 0.015, 0.16, 0, 0.06 + h + 0.08, z + 0.06, '#6d777d');
  }
  b.block(0.92, 0.02, 0.78, 0, 0.06 + h, -0.04, '#7d858b');

  // Ribbed wall panels and the loading dock.
  for (let i = 0; i < 7; i++) {
    b.box(0.02, h * 0.9, 0.02, -0.4 + i * 0.134, 0.06 + h * 0.05, 0.36, '#877c6c');
  }
  b.box(0.3, 0.26, 0.02, -0.22, 0.06 + 0.13, 0.36, '#5d666b');
  b.box(0.22, 0.24, 0.02, 0.24, 0.06 + 0.12, 0.36, '#4f585d');

  // Chimneys (smoke is animated by the scene).
  b.cyl(0.05, 0.06, 0.62, 0.3, 0.06 + h, -0.26, '#b9b3a8', 12);
  b.cyl(0.055, 0.055, 0.03, 0.3, 0.06 + h + 0.62, -0.26, '#8c2f26', 12);
  b.cyl(0.035, 0.045, 0.45, 0.15, 0.06 + h, -0.33, '#b9b3a8', 10);

  // Water tower for scale.
  b.cyl(0.05, 0.05, 0.18, -0.32, 0.06 + h, -0.28, '#9aa0a4', 10);
  b.cone(0.07, 0.06, -0.32, 0.06 + h + 0.18, -0.28, '#7f868b', 10);
  return b.build();
}

function park(rnd: () => number): THREE.BufferGeometry {
  const b = new Builder();
  // Lawn, a paved path cross and a small fountain in the middle.
  b.block(0.98, 0.03, 0.98, 0, 0, 0, '#4f9a4a');
  b.box(0.14, 0.032, 0.98, 0, 0.016, 0, '#cdbda0');
  b.box(0.98, 0.032, 0.14, 0, 0.016, 0, '#cdbda0');
  b.cyl(0.1, 0.11, 0.06, 0, 0.03, 0, '#b9bec2', 14);
  b.cyl(0.085, 0.085, 0.012, 0, 0.06, 0, '#7fc8e8', 14);
  b.cyl(0.012, 0.016, 0.09, 0, 0.06, 0, '#d7dbde', 8);

  // Trees in the four quadrants, seeded so a park looks the same every render.
  const spots: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.22 + rnd() * 0.22;
    spots.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (const [x, z] of spots) {
    const th = 0.12 + rnd() * 0.1;
    b.cyl(0.014, 0.022, th, x, 0.03, z, '#6b4a33', 6);
    const green = ['#3f8a45', '#4c9b4f', '#357a3c'][Math.floor(rnd() * 3)];
    b.cone(0.09 + rnd() * 0.03, 0.26 + rnd() * 0.1, x, 0.03 + th, z, green, 7);
  }
  // Benches along the path.
  for (const [x, z] of [[-0.06, 0.28], [0.3, -0.2], [-0.28, -0.3]] as [number, number][]) {
    b.box(0.1, 0.015, 0.04, x, 0.06, z, '#8a5b36');
    b.box(0.1, 0.012, 0.012, x, 0.085, z - 0.02, '#8a5b36');
  }
  return b.build();
}

/** Unfinished building: the rising shell plus scaffolding and a crane. */
function construction(kind: BuildingKind, progress: number, seed: number): BuiltModel {
  const rnd = hash(seed);
  const b = new Builder();
  const hMax = kind === 'office' ? 2.6 : kind === 'factory' ? 0.62 : kind === 'park' ? 0 : 1.1;
  const h = Math.max(0.06, hMax * progress);

  if (kind === 'park') {
    // A park is graded first, then planted.
    b.block(0.96, 0.03 + h * 0.5, 0.96, 0, 0, 0, '#5b8a4a');
    for (let i = 0; i < Math.floor(progress * 6); i++) {
      const x = (rnd() - 0.5) * 0.7;
      const z = (rnd() - 0.5) * 0.7;
      b.cyl(0.012, 0.018, 0.1, x, 0.03, z, '#6b4a33', 6);
      b.cone(0.08, 0.2, x, 0.13, z, '#3f8a45', 7);
    }
    return { geometry: b.build(), animated: [] };
  }

  const w = kind === 'factory' ? 0.92 : kind === 'office' ? 0.78 : HALF * 1.82;
  const d = kind === 'factory' ? 0.78 : kind === 'office' ? 0.78 : HALF * 1.82;
  // Concrete frame: slab, then the walls that have been poured so far.
  b.block(w + 0.06, 0.04, d + 0.06, 0, 0, 0, '#9aa0a2');
  b.block(w, h, d, 0, 0.04, 0, kind === 'office' ? '#c3c9cd' : '#cfc7b6');

  // Floor slabs stacking up as the build progresses.
  const floors = Math.max(1, Math.round(h / FLOOR));
  for (let f = 1; f < floors; f++) {
    b.block(w + 0.06, 0.03, d + 0.06, 0, 0.04 + f * FLOOR, 0, '#b3b8ba');
  }

  // Scaffolding on the two visible faces.
  for (const t of [-0.4, 0, 0.4]) {
    b.block(0.022, h + 0.12, 0.022, t * w, 0, d / 2 + 0.03, '#b07d3e');
    b.block(0.022, h + 0.12, 0.022, w / 2 + 0.03, 0, t * d, '#b07d3e');
  }
  for (let y = 0.1; y < h; y += FLOOR * 0.75) {
    b.box(w + 0.05, 0.018, 0.06, 0, y, d / 2 + 0.03, '#c99a55');
    b.box(0.06, 0.018, d + 0.05, w / 2 + 0.03, y, 0, '#c99a55');
  }
  b.box(w + 0.05, 0.018, 0.06, 0, h + 0.14, d / 2 + 0.03, '#d8ab63');
  b.box(0.06, 0.018, d + 0.05, w / 2 + 0.03, h + 0.14, 0, '#d8ab63');

  // Safety mesh: a semi-transparent-ish green sheet reads as netting.
  b.box(w + 0.02, Math.min(h, 0.5), 0.01, 0, 0.06 + Math.min(h, 0.5) / 2, d / 2 + 0.055, '#3f7a4d');

  const animated: AnimatedPart[] = [
    { type: 'crane', pivot: new THREE.Vector3(-w / 2 - 0.12, 0, -d / 2 - 0.1), height: Math.max(0.8, h + 0.7), phase: seed % 7 },
  ];
  return { geometry: b.build(), animated };
}

/** Build the finished (or in-progress) model of one building. */
export function buildBuildingModel(kind: BuildingKind, progress: number, seed: number): BuiltModel {
  if (progress < 1) return construction(kind, progress, seed);
  const rnd = hash(seed);
  let geometry: THREE.BufferGeometry;
  const animated: AnimatedPart[] = [];
  switch (kind) {
    case 'house':
      geometry = house(rnd);
      break;
    case 'shop':
      geometry = shop(rnd);
      break;
    case 'office':
      geometry = office(rnd);
      animated.push({ type: 'lights', floors: 8, seed });
      break;
    case 'factory':
      geometry = factory(rnd);
      animated.push({ type: 'smoke', origin: new THREE.Vector3(0.3, 1.23, -0.26), phase: seed % 5 });
      animated.push({ type: 'lights', floors: 2, seed });
      break;
    case 'park':
    default:
      geometry = park(rnd);
      break;
  }
  return { geometry, animated };
}

/** Shared material for every building: flat colours, soft roughness. */
export function createBuildingMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.02,
  });
}
