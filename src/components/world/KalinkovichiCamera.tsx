import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function KalinkovichiCamera({ position = [0, 15, 0], target = [0, 0, 0], zoom = 50 }: any) {
  const cameraRef = useRef<any>(null);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.lookAt(target[0], target[1], target[2]);
    if (cam.zoom !== zoom) {
      cam.zoom = zoom;
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
