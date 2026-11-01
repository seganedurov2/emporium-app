import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { TerrainGenerator, t, type Lang, type Heightmap } from '../../terrain';
import { KalinkovichiGame, type MapCenter } from '../world/KalinkovichiGame';
import { KalinkovichiMap } from './KalinkovichiMap';
import { CityBuilderView } from './CityBuilderView';
import { APP_NAVIGATION, type AppTab } from '../../appNavigation';
import { cityVisibleRect, drawBlock } from '../../mezzanineRender';
import {
  MEZZANINE_KEYMAP_ROWS,
  MEZZANINE_REGION_SHORTCUTS,
  accumulateWheelZoom,
  resolveMezzanineShortcut,
  type MezzanineShortcutAction
} from '../../mezzanineShortcuts';
import {
  clampTile,
  normalizeMezzanineViewState,
  type MezzanineViewState
} from '../../mezzanineViewState';

const REGION_CITIES: Record<string, { name: string; lat: number; lon: number; seed: number }[]> = {
  brest: [
    { name: 'Брест', lat: 52.0976, lon: 23.6832, seed: 2101 },
    { name: 'Барановичи', lat: 53.1283, lon: 26.0214, seed: 2102 },
    { name: 'Пинск', lat: 52.1228, lon: 26.0989, seed: 2103 },
    { name: 'Кобрин', lat: 52.2143, lon: 24.3587, seed: 2104 },
    { name: 'Лида', lat: 53.8835, lon: 25.2968, seed: 2105 }
  ],
  vitebsk: [
    { name: 'Витебск', lat: 55.1904, lon: 30.2048, seed: 3101 },
    { name: 'Орша', lat: 54.5139, lon: 30.4178, seed: 3102 },
    { name: 'Новополоцк', lat: 55.5375, lon: 28.6717, seed: 3103 },
    { name: 'Полоцк', lat: 55.4493, lon: 28.7846, seed: 3104 },
    { name: 'Молодечно', lat: 54.1457, lon: 26.7865, seed: 3105 }
  ],
  gomel: [
    { name: 'Калинковичи', lat: 52.1288, lon: 29.3325, seed: 1101 },
    { name: 'Гомель', lat: 52.4345, lon: 30.9764, seed: 2202 },
    { name: 'Мозырь', lat: 52.0538, lon: 29.2342, seed: 3303 },
    { name: 'Жлобин', lat: 52.8957, lon: 30.0262, seed: 4404 },
    { name: 'Речица', lat: 52.3617, lon: 30.3916, seed: 5505 },
    { name: 'Светлогорск', lat: 52.6308, lon: 29.7389, seed: 6606 },
    { name: 'Буда-Кошелёво', lat: 52.7167, lon: 30.5667, seed: 7707 },
    { name: 'Хойники', lat: 52.1897, lon: 29.5407, seed: 8808 },
    { name: 'Ветка', lat: 52.6019, lon: 31.0269, seed: 9909 },
    { name: 'Добруш', lat: 52.4125, lon: 31.2178, seed: 1010 },
    { name: 'Наровля', lat: 51.9003, lon: 29.1503, seed: 1111 },
    { name: 'Житковичи', lat: 52.2167, lon: 27.8667, seed: 1212 },
    { name: 'Корма', lat: 52.3844, lon: 30.9683, seed: 1313 },
    { name: 'Лельчицы', lat: 51.8333, lon: 28.3167, seed: 1414 },
    { name: 'Рогачёв', lat: 53.0964, lon: 30.0583, seed: 1515 }
  ],
  grodno: [
    { name: 'Гродно', lat: 53.6781, lon: 23.8244, seed: 4101 },
    { name: 'Лида', lat: 53.8835, lon: 25.2968, seed: 4102 },
    { name: 'Слоним', lat: 53.0927, lon: 25.3155, seed: 4103 },
    { name: 'Волковыск', lat: 53.1514, lon: 24.4583, seed: 4104 },
    { name: 'Ошмяны', lat: 54.4475, lon: 25.9766, seed: 4105 }
  ],
  minsk: [
    { name: 'Минск', lat: 53.9045, lon: 27.5615, seed: 5101 },
    { name: 'Борисов', lat: 54.1979, lon: 28.5074, seed: 5102 },
    { name: 'Слуцк', lat: 53.0318, lon: 27.5587, seed: 5103 },
    { name: 'Марьина Горка', lat: 53.7667, lon: 27.4000, seed: 5104 },
    { name: 'Зодзино', lat: 53.9000, lon: 27.2000, seed: 5105 }
  ],
  mogilev: [
    { name: 'Могилёв', lat: 53.9078, lon: 30.3391, seed: 6101 },
    { name: 'Бобруйск', lat: 53.1395, lon: 29.2327, seed: 6102 },
    { name: 'Осиповичи', lat: 53.3295, lon: 28.6161, seed: 6103 },
    { name: 'Климовичи', lat: 53.2091, lon: 31.9729, seed: 6104 },
    { name: 'Кричев', lat: 53.6457, lon: 31.6249, seed: 6105 }
  ],
  'minsk-city': [
    { name: 'Минск', lat: 53.9045, lon: 27.5615, seed: 7101 }
  ]
};

const REGIONS: { id: string; name: string; lat: number; lon: number }[] = [
  { id: 'brest', name: 'Брестская область', lat: 52.0976, lon: 23.6832 },
  { id: 'vitebsk', name: 'Витебская область', lat: 55.1904, lon: 30.2048 },
  { id: 'gomel', name: 'Гомельская область', lat: 52.4345, lon: 30.9764 },
  { id: 'grodno', name: 'Гродненская область', lat: 53.6781, lon: 23.8244 },
  { id: 'minsk', name: 'Минская область', lat: 53.9045, lon: 27.5615 },
  { id: 'mogilev', name: 'Могилёвская область', lat: 53.9078, lon: 30.3391 },
  { id: 'minsk-city', name: 'Город Минск', lat: 53.9045, lon: 27.5615 }
];

interface MezzanineTabProps {
  /** Jumps to any campaign section; the мезонин stays the home map. */
  onOpenTab?: (tab: AppTab) => void;
  gameState?: { roster: { id: string }[]; mezzanine?: MezzanineViewState };
  /** Persists the map view into the campaign save (0.3.7). */
  onViewChange?: (view: MezzanineViewState) => void;
}

export function MezzanineTab({ onOpenTab, gameState, onViewChange }: MezzanineTabProps) {
  const [lang] = useState<Lang>('ru');
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [grid, setGrid] = useState<Heightmap | null>(null);
  const [inGame, setInGame] = useState<boolean>(true);
  const [dragging, setDragging] = useState(false);
  const [pauseMenu, setPauseMenu] = useState(false);
  const [keymapOpen, setKeymapOpen] = useState(false);
  // Region / city / zoom / pan / seed — saved with the campaign so the hub
  // comes back exactly where the player left it.
  const [view, setView] = useState<MezzanineViewState>(() =>
    normalizeMezzanineViewState(gameState?.mezzanine)
  );
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [centerPick, setCenterPick] = useState<MapCenter | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gen = useMemo(() => new TerrainGenerator(), []);
  const offsetRef = useRef(view.offset);
  offsetRef.current = view.offset;

  const { selectedRegionId: selectedRegion, selectedCity, viewMode, gridSize, offset, citySeed } = view;
  const cityView = viewMode === 'city';
  const view3d = viewMode === '3d';
  const viewCity = viewMode === 'city_plan';

  const selectRegion = useCallback((id: string) => {
    setView(prev => ({
      ...prev,
      selectedRegionId: id,
      selectedCity: null,
      viewMode: 'region',
      offset: { x: 0, y: 0 }
    }));
    if (id === 'gomel') {
      const city = REGION_CITIES.gomel[0];
      setView(prev => ({ ...prev, selectedCity: city, viewMode: 'city', gridSize: 48 }));
      setGrid(gen.generate(city.seed));
      return;
    }
    setGrid(gen.generate(Date.now()));
  }, [gen]);

  const selectCity = useCallback((city: { name: string; lat: number; lon: number; seed: number }) => {
    const region = REGIONS.find(r => r.id === selectedRegion);
    const refLon = region?.lon || 27.5615;
    const refLat = region?.lat || 53.9045;
    setView(prev => ({
      ...prev,
      selectedCity: city,
      viewMode: 'city',
      gridSize: 48,
      offset: { x: (city.lon - refLon) * 800, y: -(city.lat - refLat) * 800 }
    }));
    setGrid(gen.generate(city.seed));
  }, [gen, selectedRegion]);

  const backToRegion = () => {
    setView(prev => ({ ...prev, viewMode: 'region', offset: { x: 0, y: 0 }, gridSize: 64 }));
  };

  // Restore the saved map: regenerate the terrain from the stored seed, so a
  // reload brings back the same island instead of a random one.
  useEffect(() => {
    setGrid(gen.generate(view.selectedCity?.seed ?? Date.now()));
    // Run once on mount; later map switches call gen.generate directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push view changes into the campaign save.
  useEffect(() => {
    onViewChange?.(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const applyShortcut = useCallback((action: MezzanineShortcutAction) => {
    switch (action.type) {
      case 'region': {
        const region = MEZZANINE_REGION_SHORTCUTS[action.index];
        if (region) selectRegion(region.id);
        break;
      }
      case 'toggleCity':
        setView(prev => ({
          ...prev,
          viewMode: prev.viewMode === 'city' ? 'region' : 'city',
          selectedCity: prev.selectedCity ?? REGION_CITIES[prev.selectedRegionId ?? '']?.[0] ?? null,
          gridSize: prev.viewMode === 'city' ? 64 : 48,
          offset: { x: 0, y: 0 }
        }));
        break;
      case 'viewMode':
        setView(prev => ({
          ...prev,
          viewMode: action.mode,
          citySeed: action.mode === 'city_plan' ? (prev.selectedCity?.seed ?? prev.citySeed) : prev.citySeed
        }));
        break;
      case 'sections':
        setSectionsOpen(open => !open);
        break;
      case 'keymap':
        setKeymapOpen(open => !open);
        break;
      case 'zoom':
        setView(prev => ({ ...prev, gridSize: clampTile(prev.gridSize + action.delta, prev.gridSize) }));
        break;
    }
  }, [selectRegion]);

  // Keyboard: the key map for the world, hotkeys, Escape and the 3D view share
  // one listener, so one Escape press can never open and close the menu.
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      // A focused toolbar button would be "clicked" by Space and Enter, so
      // hotkeys must not leak into whatever the pointer last touched.
      if (e.key === ' ' || e.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        if (active && active.tagName === 'BUTTON') active.blur();
      }
      const target = e.target as HTMLElement | null;
      const typing = Boolean(
        target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      );
      const overlayOpen = pauseMenu || keymapOpen || viewCity;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (view3d) {
          setView(prev => ({ ...prev, viewMode: 'region' }));
        } else if (keymapOpen) {
          setKeymapOpen(false);
        } else if (viewCity) {
          setView(prev => ({ ...prev, viewMode: 'city' }));
        } else if (pauseMenu) {
          setPauseMenu(false);
        } else {
          setPauseMenu(true);
        }
        return;
      }

      const action = resolveMezzanineShortcut(e.key, {
        typing,
        overlayOpen,
        hasRegion: Boolean(selectedRegion)
      });
      if (!action) return;
      if (action.type !== 'keymap') e.preventDefault();
      applyShortcut(action);
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    // Leaving the hub drops focus on a toolbar button; otherwise every hotkey it
    // did not use would "click" the map again. Mapping the world still needs
    // the key state (__gameKeys), which this does not touch.
    const dropMapFocus = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && active.closest('[data-map-controls]')) active.blur();
    };
    document.addEventListener('click', dropMapFocus, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    (window as any).__gameKeys = keys;
    return () => {
      document.removeEventListener('click', dropMapFocus, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [applyShortcut, keymapOpen, pauseMenu, selectedRegion, view3d, viewCity]);

  // Wheel zoom is coalesced into one state update per animation frame; before
  // 0.3.7 every wheel tick re-rendered the whole map.
  useEffect(() => {
    if (!inGame) return;
    let pending = 0;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (!pending) return;
      const delta = pending;
      pending = 0;
      setView(prev => ({ ...prev, gridSize: clampTile(prev.gridSize + delta, prev.gridSize) }));
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      pending = accumulateWheelZoom(pending, e.deltaY);
      if (!frame) frame = requestAnimationFrame(flush);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [inGame]);

  // Layout effect: the canvas is filled before the browser paints, so the hub
  // never shows an empty map frame after a mount or a view change.
  // Redraw on resize: the canvas is sized from the host box, so a window
  // resize (or a sidebar toggle) must rebuild it instead of stretching it.
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const host = canvasRef.current?.closest('[data-map-controls]') as HTMLElement | null;
    if (!host) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect) setBox({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = grid.length;
    const dpr = window.devicePixelRatio || 1;
    // The canvas must match the hub box, never grow with its own content: with
    // `parentElement.clientHeight` a 1494px canvas was created inside a 720px
    // viewport and pushed the map (and the controls) off screen. `clientHeight`
    // of the host is already clipped by the flex parent.
    const host = canvas.closest('[data-map-controls]') as HTMLElement | null;
    const w = Math.max(box.w || host?.clientWidth || 0, 320);
    const h = Math.max(box.h || host?.clientHeight || 0, 320);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Below the map there is no "outside": the canvas is bigger than the
    // viewport, so the surrounding hill colour is drawn on it as well.
    // Layout is in canvas pixels: panels on the left and right (~300px each)
    // and the bottom toolbar sit above the map. Keep the map inside the free
    // area so tiles never run underneath the controls.
    const PAD_LEFT = 300;
    const PAD_RIGHT = 300;
    const PAD_TOP = 24;
    const PAD_BOTTOM = 96;
    const viewW = Math.max(240, w - PAD_LEFT - PAD_RIGHT);
    const viewH = Math.max(200, h - PAD_TOP - PAD_BOTTOM);

    ctx.fillStyle = '#1a4d2e';
    ctx.fillRect(0, 0, w, h);

    // Clip everything to the free area, then move the origin into it.
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD_LEFT, PAD_TOP, viewW, viewH);
    ctx.clip();
    ctx.translate(PAD_LEFT, PAD_TOP);

    // ox/oy is the screen position of the map centre; both branches place
    // tiles relative to it, so the diamond stays centred while panning.
    const ox = viewW / 2 + offsetRef.current.x;
    const oy = viewH / 2 + offsetRef.current.y;

    // Only the visible part of a big map is drawn (0.3.7): a 64x64 region at
    // tile 48 is 8k x 4k px, and filling that every frame made the second
    // click on the hub show a blank canvas for seconds.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewW, viewH);
    ctx.clip();

    // city view: render a focused small map around the selected city
    if (cityView && selectedCity) {
      const cityTile = gridSize;
      const region = REGIONS.find(r => r.id === selectedRegion);
      const refLon = region?.lon || selectedCity.lon;
      const refLat = region?.lat || selectedCity.lat;
      const rect = cityVisibleRect(size, selectedCity.lon, selectedCity.lat, refLon, refLat, cityTile);
      const { startX, endX, startY, endY, centerX: cx, centerY: cy } = rect;

      // Isometric cell (x, y) sits at ((x - y) * half, (x + y) * quarter)
      // relative to the window centre, so the diamond is centred on ox/oy.
      // Using x/cx per axis (as before) skewed a 14-tile window into a corner.
      const screenX = (gx: number, gy: number) => ox + (gx - cx - (gy - cy)) * cityTile / 2;
      const screenY = (gx: number, gy: number) => oy + (gx - cx + gy - cy) * cityTile / 4;

      // Tile extent: half a tile wide, quarter tile tall, plus the height lift.
      const halfW = cityTile / 2 + 2;
      const halfH = cityTile / 2 + 2;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const sx = screenX(x, y);
          const sy = screenY(x, y);
          if (sx + halfW < 0 || sx - halfW > viewW) continue;
          if (sy + halfH < 0 || sy - halfH > viewH) continue;
          drawBlock(ctx, sx, sy, cityTile, grid[y][x], x * 7919 + y);
        }
      }
    } else {
      // Fit the whole region into the box: a 64x64 grid at tile 48 spans
      // ~3000 px, so only a handful of cells would be visible. gridSize from
      // the wheel stays the upper bound, so zooming in still works.
      // A 64x64 diamond spans `size * tile` wide and `size * tile / 2` tall.
      // Keep a 10% margin so the corners are not flush against the canvas edge,
      // and let gridSize zoom in past the fitted size.
      const margin = 0.9;
      const fitTile = Math.max(3, Math.min((viewW * margin) / size, (viewH * 2 * margin) / size));
      const regionTile = gridSize <= fitTile ? gridSize : fitTile;

      // Same isometric projection as the city branch, centred on ox/oy: the
      // whole grid's centre is (size / 2, size / 2), so the diamond is
      // symmetric and never drifts towards a corner as the tile size changes.
      const mid = size / 2;
      const screenX = (gx: number, gy: number) => ox + (gx - gy) * regionTile / 2;
      const screenY = (gx: number, gy: number) => oy + (gx + gy - 2 * mid) * regionTile / 4;

      // Ground plane lines, drawn first so the blocks cover them.
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y <= size; y++) {
        ctx.beginPath();
        ctx.moveTo(screenX(0, y), screenY(0, y));
        ctx.lineTo(screenX(size, y), screenY(size, y));
        ctx.stroke();
      }
      for (let x = 0; x <= size; x++) {
        ctx.beginPath();
        ctx.moveTo(screenX(x, 0), screenY(x, 0));
        ctx.lineTo(screenX(x, size), screenY(x, size));
        ctx.stroke();
      }

      // Draw back-to-front: x + y grows towards the viewer.
      const halfW = regionTile / 2 + 2;
      const halfH = regionTile / 2 + 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const cx = screenX(x, y);
          const cy = screenY(x, y);
          if (cx + halfW < 0 || cx - halfW > viewW) continue;
          if (cy + halfH < 0 || cy - halfH > viewH) continue;
          drawBlock(ctx, cx, cy, regionTile, grid[y][x], x * 7919 + y);
        }
      }
    }

    ctx.restore();
  }, [cityView, grid, gridSize, offset, selectedCity, selectedRegion, box.w, box.h]);

  const loadMap = async (f: File) => {
    try {
      const g = await gen.fromFile(f);
      setGrid(g);
      setInGame(true);
    } catch {
      console.error('Failed to load map.');
    }
  };

  const loadKalinkovichi = () => {
    const city = REGION_CITIES.gomel[0];
    setView(prev => ({
      ...prev,
      selectedRegionId: 'gomel',
      selectedCity: city,
      viewMode: 'city',
      gridSize: 48,
      offset: { x: 0, y: 0 }
    }));
    setGrid(gen.generate(city.seed));
    setInGame(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    last.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setView(prev => ({ ...prev, offset: { x: prev.offset.x + dx, y: prev.offset.y + dy * 0.2 } }));
  };

  const handleMouseUp = () => setDragging(false);

  // Full-screen 3D view. Rendered in place of the map so the overlay controls
  // (which assume the last game screen) can never swallow the pointer.
  if (view3d) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <KalinkovichiGame
          key={mapCenter ? `${mapCenter.lat},${mapCenter.lon}` : 'default'}
          initialCenter={mapCenter ?? undefined}
          onExit={() => setView(prev => ({ ...prev, viewMode: 'region' }))}
        />
      </div>
    );
  }

  // City builder: named streets, numbered lots and animated construction.
  if (viewCity) {
    return (
      <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-slate-800">
        <CityBuilderView citySeed={citySeed} peopleCount={gameState?.roster.length ?? 0} />
        <button
          onClick={() => setView(prev => ({ ...prev, viewMode: 'city' }))}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-red-600/85 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-lg"
        >
          Выйти из плана города
        </button>
      </div>
    );
  }

  return (
    // h-full, not h-screen: the app shell already sizes the content area
    // (`h-[calc(100vh-5rem)]`), and adding 100vh inside it made the page
    // scroll past the hub instead of stopping on the map.
    // Height is taken from the viewport, not from the flex parent: the parent
    // has no explicit height, so `h-full` resolved against the content and the
    // hub grew to 1494px inside a 720px window.
    <div
      data-map-controls
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100vh - 5rem)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {grid && (
        <div className="absolute inset-0 flex items-center justify-center">
          <canvas ref={canvasRef} className="block cursor-grab active:cursor-grabbing" />
          {/* Compass sits under the right-hand controls, not on top of them. */}
          <div className="absolute bottom-24 right-4 z-20 flex flex-col items-center gap-2 pointer-events-none opacity-70">
            <div className="rounded-lg bg-black/50 border border-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">С</div>
            <div className="flex items-center gap-1">
              <div className="rounded-lg bg-black/50 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">З</div>
              <div className="rounded-lg bg-black/50 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">В</div>
            </div>
            <div className="rounded-lg bg-black/50 border border-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">Ю</div>
          </div>
          {cityView && selectedCity && (
            <div className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-500 bg-black/90 px-4 py-1.5 text-white shadow-lg">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button onClick={backToRegion} className="text-[11px] text-amber-400 underline hover:text-amber-300">Назад к области</button>
                <span className="rounded border border-amber-400/30 bg-amber-600/60 px-2 py-0.5 text-[11px] font-bold">
                  {selectedCity.name}
                </span>
                <span className="hidden text-[10px] text-gray-400 sm:inline">
                  {selectedCity.lat.toFixed(3)}, {selectedCity.lon.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Left stack: title, region badge and the mini map share one column, so
          the badge text is never clipped by the canvas underneath. */}
      {/* Left column: one flow so the title, the region badge and the
          sections button cannot overlap each other. */}
      <div className="absolute left-4 top-4 z-20 flex w-[260px] max-w-[42%] flex-col gap-2">
        <div className="pointer-events-none rounded-lg bg-black/85 px-4 py-3 text-sm text-white backdrop-blur">
          <div className="truncate font-bold">{t(lang, 'topDown')}</div>
          <div className="mt-1 text-xs text-gray-400">Pixel art · ЛКМ перетаскивать · колёсико зум · ? — клавиши</div>
        </div>
        {selectedRegion && (
          <div className="pointer-events-none rounded-lg border border-amber-500/30 bg-black/90 px-3 py-2 text-sm text-white backdrop-blur">
            <div className="truncate font-bold text-amber-400">{REGIONS.find(r => r.id === selectedRegion)?.name}</div>
            <div className="mt-0.5 text-xs text-gray-400">Область Беларуси</div>
          </div>
        )}
        {onOpenTab && (
          <div>
          <button
            onClick={() => setSectionsOpen(o => !o)}
            aria-expanded={sectionsOpen}
            className="w-full rounded-lg border border-amber-500/40 bg-black/90 px-3 py-2 text-left text-xs font-bold text-amber-300 backdrop-blur hover:bg-black"
          >
            {sectionsOpen ? 'Свернуть разделы' : `Разделы игры (${APP_NAVIGATION.length})`}
          </button>
          {sectionsOpen && (
            <div className="mt-1 flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto rounded-lg border border-amber-500/30 bg-black/85 p-1 backdrop-blur">
              {APP_NAVIGATION.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onOpenTab(tab.id)}
                    disabled={tab.id === 'mezzanine'}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${tab.id === 'mezzanine' ? 'cursor-default bg-amber-500/10 text-amber-300' : 'text-slate-300 hover:bg-slate-700/80 hover:text-white'}`}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => onOpenTab('mezzanine_journal')}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition text-slate-300 hover:bg-slate-700 hover:text-white border-t border-slate-800 mt-1 pt-1"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">Журнал «Информатика»</span>
              </button>
            </div>
          )}
          </div>
        )}
      </div>
      {/* One control column: earlier these panels were positioned separately
          (right-80 / right-4 / right-[340px]) and overlapped each other. */}
      <div className="absolute top-4 right-4 z-10 flex w-64 flex-col gap-2">
      <div className="bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 flex flex-col gap-2 shadow-lg">
        <div className="text-xs text-amber-400 font-bold mb-1">Режим вида</div>
        <select
          value={cityView ? 'city' : 'region'}
          onChange={(e) => {
            if (e.target.value === 'city') {
              if (selectedCity) {
                setView(prev => ({ ...prev, viewMode: 'city', gridSize: 48, offset: { x: 0, y: 0 } }));
                setGrid(gen.generate(selectedCity.seed));
              } else if (selectedRegion && REGION_CITIES[selectedRegion]?.length) {
                const c = REGION_CITIES[selectedRegion][0];
                setView(prev => ({ ...prev, selectedCity: c, viewMode: 'city', gridSize: 48, offset: { x: 0, y: 0 } }));
                setGrid(gen.generate(c.seed));
              }
            } else {
              setView(prev => ({ ...prev, viewMode: 'region', offset: { x: 0, y: 0 } }));
              if (selectedRegion) setGrid(gen.generate(Date.now()));
            }
          }}
          className="w-full bg-black/60 text-white text-xs border border-amber-500/30 rounded px-2 py-1.5 focus:outline-none focus:border-amber-400"
        >
          <option value="region">Карта области</option>
          <option value="city">Карта города</option>
        </select>
      </div>
      <div className="bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 flex flex-col gap-2 shadow-lg">
        <div className="text-xs text-amber-400 font-bold mb-1">Область Беларуси</div>
        <select
          value={selectedRegion || ''}
          onChange={(e) => selectRegion(e.target.value)}
          className="w-full bg-black/60 text-white text-xs border border-amber-500/30 rounded px-2 py-1.5 focus:outline-none focus:border-amber-400"
        >
          <option value="">— выберите область —</option>
          {REGIONS.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      {selectedRegion && REGION_CITIES[selectedRegion] && (
        <div className="bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 flex flex-col gap-2 shadow-lg">
          <div className="text-xs text-amber-400 font-bold mb-1">Город {REGIONS.find(r => r.id === selectedRegion)?.name}</div>
          <select
            value={selectedCity?.name || ''}
            onChange={(e) => {
              const c = REGION_CITIES[selectedRegion!]?.find(city => city.name === e.target.value);
              if (c) selectCity(c);
            }}
            className="w-full bg-black/60 text-white text-xs border border-amber-500/30 rounded px-2 py-1.5 focus:outline-none focus:border-amber-400"
          >
            <option value="">— выберите город —</option>
            {REGION_CITIES[selectedRegion!].map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 flex items-center justify-center gap-2 shadow-lg">
        <span className="text-[10px] uppercase tracking-widest text-slate-400">Зум</span>
        <button onClick={() => setView(prev => ({ ...prev, gridSize: clampTile(prev.gridSize - 8, prev.gridSize) }))} className="bg-black/60 hover:bg-black/80 text-white px-3 py-1 rounded">−</button>
        <button onClick={() => setView(prev => ({ ...prev, gridSize: clampTile(prev.gridSize + 8, prev.gridSize) }))} className="bg-black/60 hover:bg-black/80 text-white px-3 py-1 rounded">+</button>
      </div>
      </div>
      {/* Bottom toolbar: one row inside the hub. The previous buttons were
          pinned to bottom-4 of the 100vh box, which sat below a 720px viewport
          and was unreachable (0.3.7 follow-up). */}
      <div className="absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-center gap-2">
        <button onClick={() => setGrid(gen.generate(Date.now()))} className="bg-amber-600/85 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm">Новая карта</button>
        <button onClick={loadKalinkovichi} className="bg-blue-600/85 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm">Калинковичи</button>
        <button
          onClick={() => setView(prev => ({ ...prev, citySeed: selectedCity?.seed ?? 1101, viewMode: 'city_plan' }))}
          className="bg-fuchsia-600/85 hover:bg-fuchsia-600 text-white px-4 py-2 rounded text-sm"
          title="План города: улицы, адреса, стройка домов"
        >
          Стройка города
        </button>
        <button
          onClick={() => { setMapCenter(centerPick); setView(prev => ({ ...prev, viewMode: '3d' })); }}
          className="bg-emerald-600/85 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm"
          title="Трёхмерная карта Калинковичей"
        >
          3D-карта
        </button>
        <button
          onClick={() => setKeymapOpen(open => !open)}
          className="bg-slate-700/85 hover:bg-slate-700 text-white px-3 py-2 rounded text-xs"
          title="Горячие клавиши (?)"
        >
          ?
        </button>
        <label className="ml-auto cursor-pointer rounded bg-blue-600/85 px-4 py-2 text-sm text-white hover:bg-blue-600">
          Загрузить heightmap
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) loadMap(f); }} />
        </label>
      </div>
      <div className="absolute bottom-20 left-4 z-10 w-[220px] max-w-[40%]">
        <KalinkovichiMap
          compact
          onPick={setCenterPick}
          onOpen3d={(c: MapCenter) => { setMapCenter(c); setView(prev => ({ ...prev, viewMode: '3d' })); }}
        />
      </div>



      {/* Overlays live in a fixed layer: the hub box is 100vh tall inside the app
          shell, so an absolute overlay would sit under the header and get
          clipped by the content area (0.3.7). */}
      {/* Keymap overlay (0.3.7): rendered from the same table the handler uses. */}
      {keymapOpen && (
        <div role="dialog" aria-label="горячие клавиши" className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => setKeymapOpen(false)} />
          <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto mx-4 bg-black/90 border border-amber-500/40 rounded-xl p-5 shadow-[0_0_80px_rgba(251,191,36,0.15)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold tracking-[0.25em] uppercase text-amber-400">Горячие клавиши мезонина</div>
              <button onClick={() => setKeymapOpen(false)} className="text-slate-400 hover:text-amber-200 text-xs">закрыть</button>
            </div>
            <div className="flex flex-col divide-y divide-slate-800">
              {MEZZANINE_KEYMAP_ROWS.map(row => (
                <div key={row.keys} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-amber-300">{row.keys}</span>
                  <span className="text-right text-xs text-slate-300">{row.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pauseMenu && onOpenTab && (
        <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => setPauseMenu(false)} />
          <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto mx-4">
            <div className="text-center mb-6">
              <div className="text-2xl font-bold tracking-[0.3em] uppercase text-amber-400">Меню</div>
              <div className="text-xs text-amber-200/60 mt-1 tracking-[0.4em] uppercase">Мезонин</div>
            </div>
            <div className="bg-black/90 border border-amber-500/40 rounded-xl shadow-[0_0_80px_rgba(251,191,36,0.15)] overflow-hidden">
              <div className="px-6 py-4 border-b border-amber-500/30">
                <div className="text-xs text-amber-400/80 uppercase tracking-widest">Разделы игры</div>
              </div>
              <div className="flex flex-col">
                {APP_NAVIGATION.map(tab => {
                  const Icon = tab.icon;
                  const isMezzanine = tab.id === 'mezzanine';
                  return (
                    <button
                      key={tab.id}
                      disabled={isMezzanine}
                      onClick={() => {
                        if (isMezzanine) return;
                        setPauseMenu(false);
                        onOpenTab(tab.id);
                      }}
                      className={`group flex items-center gap-3 px-6 py-2.5 text-left transition ${isMezzanine ? 'text-amber-400/70 cursor-default' : 'text-slate-200 hover:bg-amber-500/10 hover:text-amber-200'}`}
                    >
                      <Icon aria-hidden="true" className={`h-4 w-4 ${isMezzanine ? 'text-amber-400/70' : 'text-amber-400/70 group-hover:text-amber-300'}`} />
                      <span className="text-sm tracking-wide">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-6 py-3 border-t border-amber-500/30 flex items-center justify-between">
                <button
                  onClick={() => { setPauseMenu(false); setKeymapOpen(true); }}
                  className="text-sm text-slate-400 hover:text-amber-200 transition"
                >
                  Клавиши (?)
                </button>
                <button
                  onClick={() => setPauseMenu(false)}
                  className="text-sm text-slate-400 hover:text-amber-200 transition"
                >
                  Вернуться
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
