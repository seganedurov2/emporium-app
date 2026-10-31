import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Orthographic top-down camera for the city map.
 *
 * `zoom` is world units per half-height: the default 50 on a 100-unit map sat
 * right on top of the terrain and showed three tiles, so it is mapped through
 * a range that frames the whole map (≈14) up to a street-level crop (≈90).
 */
export function KalinkovichiCamera({ position = [0, 40, 0], target = [0, 0, 0], zoom = 50 }: any) {
  const cameraRef = useRef<any>(null);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.lookAt(target[0], target[1], target[2]);
    // Slider zoom (10..400) -> framed (14) .. close-up (90).
    const mapped = 14 + (Math.max(10, Math.min(400, zoom)) - 10) * 0.2;
    if (cam.zoom !== mapped) {
      cam.zoom = mapped;
      cam.updateProjectionMatrix();
    }
  });

  return (
    <orthographicCamera
      ref={cameraRef}
      position={position}
      zoom={zoom}
      near={0.1}
      far={1000}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  );
}
