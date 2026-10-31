import { useState } from 'react';

import kalinkovichiMap from '../../../Kalinkovichi_map.svg';

export interface MapCenter {
  lat: number;
  lon: number;
}

interface KalinkovichiMapProps {
  defaultLat?: number;
  defaultLon?: number;
  onPick?: (center: MapCenter) => void;
  onOpen3d?: (center: MapCenter) => void;
}

// The SVG uses the same projection family as the site's city map, so a point
// picked on the image can be translated into degrees around the city centre.
// viewBox is 850.394 x 724.689 (see Kalinkovichi_map.svg).
const SRC_W = 850.394;
const SRC_H = 724.689;
const KM_PER_SRC_PX = 0.007;
const KM_PER_DEG_LAT = 111.32;

export function KalinkovichiMap({
  defaultLat = 52.128814,
  defaultLon = 29.332527,
  onPick,
  onOpen3d
}: KalinkovichiMapProps) {
  const [coords, setCoords] = useState({ lat: defaultLat, lon: defaultLon });

  const pickPoint = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SRC_W;
    const y = ((e.clientY - rect.top) / rect.height) * SRC_H;
    const eastKm = (x - SRC_W / 2) * KM_PER_SRC_PX;
    const northKm = (SRC_H / 2 - y) * KM_PER_SRC_PX;
    const next = {
      lat: Number((defaultLat + northKm / KM_PER_DEG_LAT).toFixed(6)),
      lon: Number(
        (
          defaultLon +
          eastKm / (KM_PER_DEG_LAT * Math.cos((defaultLat * Math.PI) / 180))
        ).toFixed(6)
      )
    };
    setCoords(next);
    onPick?.(next);
  };

  const downloadJson = () => {
    const data = {
      centerLat: coords.lat,
      centerLon: coords.lon,
      zoom: 16,
      mapSize: 2048,
      tileSize: 256,
      source: 'kalinkovichi_map',
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kalinkovichi-coordinates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-left shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-white font-bold">Карта Калинковичей</h3>
        <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
          Источник: Kalinkovichi_map.svg
        </span>
      </div>
      <div className="w-full max-w-[900px] h-[560px] rounded-lg bg-slate-800 mb-4 flex items-center justify-center overflow-hidden border border-slate-700">
        <img
          src={kalinkovichiMap}
          alt="Карта Калинковичей"
          onClick={pickPoint}
          className="max-w-full max-h-full block object-contain cursor-crosshair"
          title="Кликните по карте, чтобы выбрать точку"
        />
      </div>
      <div className="flex items-center gap-3 text-sm mb-4">
        <span className="text-slate-400">Широта:</span>
        <span className="text-white font-mono font-bold">{coords.lat}</span>
        <span className="text-slate-400 mx-2">Долгота:</span>
        <span className="text-white font-mono font-bold">{coords.lon}</span>
      </div>
      <button
        onClick={downloadJson}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-4 rounded-lg transition"
      >
        Сохранить kalinkovichi-coordinates.json
      </button>
      {onOpen3d && (
        <button
          onClick={() => onOpen3d(coords)}
          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg transition"
        >
          Открыть 3D-карту с этой точки
        </button>
      )}
      <p className="text-xs text-slate-500 mt-2">
        Файл будет прочитан генератором террейна при следующем запуске. Клик по
        карте переносит точку старта.
      </p>
    </div>
  );
}
