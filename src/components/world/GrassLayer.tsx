import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface GrassLayerProps {
  heightmap?: number[][] | null;
  size?: number;
  segments?: number;
  heightScale?: number;
  density?: number;
}

/** A single grass blade: a thin, slightly curved quad standing on the XZ plane. */
function bladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.4, 1.2, 1, 4);
  const pos = geo.attributes.position;
  // Taper the blade: narrow at the top, wide at the base.
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + 0.6) / 1.2; // 0 at bottom, 1 at top
    const taper = 0.15 + 0.85 * (1 - t);
    pos.setX(i, pos.getX(i) * taper);
  }
  // Give the blade a gentle forward lean so it reads as wind-blown grass.
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + 0.6) / 1.2;
    pos.setZ(i, pos.getZ(i) - t * 0.18);
  }
  geo.computeVertexNormals();
  return geo;
}

export function GrassLayer({
  heightmap = null,
  size = 100,
  segments = 64,
  heightScale = 12,
  density = 12,
}: GrassLayerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const bladeGeo = useMemo(() => bladeGeometry(), []);
  const bladeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4a9b3c',
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !heightmap) return;
    const n = heightmap.length;
    const last = n - 1;
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let yi = 0; yi < segments; yi++) {
      for (let xi = 0; xi < segments; xi++) {
        for (let d = 0; d < density; d++) {
          const x = (xi / segments - 0.5) * size + (Math.random() - 0.5) * (size / segments);
          const z = (yi / segments - 0.5) * size + (Math.random() - 0.5) * (size / segments);
          const gx = Math.max(0, Math.min(last, Math.round(((x / size) + 0.5) * last)));
          const gy = Math.max(0, Math.min(last, Math.round((0.5 - z / size) * last)));
          const h = heightmap[gy][gx];
          if (h > 0.35) continue; // only lawn
          dummy.position.set(x, h * heightScale, z);
          dummy.rotation.y = Math.random() * Math.PI * 2;
          dummy.scale.setScalar(0.6 + Math.random() * 0.8);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
  }, [heightmap, size, segments, heightScale, density]);

  return (
    <instancedMesh ref={meshRef} args={[bladeGeo, bladeMat, segments * segments * density]} frustumCulled>
    </instancedMesh>
  );
}