import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import { KalinkovichiMap } from './KalinkovichiMap';
import { KalinkovichiCamera } from './KalinkovichiCamera';
import { Player } from './Player';
import { FileUpload } from '../ui/FileUpload';
import { imageToMap } from '../../utils/imageToMap';

export interface MapCenter {
  lat: number;
  lon: number;
}

interface KalinkovichiGameProps {
  className?: string;
  onExit?: () => void;
  /** Start point of the fly-to, defaulting to the city centre. */
  initialCenter?: MapCenter;
}

export function KalinkovichiGame({ className = '', onExit, initialCenter }: KalinkovichiGameProps) {
  const [heightmap, setHeightmap] = useState<number[][] | null>(null);
  const [mapStatus, setMapStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(50);
  // Pan offset of the orthographic camera in world units (x = east, y = north).
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Distance travelled with WASD, applied to the map so the player stays centred.
  const [walk, setWalk] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'PageUp') { e.preventDefault(); setZoom(z => Math.min(z + 15, 400)); }
      if (e.code === 'PageDown') { e.preventDefault(); setZoom(z => Math.max(z - 15, 10)); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    (window as any).__gameKeys = keys;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const speed = 30 / Math.max(zoom, 10) * 10; // world units per second
      let dx = 0;
      let dy = 0;
      if (keys['KeyW'] || keys['ArrowUp']) dy -= speed * dt;
      if (keys['KeyS'] || keys['ArrowDown']) dy += speed * dt;
      if (keys['KeyA'] || keys['ArrowLeft']) dx -= speed * dt;
      if (keys['KeyD'] || keys['ArrowRight']) dx += speed * dt;
      if (dx !== 0 || dy !== 0) {
        setWalk(w => ({ x: w.x + dx, y: w.y + dy }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(Math.max(z + e.deltaY * 0.05, 10), 400));
    };
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [zoom]);

  const zoomIn = () => setZoom(z => Math.min(z + 15, 400));
  const zoomOut = () => setZoom(z => Math.max(z - 15, 10));
  const panBy = (dx: number, dy: number) =>
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  // screen pixels -> world units for the draggable map
  const pxToWorld = (px: number) => px * (100 / Math.max(zoom, 10)) * 0.4;

  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({
      x: d.px - pxToWorld(e.clientX - d.x),
      y: d.py - pxToWorld(e.clientY - d.y),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Kalinkovichi centre (city-kalinkovichi-496475615), roughly 3.0 km per 100 world units.
  const CITY_LAT = initialCenter?.lat ?? 52.1288;
  const CITY_LON = initialCenter?.lon ?? 29.3325;
  const KM_PER_UNIT = 0.03;
  const gpsLat = CITY_LAT - (pan.y + walk.y) * KM_PER_UNIT / 111.32;
  const gpsLon =
    CITY_LON +
    ((pan.x + walk.x) * KM_PER_UNIT) /
      (111.32 * Math.cos((CITY_LAT * Math.PI) / 180));
  const gps = `${gpsLat.toFixed(5)},${gpsLon.toFixed(5)}`;

  const loadHeightmap = async (f: File) => {
    setMapStatus('Генерирую карту высот...');
    try {
      const g = await imageToMap(f, 64);
      setHeightmap(g);
      setMapStatus(`Карта высот готова: ${g.length}x${g[0].length}`);
    } catch {
      setHeightmap(null);
      setMapStatus('Не удалось загрузить карту высот.');
    }
  };

  return (
    <div className={`relative w-full h-screen ${className}`} style={{ background: '#1a4d2e' }}>
      <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded text-xs z-10 max-w-[50%]">
        {mapStatus || 'Загрузите изображение — станет картой высот террейна'}
      </div>
      <div className="absolute bottom-4 right-4 w-64 z-10">
        <FileUpload
          accept="image/*"
          label={heightmap ? 'Карта высот загружена' : 'Загрузить карту высот'}
          onFile={loadHeightmap}
        />
      </div>
      <Canvas shadows={false}>
        <Suspense fallback={null}>
          <KalinkovichiCamera
            position={[0, 25, 0]}
            target={[pan.x + walk.x, 0, pan.y + walk.y]}
            zoom={zoom}
          />
          <group position={[-walk.x, 0, -walk.y]}>
            <KalinkovichiMap scale={1} heightmap={heightmap} />
          </group>
          <Player position={[0, 0, 0]} speed={0.15} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[20, 30, 10]} intensity={0.9} castShadow={false} />
        </Suspense>
      </Canvas>

      {/* Drag-to-pan surface; sits above the canvas, below the controls. */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className="bg-black/70 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-black/90 active:scale-95 transition"
          title="Увеличить"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="bg-black/70 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-black/90 active:scale-95 transition"
          title="Уменьшить"
        >
          −
        </button>
        <div className="mt-2 flex flex-col gap-1">
          <button
            onClick={() => panBy(0, -10)}
            className="bg-black/70 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-black/90 active:scale-95 transition"
            title="Сдвинуть на север"
          >
            ↑
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => panBy(-10, 0)}
              className="flex-1 bg-black/70 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-black/90 active:scale-95 transition"
              title="Сдвинуть на запад"
            >
              ←
            </button>
            <button
              onClick={() => panBy(10, 0)}
              className="flex-1 bg-black/70 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-black/90 active:scale-95 transition"
              title="Сдвинуть на восток"
            >
              →
            </button>
          </div>
          <button
            onClick={() => panBy(0, 10)}
            className="bg-black/70 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-black/90 active:scale-95 transition"
            title="Сдвинуть на юг"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-3 rounded-lg text-sm max-w-xs z-10 pointer-events-none">
        <div className="font-bold mb-1">Калинковичи</div>
        <div className="text-xs text-gray-300">Республика Беларусь</div>
        <div className="text-xs mt-1 font-mono text-amber-300">GPS: {gps}</div>
        <div className="text-xs mt-2 text-gray-400">
          WASD - движение, перетаскивание / стрелки - сдвиг, колесо мыши - масштаб, PageUp/PageDown - масштаб
        </div>
      </div>

      {onExit && (
        <button
          onClick={onExit}
          className="absolute top-4 right-24 bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded z-10"
        >
          Выход
        </button>
      )}
    </div>
  );
}
