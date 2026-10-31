import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Plane } from '@react-three/drei';
import { GrassLayer } from './GrassLayer';
import { RoadsOverlay } from './RoadsOverlay';

interface KalinkovichiMapProps {
  position?: [number, number, number];
  scale?: number;
  heightmap?: number[][] | null;
}

const SIZE = 100;
const SEGMENTS = 64;
const HEIGHT_SCALE = 12;

export function KalinkovichiMap({ position = [0, 0, 0], scale = 1, heightmap = null }: KalinkovichiMapProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.PlaneGeometry>(null);

  useEffect(() => {
    if (!heightmap || !geoRef.current) return;
    const geom = geoRef.current;
    const positions = geom.attributes.position;
    let colors = geom.attributes.color;
    const count = positions.count;
    if (!colors) {
      geom.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(count * 3), 3)
      );
      colors = geom.attributes.color;
    }
    const n = heightmap.length;
    const last = n - 1;
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const gx = Math.max(0, Math.min(last, Math.round(((x / SIZE) + 0.5) * last)));
      const gy = Math.max(0, Math.min(last, Math.round((0.5 - y / SIZE) * last)));
      const h = heightmap[gy][gx];
      positions.setZ(i, h * HEIGHT_SCALE);
      const c = new THREE.Color().setHSL(0.35 + h * 0.12, 0.5, 0.22 + h * 0.4);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geom.computeVertexNormals();
  }, [heightmap]);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIZE, SIZE, SEGMENTS, SEGMENTS]} ref={geoRef} />
        <meshStandardMaterial
          vertexColors
          color="#2d4a2b"
          roughness={0.9}
          metalness={0}
          flatShading
        />
      </mesh>

      {/* Roads layer */}
      <Plane args={[SIZE, SIZE]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <meshStandardMaterial
          color="#4a4a4a"
          transparent={true}
          opacity={0.35}
          roughness={0.6}
        />
      </Plane>

      {/* Roads overlay */}
      <RoadsOverlay />
      <GrassLayer heightmap={heightmap} size={SIZE} segments={SEGMENTS} heightScale={HEIGHT_SCALE} />
      <group position={[0, 0.02, 0]}>
        {[...Array(20)].map((_, i) => {
          const x = (i % 5 - 2) * 15;
          const z = Math.floor(i / 5 - 2) * 15;
          return (
            <mesh key={i} position={[x, 2, z]}>
              <boxGeometry args={[6, 4, 6]} />
              <meshStandardMaterial color="#6b5d4f" roughness={0.7} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
