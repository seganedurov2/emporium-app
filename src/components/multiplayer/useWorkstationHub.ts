import { useEffect, useCallback, useRef, useState } from 'react';

export type HubMessage = {
  type: string;
  room?: string | null;
  payload?: unknown;
  id?: number;
  ts: number;
};

export interface UseWorkstationHubOptions {
  url?: string;
  room?: string;
  onMessage?: (msg: HubMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

export function useWorkstationHub({
  url = import.meta.env.VITE_WS_URL ?? null,
  room: initialRoom,
  onMessage,
  onConnect,
  onDisconnect,
  autoConnect = true
}: UseWorkstationHubOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<string | null>(initialRoom ?? null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
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
        reconnectRef.current = setTimeout(() => {
          connectRef.current?.();
        }, 2000);
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

  useEffect(() => {
    if (autoConnectRef.current && url) {
      connectRef.current?.();
    }
    return () => {
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
