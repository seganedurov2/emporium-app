// Gesture system for 3D controls (tap/drag/swipe)
import { useCallback, useRef } from 'react';

export interface GestureState {
  isDragging: boolean;
  isTouching: boolean;
  lastTouchPos: { x: number; y: number } | null;
  lastMousePos: { x: number; y: number } | null;
  tapCount: number;
  lastTapTime: number;
}

export interface GestureHandlers {
  onPointerDown: (event: any) => void;
  onPointerMove: (event: any) => void;
  onPointerUp: (event: any) => void;
  onTouchStart: (event: any) => void;
  onTouchMove: (event: any) => void;
  onTouchEnd: (event: any) => void;
}

export function useGestureHandlers(
  onRotate?: (deltaX: number, deltaY: number) => void,
  _onZoom?: (delta: number) => void,
  onPan?: (deltaX: number, deltaY: number) => void,
  onTap?: () => void
): GestureHandlers {
  const gestureState = useRef<GestureState>({
    isDragging: false,
    isTouching: false,
    lastTouchPos: null,
    lastMousePos: null,
    tapCount: 0,
    lastTapTime: 0
  });

  const handlePointerDown = useCallback((event: any) => {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX || event.touches?.[0]?.clientX) - rect.left) / rect.width * 2 - 1;
    const y = -((event.clientY || event.touches?.[0]?.clientY) - rect.top) / rect.height * 2 + 1;

    if (event.isTouchEvent || event.type === 'touchstart') {
      gestureState.current.isTouching = true;
      gestureState.current.lastTouchPos = { x: x, y: y };
    } else {
      gestureState.current.isDragging = true;
      gestureState.current.lastMousePos = { x: x, y: y };
    }

    gestureState.current.lastTapTime = Date.now();
    gestureState.current.tapCount++;
  }, []);

  const handlePointerMove = useCallback((event: any) => {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX || event.touches?.[0]?.clientX) - rect.left) / rect.width * 2 - 1;
    const y = -((event.clientY || event.touches?.[0]?.clientY) - rect.top) / rect.height * 2 + 1;

    if (gestureState.current.isDragging && gestureState.current.lastMousePos) {
      const deltaX = x - gestureState.current.lastMousePos.x;
      const deltaY = y - gestureState.current.lastMousePos.y;
      
      if (onRotate) onRotate(deltaX, deltaY);
      if (onPan) onPan(deltaX * 0.5, deltaY * 0.5);
      
      gestureState.current.lastMousePos = { x, y };
    }

    if (gestureState.current.isTouching && gestureState.current.lastTouchPos) {
      const deltaX = x - gestureState.current.lastTouchPos.x;
      const deltaY = y - gestureState.current.lastTouchPos.y;
      
      if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
        if (onRotate) onRotate(deltaX * 2, deltaY * 2);
        if (onPan) onPan(deltaX * 0.5, deltaY * 0.5);
      }
      
      gestureState.current.lastTouchPos = { x, y };
    }
  }, [onRotate, onPan]);

  const handlePointerUp = useCallback(() => {
    gestureState.current.isDragging = false;
    gestureState.current.isTouching = false;
    
    const now = Date.now();
    if (now - gestureState.current.lastTapTime < 300 && gestureState.current.tapCount === 1) {
      if (onTap) onTap();
    }
  }, [onTap]);

  const handleTouchStart = handlePointerDown;
  const handleTouchMove = handlePointerMove;
  const handleTouchEnd = handlePointerUp;

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
}