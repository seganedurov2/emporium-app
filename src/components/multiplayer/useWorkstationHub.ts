import { useEffect, useCallback, useRef, useState } from 'react';
import { MULTIPLAYER_HUB_URL, probeHub } from '../../multiplayerConfig';

export type HubMessage = {
  type: string;
  room?: string | null;
  payload?: unknown;
  id?: number;
  ts: number;
};

export interface UseWorkstationHubOptions {
  /** Hub address; null keeps multiplayer off. */
  url?: string | null;
  room?: string;
  onMessage?: (msg: HubMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

export function useWorkstationHub({
  // Resolved once in multiplayerConfig: no hub is dialled at all in a deployed
  // build without VITE_WS_URL, which used to spam WebSocket errors every 2 s.
  url = MULTIPLAYER_HUB_URL,
  room: initialRoom,
  onMessage,
  onConnect,
  onDisconnect,
  autoConnect = true
}: UseWorkstationHubOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<string | null>(initialRoom ?? null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const connectRef = useRef<(() => void) | null>(null);
  const autoConnectRef = useRef(autoConnect);
  const onMessageRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<HubMessage | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(initialRoom ?? null);

  // Keep refs in sync with props without mutating during render
  useEffect(() => {
    autoConnectRef.current = autoConnect;
    onMessageRef.current = onMessage;
  }, [autoConnect, onMessage]);

  const send = useCallback((msg: { type: string; room?: string; payload?: unknown; id?: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const join = useCallback((targetRoom: string) => {
    roomRef.current = targetRoom;
    setActiveRoom(targetRoom);
    send({ type: 'join', room: targetRoom });
  }, [send]);

  const leave = useCallback(() => {
    send({ type: 'leave' });
    roomRef.current = null;
    setActiveRoom(null);
  }, [send]);

  const connectImpl = useCallback(() => {
    if (!url) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    attemptsRef.current += 1;
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      attemptsRef.current = 0;
      setConnected(true);
      if (roomRef.current) {
        send({ type: 'join', room: roomRef.current });
      }
      onConnect?.();
    };

    wsRef.current.onmessage = (event) => {
      try {
        const msg: HubMessage = JSON.parse(event.data);
        setLastMessage(msg);
        onMessageRef.current?.(msg);
      } catch {
        console.error('Failed to parse WebSocket message:', event.data);
      }
    };

    wsRef.current.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      onDisconnect?.();
      if (url && autoConnectRef.current) {
        // Back off while the hub is down (2 s, 4 s, 8 s … 30 s) so an optional
        // service that is not running does not flood the console.
        const delay = Math.min(30000, 2000 * 2 ** Math.max(0, attemptsRef.current - 1));
        reconnectRef.current = setTimeout(() => {
          connectRef.current?.();
        }, delay);
      }
    };

    wsRef.current.onerror = () => {
      setConnected(false);
    };
  }, [url, send, onConnect, onDisconnect]);

  useEffect(() => {
    connectRef.current = connectImpl;
  }, [connectImpl]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    wsRef.current?.close();
    setConnected(false);
  }, []);

  // Probe first: a dev page may be up while the optional hub is not, and dialling
  // a dead port shows a browser WebSocket error before any code can react.
  useEffect(() => {
    if (!autoConnectRef.current || !url) return undefined;
    let cancelled = false;
    void probeHub(url).then(ok => {
      if (!cancelled && ok) connectRef.current?.();
    });
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [connectRef, disconnect, url]);

  return {
    connected,
    send,
    join,
    leave,
    disconnect,
    lastMessage,
    room: activeRoom
  };
}
