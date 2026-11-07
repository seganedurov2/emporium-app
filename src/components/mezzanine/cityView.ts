// Isometric renderer for the mezzanine city builder. Deliberately plain canvas
// 2D: crisp pixel chunks, per-building growth animation and a rotating crane on
// every construction site.
import type { Building, BuildingKind, CityState } from '../../cityBuilder';
import { listStreets } from '../../cityBuilder';

export const TILE_W = 64;
export const TILE_H = 32;
const LEVEL_H = 7;

export interface CityCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface RenderOptions {
  time: number;
  hover?: { x: number; y: number } | null;
  selected?: { x: number; y: number } | null;
  /** Building palette value; videos show the ghost of the next building. */
  kind: BuildingKind;
  showLabels: boolean;
  camera: CityCamera;
  width: number;
  height: number;
}

interface Screen {
  x: number;
  y: number;
}

const PALETTE: Record<BuildingKind, { roof: string; wall: string; side: string; floors: number; w: number; d: number }> = {
  house: { roof: '#b4533a', wall: '#d9c8a8', side: '#b3a181', floors: 2, w: 0.8, d: 0.8 },
  shop: { roof: '#3f7fbf', wall: '#e6e2d6', side: '#bfb9a8', floors: 3, w: 0.9, d: 0.8 },
  office: { roof: '#5b6f86', wall: '#c9d4de', side: '#a3b0bb', floors: 6, w: 0.9, d: 0.9 },
  factory: { roof: '#8a6f3c', wall: '#9a8d78', side: '#7a6f5c', floors: 4, w: 1.0, d: 0.9 },
  park: { roof: '#3f8f44', wall: '#57a85a', side: '#427f45', floors: 1, w: 1.0, d: 1.0 },
  auction_house: { roof: '#7c3aed', wall: '#e9d5ff', side: '#c084fc', floors: 2, w: 1.0, d: 0.9 },
};

const rnd = (n: number) => {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
};

export class CityRenderer {
  /** world cell -> map pixel (unscaled). */
  project(cx: number, cy: number, h = 0): Screen {
    return {
      x: (cx - cy) * (TILE_W / 2),
      y: (cx + cy) * (TILE_H / 2) - h * LEVEL_H,
    };
  }

  /**
   * Screen-space point -> world cell. Coordinates are already in CSS pixels
   * relative to the canvas; `cam` mirrors what `render()` used, so hover and
   * click always hit the cell that was painted.
   */
  pick(sx: number, sy: number, city: CityState, cam: CityCamera, width: number, height: number) {
    const s = cam.zoom;
    const ox = width / 2 - (city.size * TILE_W) / 4 + cam.panX;
    const oy = height / 2 - (city.size * TILE_H) / 2 + cam.panY;
    const px = (sx - ox) / s;
    const py = (sy - oy) / s;
    const a = px / (TILE_W / 2);
    const b = py / (TILE_H / 2);
    const cx = Math.round((a + b) / 2);
    const cy = Math.round((b - a) / 2);
    if (cx < 0 || cy < 0 || cx >= city.size || cy >= city.size) return null;
    return { x: cx, y: cy };
  }

  render(ctx: CanvasRenderingContext2D, city: CityState, opts: RenderOptions) {
    const { camera, width, height, time } = opts;
    const s = camera.zoom;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#2f5d3a';
    ctx.fillRect(0, 0, width, height);

    // Centre the iso diamond: with TILE_W = 2 x TILE_H the grid spans
    // (size * TILE_W / 2) x (size * TILE_H) around its middle cell.
    const originX = width / 2 - (city.size * TILE_W) / 4 + camera.panX;
    const originY = height / 2 - (city.size * TILE_H) / 2 + camera.panY;
    ctx.setTransform(s, 0, 0, s, originX, originY);
    ctx.imageSmoothingEnabled = false;

    this.drawGround(ctx, city);
    this.drawRoads(ctx, city);
    if (opts.showLabels) this.drawStreetNames(ctx, city, opts);

    // Painter's algorithm: back to front.
    for (let y = 0; y < city.size; y++) {
      for (let x = 0; x < city.size; x++) {
        const cell = city.cells[y][x];
        if (cell.type !== 'lot') continue;
        if (cell.building) {
          this.drawBuilding(ctx, x, y, cell.building, time);
        } else {
          this.drawYard(ctx, x, y);
        }
      }
    }

    if (opts.hover) this.drawHighlight(ctx, opts.hover.x, opts.hover.y, 'rgba(255,255,255,0.35)');
    if (opts.selected) this.drawHighlight(ctx, opts.selected.x, opts.selected.y, 'rgba(255,214,0,0.6)');
    if (opts.hover) this.drawGhost(ctx, opts.hover.x, opts.hover.y, opts.kind);

    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, city: CityState) {
    for (let y = 0; y < city.size; y++) {
      for (let x = 0; x < city.size; x++) {
        const n = rnd(x * 12.9898 + y * 78.233);
        const cell = city.cells[y][x];
        const base = cell.type === 'road' ? '#6b6b6b' : n > 0.5 ? '#4d7a4e' : '#467046';
        const p = this.project(x, y);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
        ctx.lineTo(p.x, p.y + TILE_H);
        ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
        ctx.closePath();
        ctx.fillStyle = base;
        ctx.fill();
        // grass speckles, cheap but sells the pixel-art look
        if (cell.type !== 'road' && n > 0.55) {
          ctx.fillStyle = 'rgba(20,60,20,0.25)';
          const gx = p.x + (n - 0.5) * TILE_W * 0.5;
          const gy = p.y + TILE_H * 0.5;
          ctx.fillRect(gx, gy, 3, 2);
        }
      }
    }
  }

  private drawRoads(ctx: CanvasRenderingContext2D, city: CityState) {
    for (let y = 0; y < city.size; y++) {
      for (let x = 0; x < city.size; x++) {
        const cell = city.cells[y][x];
        if (cell.type !== 'road') continue;
        const p = this.project(x, y);
        // asphalt inset inside the diamond
        const k = 0.12;
        const cx = p.x;
        const cy = p.y + TILE_H / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - TILE_H / 2 + TILE_H * k);
        ctx.lineTo(cx + TILE_W / 2 - TILE_W * k * 0.5, cy);
        ctx.lineTo(cx, cy + TILE_H / 2 - TILE_H * k);
        ctx.lineTo(cx - TILE_W / 2 + TILE_W * k * 0.5, cy);
        ctx.closePath();
        ctx.fillStyle = '#7a7a7a';
        ctx.fill();

        // dashed center line along the road direction
        const leftRoad = x > 0 && city.cells[y][x - 1].type === 'road';
        const upRoad = y > 0 && city.cells[y - 1][x].type === 'road';
        ctx.strokeStyle = 'rgba(240,230,160,0.55)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        if (leftRoad) {
          ctx.moveTo(cx - TILE_W / 2, cy);
          ctx.lineTo(cx, cy + TILE_H / 2);
        } else if (upRoad) {
          ctx.moveTo(cx, cy - TILE_H / 2);
          ctx.lineTo(cx + TILE_W / 2, cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawStreetNames(ctx: CanvasRenderingContext2D, city: CityState, opts: RenderOptions) {
    const streets = listStreets(city);
    ctx.font = 'bold 15px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const st of streets) {
      // Pick the road cell of this street closest to the view centre.
      const centre = this.pick(opts.width / 2, opts.height / 2, city, opts.camera, opts.width, opts.height);
      const target = centre ?? { x: city.size / 2, y: city.size / 2 };
      let ax = -1;
      let ay = -1;
      let best = Infinity;
      for (let y = 0; y < city.size; y++) {
        for (let x = 0; x < city.size; x++) {
          const c = city.cells[y][x];
          if (c.type !== 'road' || c.street !== st.name) continue;
          const d = Math.abs(x - target.x) + Math.abs(y - target.y);
          if (d < best) {
            best = d;
            ax = x;
            ay = y;
          }
        }
      }
      if (ax < 0) continue;
      const p = this.project(ax, ay);
      const label = st.name.toUpperCase();
      if (!this.inView(p, city, opts)) continue;
      const w = ctx.measureText(label).width + 18;
      const ly = p.y + TILE_H / 2;
      ctx.fillStyle = 'rgba(15,23,42,0.72)';
      ctx.fillRect(p.x - w / 2, ly - 11, w, 22);
      ctx.fillStyle = '#fde68a';
      ctx.fillText(label, p.x, ly);
    }
  }

  private drawYard(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const p = this.project(x, y);
    const n = rnd(x * 3.17 + y * 9.71);
    // grass patch with a small picket fence, the lot is for sale
    ctx.strokeStyle = 'rgba(240,240,220,0.45)';
    ctx.lineWidth = 1;
    const cx = p.x;
    const cy = p.y + TILE_H / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - TILE_H * 0.22);
    ctx.lineTo(cx + TILE_W * 0.28, cy);
    ctx.lineTo(cx, cy + TILE_H * 0.22);
    ctx.lineTo(cx - TILE_W * 0.28, cy);
    ctx.closePath();
    ctx.stroke();
    if (n > 0.6) {
      ctx.fillStyle = '#3d6b3e';
      ctx.fillRect(cx - 4, cy - 2, 6, 6);
    }
  }

  /** True when a map point lands inside the visible canvas (labels only). */
  private inView(p: Screen, city: CityState, opts: RenderOptions) {
    const s = opts.camera.zoom;
    const ox = opts.width / 2 - (city.size * TILE_W) / 4 + opts.camera.panX;
    const oy = opts.height / 2 - (city.size * TILE_H) / 2 + opts.camera.panY;
    const sx = p.x * s + ox;
    const sy = (p.y + TILE_H / 2) * s + oy;
    return sx > 220 && sx < opts.width - 220 && sy > 90 && sy < opts.height - 90;
  }

  private drawHighlight(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const p = this.project(x, y);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** Translucent preview of the building that would be placed. */
  private drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, kind: BuildingKind) {
    const p = this.project(x, y);
    const st = PALETTE[kind];
    ctx.globalAlpha = 0.45;
    this.block(ctx, p.x, p.y + TILE_H, st.w * TILE_W * 0.6, st.d * TILE_H * 1.2, st.floors * LEVEL_H * 0.6, st.roof, st.wall, st.side);
    ctx.globalAlpha = 1;
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, b: Building, time: number) {
    const p = this.project(x, y);
    const st = PALETTE[b.kind];
    const done = b.progress >= 1;

    if (b.kind === 'park' && done) {
      // Trees: a few blobs, each with its own wind sway.
      const cx = p.x;
      const cy = p.y + TILE_H / 2;
      for (let i = 0; i < 5; i++) {
        const a = rnd(b.id * 7 + i) * Math.PI * 2;
        const r = 8 + rnd(b.id * 3 + i) * 12;
        const tx = cx + Math.cos(a) * r;
        const ty = cy + Math.sin(a) * r * 0.5;
        const sway = Math.sin(time / 700 + i) * 1.5;
        ctx.fillStyle = '#3a4a2a';
        ctx.fillRect(tx - 1, ty - 12, 3, 12);
        ctx.beginPath();
        ctx.arc(tx + sway, ty - 22, 10 + rnd(i + b.id) * 4, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#4f9a4a' : '#5fae55';
        ctx.fill();
      }
      return;
    }

    if (b.kind === 'factory' && done) {
      // Chimney with a puff of smoke.
      ctx.fillStyle = '#8f8577';
      ctx.fillRect(p.x + 14, p.y - 26, 8, 42);
      const phase = (time / 1400 + b.id * 0.37) % 1;
      ctx.beginPath();
      ctx.arc(p.x + 18, p.y - 26 - phase * 26, 5 + phase * 9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,230,230,${0.45 * (1 - phase)})`;
      ctx.fill();
    }

    const fullH = (st.floors + (b.kind === 'office' ? 2 : 0)) * LEVEL_H;
    const h = fullH * (done ? 1 : Math.max(0.06, b.progress));
    const bw = st.w * TILE_W * 0.6;
    const bd = st.d * TILE_H * 1.2;

    this.block(ctx, p.x, p.y + TILE_H, bw, bd, h, st.roof, st.wall, st.side);

    if (!done) {
      this.drawScaffold(ctx, p.x, p.y + TILE_H, bw, bd, h);
      this.drawCrane(ctx, p.x, p.y + TILE_H, h, time, b.id);
      // progress pip above the site
      const w = 34;
      ctx.fillStyle = 'rgba(15,23,42,0.8)';
      ctx.fillRect(p.x - w / 2, p.y - h - 22, w, 6);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(p.x - w / 2 + 1, p.y - h - 21, (w - 2) * b.progress, 4);
    } else {
      // Windows, lit depending on the hour-less "day" cycle of the animation.
      const floors = Math.max(1, Math.floor(h / LEVEL_H));
      const lit = (b.id * 31 + Math.floor(time / 3000)) % 7;
      for (let f = 1; f < floors; f++) {
        for (let c = 0; c < 3; c++) {
          const wx = p.x - bw / 2 + 5 + c * (bw - 10) / 3;
          const wy = p.y + TILE_H - h + f * LEVEL_H - 3;
          const lightOn = (f * 3 + c + lit) % 4 === 0;
          ctx.fillStyle = lightOn ? '#ffe08a' : '#2b3a45';
          ctx.fillRect(wx, wy, 4, 3);
        }
      }
    }
  }

  /** Scaffold hugging both visible walls, with a walk on each level. */
  private drawScaffold(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bd: number, h: number) {
    const hw = bw / 2;
    const hd = bd / 2;
    const lx = x - hw;
    const rx = x + hw;
    const topY = y - h - hd;
    ctx.strokeStyle = 'rgba(176,131,66,0.95)';
    ctx.lineWidth = 1.2;

    // verticals: left corner, front corner, right corner
    for (const [vx, vy] of [
      [lx, y - hd] as const,
      [x, y] as const,
      [rx, y - hd] as const,
    ]) {
      ctx.beginPath();
      ctx.moveTo(vx, vy - 2);
      ctx.lineTo(vx, vy - h - 2);
      ctx.stroke();
    }

    for (let hy = 0; hy <= h; hy += LEVEL_H) {
      // left wall: from the left corner to the front corner
      ctx.beginPath();
      ctx.moveTo(lx, y - hd - hy);
      ctx.lineTo(x, y - hy);
      ctx.stroke();
      // right wall: from the front corner to the right corner
      ctx.beginPath();
      ctx.moveTo(x, y - hy);
      ctx.lineTo(rx, y - hd - hy);
      ctx.stroke();
    }

    // top walkway outline so the site reads as "under scaffolding"
    ctx.strokeStyle = 'rgba(205,160,90,0.8)';
    ctx.beginPath();
    ctx.moveTo(lx, topY + hd);
    ctx.lineTo(x, topY + hd * 2);
    ctx.lineTo(rx, topY + hd);
    ctx.stroke();
  }

  /** Yellow tower crane on the site's back corner; the jib sweeps slowly. */
  private drawCrane(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, time: number, seed: number) {
    const mastX = x + 10;
    const mastBase = y - 12;
    const mastTop = y - h - 30;
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(mastX - 1.5, mastTop, 3, mastBase - mastTop);
    // mast cross-bracing
    ctx.strokeStyle = 'rgba(90,70,10,0.55)';
    ctx.lineWidth = 0.8;
    for (let my = mastTop + 4; my < mastBase; my += 6) {
      ctx.beginPath();
      ctx.moveTo(mastX - 1.5, my);
      ctx.lineTo(mastX + 1.5, my + 6);
      ctx.stroke();
    }

    // The jib is a flat 2:1 slope like the ground tiles, so it foreshortens.
    const angle = Math.sin(time / (900 + (seed % 5) * 120)) * 1.1 - 0.35;
    ctx.save();
    ctx.translate(mastX, mastTop);
    ctx.transform(1, 0, 0, 0.5, 0, 0);
    ctx.rotate(angle);
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(0, -1.5, 26, 3);
    ctx.fillStyle = '#5d4a05';
    ctx.fillRect(-8, -1.2, 8, 2.4); // counter-jib
    ctx.restore();

    // hook hangs straight down from the jib tip, swings a little
    const tipX = mastX + Math.cos(angle) * 26;
    const tipY = mastTop + Math.sin(angle) * 26 * 0.5;
    const swing = Math.sin(time / 1300 + seed) * 2;
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + swing, tipY + 14);
    ctx.stroke();
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(tipX + swing - 2, tipY + 14, 5, 4);
  }

  private block(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    roof: string,
    wall: string,
    side: string,
  ) {
    const hw = w / 2;
    const hd = d / 2;
    // left wall
    ctx.beginPath();
    ctx.moveTo(x - hw, y - hd);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x - hw, y - hd - h);
    ctx.closePath();
    ctx.fillStyle = side;
    ctx.fill();
    // right wall
    ctx.beginPath();
    ctx.moveTo(x + hw, y - hd);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + hw, y - hd - h);
    ctx.closePath();
    ctx.fillStyle = wall;
    ctx.fill();
    // roof
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + hw, y - hd - h);
    ctx.lineTo(x, y - d - h);
    ctx.lineTo(x - hw, y - hd - h);
    ctx.closePath();
    ctx.fillStyle = roof;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}


