import { useState, useEffect, useRef } from 'react';
import { useWorkstationHub } from './useWorkstationHub';
import { Wifi, WifiOff, Users } from 'lucide-react';

export function MultiplayerPanel({ gameState, setGameState }: { gameState: any; setGameState: any }) {
  const [localRoom, setLocalRoom] = useState('default');
  const {
    connected,
    send,
    join,
    leave,
    disconnect,
    lastMessage,
    room
  } = useWorkstationHub({
    room: localRoom,
    onMessage: (msg) => {
      if (msg.type === 'state_sync' && msg.payload) {
        const payload = msg.payload as { gameState?: unknown; version?: number; updatedBy?: string };
        if (payload.gameState && payload.updatedBy) {
          setGameState((prev: any) => {
            const remoteWeek = (payload.gameState as any)?.week ?? 0;
            const localWeek = prev?.week ?? 0;
            if (remoteWeek > localWeek) {
              return { ...prev, ...payload.gameState };
            }
            return prev;
          });
        }
      }
    }
  });

  const syncState = useCallback(() => {
    if (!connected) return;
    send({
      type: 'state_update',
      room: localRoom,
      payload: gameState
    });
  }, [connected, send, localRoom, gameState]);

  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!connected) return;
    const tick = () => {
      if (!connected) return;
      send({
        type: 'state_update',
        room: localRoom,
        payload: gameState
      });
      syncRef.current = setTimeout(tick, 3000);
    };
    syncRef.current = setTimeout(tick, 3000);
    return () => {
      if (syncRef.current) clearTimeout(syncRef.current);
    };
  }, [connected, send, localRoom, gameState]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
          <span className="font-bold text-white text-sm">
            {connected ? 'Мультиплеер подключён' : 'Мультиплеер отключён'}
          </span>
        </div>
        <div className="text-xs font-mono text-slate-400">
          {room ?? '—'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400 uppercase mb-1">Комната</div>
          <div className="flex items-center gap-2">
            <input
              value={localRoom}
              onChange={(e) => setLocalRoom(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={() => (connected ? leave() : join(localRoom))}
              className="px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white transition"
            >
              {connected ? 'Покинуть' : 'Присоединиться'}
            </button>
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400 uppercase mb-1">Синхронизация</div>
          <button
            onClick={syncState}
            disabled={!connected}
            className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs text-white font-semibold transition"
          >
            Отправить состояние
          </button>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400 uppercase mb-1">Последний пакет</div>
          <div className="text-xs text-slate-300 font-mono">
            {lastMessage?.type ?? '—'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
        <Users className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-400">Раздельная сессия через WebSocket</span>
        <button
          onClick={disconnect}
          className="ml-auto text-xs text-red-400 hover:text-red-300 transition"
        >
          Отключиться
        </button>
      </div>
    </div>
  );
}
