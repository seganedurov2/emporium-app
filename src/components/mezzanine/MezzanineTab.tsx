import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    (window as any).__gameKeys = keys;
    return () => {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = grid.length;
    const dpr = window.devicePixelRatio || 1;
    const tile = gridSize;
    const w = Math.max(canvas.parentElement?.clientWidth || 600, size * tile * 2 + 100);
    const h = Math.max(canvas.parentElement?.clientHeight || 600, size * tile + 100);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const ox = w / 2 + offsetRef.current.x;
    const oy = h / 3 + offsetRef.current.y;

    // Only the visible part of a big map is drawn (0.3.7): a 64x64 region at
    // tile 48 is 8k x 4k px, and filling that every frame made the second
    // click on the hub show a blank canvas for seconds. The rest is clipped.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    // city view: render a focused small map around the selected city
    if (cityView && selectedCity) {
      const cityTile = gridSize;
      const region = REGIONS.find(r => r.id === selectedRegion);
      const refLon = region?.lon || selectedCity.lon;
      const refLat = region?.lat || selectedCity.lat;
      const rect = cityVisibleRect(size, selectedCity.lon, selectedCity.lat, refLon, refLat, cityTile);
      const { startX, endX, startY, endY, centerX: cx, centerY: cy } = rect;

      // draw visible city grid
      ctx.strokeStyle = 'rgba(174, 170, 65, 0.25)';
      ctx.lineWidth = 1;
      for (let y = startY; y <= endY; y++) {
        ctx.beginPath();
        ctx.moveTo(ox - (endX - startX) * cityTile / 2, oy + (y - startY) * cityTile / 4);
        ctx.lineTo(ox + (endX - startX) * cityTile / 2, oy - (y - startY) * cityTile / 4);
        ctx.stroke();
      }
      for (let x = startX; x <= endX; x++) {
        ctx.beginPath();
        ctx.moveTo(ox - (endX - startX) * cityTile / 2 + (x - startX) * cityTile / 2, oy + (x - startX) * cityTile / 4);
        ctx.lineTo(ox + (endX - startX) * cityTile / 2 - (x - startX) * cityTile / 2, oy - (x - startX) * cityTile / 4);
        ctx.stroke();
      }

      // Cull the corner tiles that cannot land inside the visible canvas.
      const halfSpanX = (endX - startX) * cityTile / 4;
      const halfSpanY = (endY - startY) * cityTile / 8;
      for (let y = startY; y < endY; y++) {
        const rowOffset = (y - cy) * cityTile / 4;
        if (oy + rowOffset + halfSpanY < 0) continue;
        if (oy + rowOffset - halfSpanY > h) break;
        for (let x = startX; x < endX; x++) {
          const dx = (x - cx) * cityTile / 2;
          if (ox + dx + halfSpanX < 0) continue;
          if (ox + dx - halfSpanX > w) break;
          drawBlock(ctx, ox + dx, oy + rowOffset, cityTile, grid[y][x], x * 7919 + y);
        }
      }
    } else {
      // draw a subtle ground plane grid
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y <= size; y++) {
        ctx.beginPath();
        ctx.moveTo(ox - size * tile / 2, oy + y * tile / 4);
        ctx.lineTo(ox + size * tile / 2, oy - y * tile / 4);
        ctx.stroke();
      }
      for (let x = 0; x <= size; x++) {
        ctx.beginPath();
        ctx.moveTo(ox - size * tile / 2 + x * tile / 2, oy + x * tile / 4);
        ctx.lineTo(ox + size * tile / 2 - x * tile / 2, oy - x * tile / 4);
        ctx.stroke();
      }

      // draw blocks back-to-front, skipping rows/columns outside the viewport
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const cx = (x - y) * tile / 2 + ox;
          const cy = (x + y) * tile / 4 + oy;
          if (cx + tile < 0 || cx - tile > w) continue;
          if (cy + tile < 0 || cy - tile > h) continue;
          drawBlock(ctx, cx, cy, tile, grid[y][x], x * 7919 + y);
        }
      }
    }

    ctx.restore();
  }, [cityView, grid, gridSize, offset, selectedCity, selectedRegion]);

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
      <div className="relative w-full h-screen overflow-hidden">
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
      <div className="relative w-full h-[calc(100vh-8rem)] min-h-[640px] overflow-hidden rounded-xl border border-slate-800">
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
    <div className="relative w-full h-screen bg-[#1a4d2e] overflow-hidden" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {grid && (
        <div className="absolute inset-0 flex items-center justify-center">
          <canvas ref={canvasRef} className="block cursor-grab active:cursor-grabbing" />
          <div className="absolute top-12 right-4 z-20 flex flex-col items-center gap-2 pointer-events-none">
            <div className="bg-black/70 border border-amber-500/30 rounded-lg px-3 py-2 text-xs font-bold text-amber-300 shadow-lg">С</div>
            <div className="flex items-center gap-1">
              <div className="bg-black/70 border border-amber-500/30 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 shadow-lg">З</div>
              <div className="bg-black/70 border border-amber-500/30 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 shadow-lg">В</div>
            </div>
            <div className="bg-black/70 border border-amber-500/30 rounded-lg px-3 py-2 text-xs font-bold text-amber-300 shadow-lg">Ю</div>
          </div>
          {cityView && selectedCity && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/90 text-white px-6 py-3 rounded-full z-20 border border-amber-500 shadow-lg">
              <div className="flex items-center gap-3">
                <button onClick={backToRegion} className="text-xs text-amber-400 hover:text-amber-300 underline">Назад к области</button>
                <div className="bg-amber-600/60 px-3 py-1 rounded text-xs font-bold border border-amber-400/30">
                  {selectedCity.name}
                </div>
                <div className="text-xs text-gray-400">({selectedCity.lat.toFixed(4)}, {selectedCity.lon.toFixed(4)})</div>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Малая карта города · пиксель-арт</div>
            </div>
          )}
        </div>
      )}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-3 rounded-lg text-sm z-10 pointer-events-none">
        <div className="font-bold">{t(lang, 'topDown')}</div>
        <div className="text-xs text-gray-400 mt-1">Pixel art · LPM перетаскивать · колёсико зум · ? — клавиши</div>
      </div>
      {selectedRegion && (
        <div className="absolute top-24 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm z-10 border border-amber-500/30">
          <div className="font-bold text-amber-400">{REGIONS.find(r => r.id === selectedRegion)?.name}</div>
          <div className="text-xs text-gray-400 mt-1">Область Беларуси</div>
        </div>
      )}
      <div className="absolute top-4 right-80 w-64 bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 z-10 flex flex-col gap-2 shadow-lg">
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
      <div className="absolute top-4 right-4 w-64 bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 z-10 flex flex-col gap-2 shadow-lg">
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
        <div className="absolute top-4 right-4 w-72 bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 z-10 mt-[calc(4rem+14px)] flex flex-col gap-2 shadow-lg">
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
      <div className="absolute top-24 right-[340px] w-32 bg-black/70 backdrop-blur border border-amber-500/30 rounded-xl p-3 z-10 flex items-center justify-center gap-2 shadow-lg">
        <button onClick={() => setView(prev => ({ ...prev, gridSize: clampTile(prev.gridSize - 8, prev.gridSize) }))} className="bg-black/70 text-white px-3 py-1 rounded">−</button>
        <button onClick={() => setView(prev => ({ ...prev, gridSize: clampTile(prev.gridSize + 8, prev.gridSize) }))} className="bg-black/70 text-white px-3 py-1 rounded">+</button>
      </div>
      <button onClick={() => setGrid(gen.generate(Date.now()))} className="absolute bottom-4 left-4 bg-amber-600/80 text-white px-4 py-2 rounded z-10">Новая карта</button>
      <button onClick={loadKalinkovichi} className="absolute bottom-4 left-36 bg-blue-600/80 text-white px-4 py-2 rounded z-10">Калинковичи</button>
      <button
        onClick={() => setView(prev => ({ ...prev, citySeed: selectedCity?.seed ?? 1101, viewMode: 'city_plan' }))}
        className="absolute bottom-4 left-[344px] bg-fuchsia-600/80 hover:bg-fuchsia-600 text-white px-4 py-2 rounded z-10"
        title="План города: улицы, адреса, стройка домов"
      >
        Стройка города
      </button>
      <button
        onClick={() => { setMapCenter(centerPick); setView(prev => ({ ...prev, viewMode: '3d' })); }}
        className="absolute bottom-4 left-64 bg-emerald-600/80 hover:bg-emerald-600 text-white px-4 py-2 rounded z-10"
        title="Трёхмерная карта Калинковичей"
      >
        3D-карта
      </button>
      <button
        onClick={() => setKeymapOpen(open => !open)}
        className="absolute bottom-4 left-[452px] bg-slate-700/85 hover:bg-slate-700 text-white px-3 py-2 rounded z-10 text-xs"
        title="Горячие клавиши (?)"
      >
        ?
      </button>
      <div className="absolute bottom-20 left-4 w-[340px] z-10">
        <KalinkovichiMap
          onPick={setCenterPick}
          onOpen3d={(c: MapCenter) => { setMapCenter(c); setView(prev => ({ ...prev, viewMode: '3d' })); }}
        />
      </div>
      <label className="absolute bottom-4 right-4 bg-blue-600/80 text-white px-4 py-2 rounded cursor-pointer z-10">
        Загрузить heightmap
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) loadMap(f); }} />
      </label>

      {/* Hub links: every campaign section is one click away from the map. */}
      {onOpenTab && (
        <div className="absolute top-40 left-4 z-20 w-64">
          <button
            onClick={() => setSectionsOpen(o => !o)}
            aria-expanded={sectionsOpen}
            className="w-full bg-black/80 hover:bg-black text-amber-300 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-bold text-left"
          >
            {sectionsOpen ? 'Свернуть разделы' : `Разделы игры (${APP_NAVIGATION.length})`}
          </button>
          {sectionsOpen && (
            <div className="mt-1 max-h-[45vh] overflow-y-auto bg-black/85 backdrop-blur border border-amber-500/30 rounded-lg p-1 flex flex-col gap-0.5">
              {APP_NAVIGATION.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onOpenTab(tab.id)}
                    disabled={tab.id === 'mezzanine'}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${tab.id === 'mezzanine' ? 'text-amber-300 bg-amber-500/10 cursor-default' : 'text-slate-300 hover:bg-slate-700/80 hover:text-white'}`}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
