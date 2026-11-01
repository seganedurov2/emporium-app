import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOCK_STYLES,
  addressOf,
  cityStats,
  demolish,
  generateCity,
  listBuildings,
  listStreets,
  placeBuilding,
  streetAt,
  tick,
  type BuildingKind,
  type CityState,
} from '../../cityBuilder';
import { CITY_PLAN_CHECKPOINT_MS, restoreCityPlan, serializeCityPlan, type CityPlanSave } from '../../cityPlanState';
import { CityRenderer } from './cityView';
import { CityScene3D } from './CityScene3D';

interface CityBuilderViewProps {
  citySeed?: number;
  savedPlan?: CityPlanSave | null;
  onPlanChange?: (plan: CityPlanSave | null) => void;
  onRequestNewCity?: (seed: number) => boolean;
  className?: string;
  peopleCount?: number;
}

const SPEEDS = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
  { value: 0, label: 'Пауза' },
];

const KINDS: BuildingKind[] = ['house', 'shop', 'office', 'factory', 'park'];

export function CityBuilderView({
  citySeed = 1101,
  savedPlan = null,
  onPlanChange,
  onRequestNewCity,
  className = '',
  peopleCount = 0,
}: CityBuilderViewProps) {
  const [restored] = useState(() => restoreCityPlan(savedPlan, citySeed));
  const [city, setCity] = useState<CityState>(() => restored.city);
  const [kind, setKind] = useState<BuildingKind>('house');
  const [bulldozer, setBulldozer] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.15);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // "3D" swaps the flat iso canvas for the three.js town; both drive the
  // same city state, so a build started in one view finishes in the other.
  const [mode, setMode] = useState<'2d' | '3d'>('3d');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderer = useMemo(() => new CityRenderer(), []);
  // Latest values read by the animation loop; synced in an effect, never during render.
  const liveRef = useRef({ city, zoom, panX: pan.x, panY: pan.y, speed, hover, selected, kind, showLabels });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const lastTime = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const planRef = useRef({ city, citySeed, onPlanChange });

  useEffect(() => {
    planRef.current = { city, citySeed, onPlanChange };
  }, [city, citySeed, onPlanChange]);

  const savePlan = useCallback((wasOpenAtSave: boolean, cityOverride?: CityState, seedOverride?: number) => {
    const current = planRef.current;
    current.onPlanChange?.(serializeCityPlan(
      cityOverride ?? current.city,
      seedOverride ?? current.citySeed,
      { savedAt: Date.now(), wasOpenAtSave },
    ));
  }, []);

  // Save the restored/caught-up plan immediately, then checkpoint mutable ticks
  // at a bounded cadence. The cleanup marks an in-app navigation-away as paused.
  useEffect(() => {
    savePlan(true);
    const checkpoint = window.setInterval(() => savePlan(true), CITY_PLAN_CHECKPOINT_MS);
    return () => {
      window.clearInterval(checkpoint);
      savePlan(false);
    };
  }, [savePlan]);

  const stats = cityStats(city);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 2200);
  }, []);

  useEffect(() => {
    liveRef.current = { city, zoom, panX: pan.x, panY: pan.y, speed, hover, selected, kind, showLabels };
  }, [city, zoom, pan, speed, hover, selected, kind, showLabels]);

  // Simulation + paint loop. Runs continuously so cranes/windows keep animating
  // even while paused; `tick` itself respects the speed. The 3D scene has its
  // own render loop, so only the simulation tick runs while it is visible.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || mode === '3d') return;

    const loop = (now: number) => {
      const live = liveRef.current;
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 1000, 0.25) : 0;
      lastTime.current = now;
      tick(live.city, dt, live.speed);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        renderer.render(ctx, live.city, {
          time: now,
          hover: live.hover,
          selected: live.selected,
          kind: live.kind,
          showLabels: live.showLabels,
          camera: { zoom: live.zoom, panX: live.panX, panY: live.panY },
          width: w,
          height: h,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderer, mode]);

  // Construction keeps advancing in 3D too — the scene only draws, it does not
  // simulate, so this small ticker is the single source of truth for progress.
  useEffect(() => {
    if (mode !== '3d') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      const live = liveRef.current;
      tick(live.city, dt, live.speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const toCell = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const wrap = wrapRef.current;
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      return renderer.pick(
        e.clientX - rect.left,
        e.clientY - rect.top,
        city,
        { zoom: liveRef.current.zoom, panX: liveRef.current.panX, panY: liveRef.current.panY },
        wrap.clientWidth,
        wrap.clientHeight,
      );
    },
    [city, renderer],
  );

  const act = useCallback(
    (x: number, y: number) => {
      if (bulldozer) {
        const ok = demolish(city, x, y);
        notify(ok ? `Снесено: ${addressOf(city, x, y).replace(/,? \d+$/, '') || 'участок'}` : 'Тут нечего сносить');
      } else {
        const cell = city.cells[y][x];
        if (cell.type === 'road') {
          notify(`Проезжая часть — ${cell.street}`);
          return;
        }
        const res = placeBuilding(city, x, y, kind);
        if (!res.ok) {
          notify(res.error ?? 'Нельзя строить');
        } else {
          notify(`${BLOCK_STYLES[kind].label} — ${res.building!.street}, ${res.building!.number}: стройка начата`);
        }
      }
      setCity({ ...city });
      setSelected({ x, y });
      savePlan(true, city);
    },
    [bulldozer, city, kind, notify, savePlan],
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (mode === '3d') return;
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.92 : 1.08), 0.45), 3.2));
  };

  const newCity = () => {
    const seed = Math.max(1, Date.now() % 100000);
    if (onRequestNewCity && !onRequestNewCity(seed)) return;
    const nextCity = generateCity(seed);
    setCity(nextCity);
    setSelected(null);
    setPan({ x: 0, y: 0 });
    setZoom(1.15);
    savePlan(true, nextCity, seed);
  };

  const fillDistrict = () => {
    // "Autoplay" a few plots around the selection so the town does not stay empty.
    const kinds: BuildingKind[] = ['house', 'house', 'shop', 'park', 'office'];
    let placed = 0;
    for (const block of city.blocks) {
      for (const lotId of block.lots) {
        if (placed >= 6) break;
        for (let y = 0; y < city.size; y++) {
          for (let x = 0; x < city.size; x++) {
            const c = city.cells[y][x];
            if (c.type === 'lot' && c.lot === lotId && !c.building) {
              placeBuilding(city, x, y, kinds[placed % kinds.length]);
              placed++;
            }
          }
        }
      }
    }
    setCity({ ...city });
    savePlan(true, city);
    notify(placed ? `Начато строительство: ${placed}` : 'Свободных участков нет');
  };

  const selectedInfo = selected ? describeCell(city, selected.x, selected.y) : null;
  const streets = listStreets(city);
  const underConstruction = listBuildings(city).filter(b => b.building.progress < 1);

  return (
    <div className={`relative w-full h-full min-h-[640px] ${className}`}>
      <div
        ref={wrapRef}
        className="absolute inset-0 overflow-hidden bg-[#2f5d3a]"
        onPointerDown={e => {
          // In 3D the scene owns pan/orbit and picking; the wrapper stays inert.
          if (mode === '3d') return;
          if ((e.target as HTMLElement).closest('button,input,label,a')) return;
          dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const d = dragRef.current;
          if (!d) {
            if (mode === '2d') setHover(toCell(e));
            return;
          }
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (d.moved) setPan({ x: d.panX + dx, y: d.panY + dy });
        }}
        onPointerUp={e => {
          const d = dragRef.current;
          dragRef.current = null;
          if (!d || d.moved) return;
          const cell = toCell(e);
          if (cell) act(cell.x, cell.y);
        }}
        onPointerLeave={() => {
          setHover(null);
          dragRef.current = null;
        }}
        onWheel={onWheel}
        style={{ cursor: mode === '3d' ? (bulldozer ? 'cell' : 'default') : bulldozer ? 'cell' : 'crosshair' }}
      >
        {mode === '3d' ? (
          <CityScene3D
            city={city}
            hover={hover}
            selected={selected}
            showLabels={showLabels}
            bulldozer={bulldozer}
            peopleCount={peopleCount}
            onHover={setHover}
            onPick={(cell) => act(cell.x, cell.y)}
          />
        ) : (
          <canvas ref={canvasRef} className="block w-full h-full touch-none select-none" />
        )}
      </div>

      {/* Top-left: city stats */}
      <div className="absolute top-3 left-3 z-10 bg-black/75 backdrop-blur border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-white shadow-lg pointer-events-none">
        <div className="font-bold text-amber-300 text-sm mb-1">Городской план</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-slate-400">Население</span>
          <span className="font-mono text-right">{stats.population}</span>
          <span className="text-slate-400">Рабочих мест</span>
          <span className="font-mono text-right">{stats.jobs}</span>
          <span className="text-slate-400">Домов</span>
          <span className="font-mono text-right">{stats.built}</span>
          <span className="text-slate-400">Стройка</span>
          <span className="font-mono text-right text-emerald-400">{stats.building}</span>
          <span className="text-slate-400">Улиц</span>
          <span className="font-mono text-right">{streets.length}</span>
        </div>
      </div>

      {/* Top-right: palette + tools */}
      <div className="absolute top-3 right-3 z-10 w-64 bg-black/75 backdrop-blur border border-amber-500/30 rounded-xl p-3 text-xs text-white shadow-lg space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-amber-300">Строительство</div>
          <div className="flex rounded border border-slate-700 overflow-hidden">
            {(['3d', '2d'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                title={m === '3d' ? 'Объёмный план города' : 'Изометрическая карта'}
                className={`px-2 py-0.5 text-[10px] font-bold ${mode === m ? 'bg-amber-500 text-slate-950' : 'bg-slate-900/70 text-slate-300'}`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {KINDS.map(k => (
            <button
              key={k}
              onClick={() => { setKind(k); setBulldozer(false); }}
              className={`rounded-lg px-2 py-1.5 text-left border transition ${!bulldozer && kind === k
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                  : 'bg-slate-900/70 border-slate-700 hover:border-amber-400'
                }`}
            >
              <div className="truncate">{BLOCK_STYLES[k].label}</div>
              <div className="text-[10px] opacity-70">{BLOCK_STYLES[k].buildSeconds} с</div>
            </button>
          ))}
          <button
            onClick={() => setBulldozer(b => !b)}
            className={`rounded-lg px-2 py-1.5 border transition ${bulldozer ? 'bg-red-600 border-red-400 font-bold' : 'bg-slate-900/70 border-slate-700 hover:border-red-400'
              }`}
          >
            Снести
          </button>
        </div>

        <div className="flex items-center gap-1 pt-1">
          {SPEEDS.map(s => (
            <button
              key={s.value}
              onClick={() => setSpeed(s.value)}
              className={`flex-1 rounded px-1 py-1 border text-[11px] ${speed === s.value ? 'bg-emerald-600 border-emerald-400 font-bold' : 'bg-slate-900/70 border-slate-700'
                }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
          Названия улиц
        </label>

        <div className="flex gap-1">
          <button onClick={fillDistrict} className="flex-1 rounded bg-blue-600/80 hover:bg-blue-600 px-2 py-1">Застройка</button>
          <button onClick={newCity} className="flex-1 rounded bg-amber-600/80 hover:bg-amber-600 px-2 py-1">Новый город</button>
        </div>
        <div className="text-[10px] text-slate-400 leading-snug">
          {mode === '3d'
            ? 'Клик — строить, перетаскивание — поворот, колесо — масштаб'
            : 'Клик — строить, перетаскивание — сдвиг, колесо — масштаб'}
        </div>
      </div>

      {/* Bottom-left: selected lot / street */}
      <div className="absolute bottom-3 left-3 z-10 max-w-xs bg-black/75 backdrop-blur border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-white shadow-lg pointer-events-none">
        {hover && city.cells[hover.y][hover.x].type === 'road' ? (
          <>
            <div className="text-[10px] uppercase text-slate-400">Улица</div>
            <div className="text-amber-300 font-bold">{streetAt(city, hover.x, hover.y)}</div>
          </>
        ) : selectedInfo ? (
          <>
            <div className="text-[10px] uppercase text-slate-400">{selectedInfo.type}</div>
            <div className="font-bold text-amber-300">{selectedInfo.title}</div>
            {selectedInfo.detail && <div className="text-slate-300 mt-0.5">{selectedInfo.detail}</div>}
            {selectedInfo.progress !== undefined && selectedInfo.progress < 1 && (
              <div className="mt-1.5 h-1.5 bg-slate-800 rounded overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${selectedInfo.progress * 100}%` }} />
              </div>
            )}
          </>
        ) : (
          <div className="text-slate-400">Наведите на участок, чтобы увидеть адрес</div>
        )}
      </div>

      {/* Bottom-right: streets index */}
      <div className="absolute bottom-3 right-3 z-10 w-64 max-h-64 overflow-y-auto bg-black/75 backdrop-blur border border-amber-500/30 rounded-xl p-3 text-xs text-white shadow-lg">
        <div className="font-bold text-amber-300 mb-1">Улицы города</div>
        <ul className="space-y-0.5">
          {streets.map(st => (
            <li key={st.name} className="flex justify-between gap-2">
              <span className="truncate">{st.name}</span>
              <span className="text-slate-500">{st.horizontal ? 'гор.' : 'верт.'}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400">
          {underConstruction.length > 0
            ? `Строится: ${underConstruction.length}`
            : 'Все стройки завершены'}
        </div>
      </div>

      {toast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-slate-950/90 border border-amber-500/50 text-amber-200 px-4 py-2 rounded-lg text-sm shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}

function describeCell(city: CityState, x: number, y: number) {
  const cell = city.cells[y]?.[x];
  if (!cell) return null;
  if (cell.type === 'road') return { type: 'Улица', title: cell.street };
  if (cell.type === 'lot') {
    if (!cell.building) return { type: 'Свободный участок', title: addressOf(city, x, y) };
    const b = cell.building;
    const style = BLOCK_STYLES[b.kind];
    if (b.progress < 1) {
      return {
        type: 'Стройка',
        title: `${style.label} — ${b.street}, ${b.number}`,
        detail: `${Math.round(b.progress * 100)}%`,
        progress: b.progress,
      };
    }
    return {
      type: style.label,
      title: `${b.street}, ${b.number}`,
      detail: b.residents ? `жителей: ${b.residents}` : b.jobs ? `рабочих мест: ${b.jobs}` : '',
      progress: b.progress,
    };
  }
  return { type: 'Пусто', title: '—' };
}
