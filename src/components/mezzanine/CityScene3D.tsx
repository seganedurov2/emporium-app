import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { listStreets, type Building, type Cell, type CityState } from '../../cityBuilder';
import {
  buildBuildingModel,
  createBuildingMaterial,
  type AnimatedPart,
} from './buildingModels';

export interface CityScene3DProps {
  city: CityState;
  /** Cell under the pointer, or null. */
  hover: { x: number; y: number } | null;
  selected: { x: number; y: number } | null;
  onPick: (cell: { x: number; y: number }) => void;
  onHover: (cell: { x: number; y: number } | null) => void;
  showLabels: boolean;
  bulldozer: boolean;
  /** Number of pedestrians walking the sidewalks (matches pleasure-house roster). */
  peopleCount?: number;
}

/** Grid cell -> world position. One cell is one world unit. */
const cellX = (x: number, size: number) => x - size / 2 + 0.5;
const cellZ = (y: number, size: number) => y - size / 2 + 0.5;

/**
 * Group of a building; faces the camera corner so the authored façade (door,
 * awning, show windows) always looks at the viewer.
 */
function BuildingNode({
  building,
  x,
  y,
  size,
  material,
}: {
  building: Building;
  x: number;
  y: number;
  size: number;
  material: THREE.Material;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const craneRef = useRef<THREE.Group>(null);
  const smokeRef = useRef<THREE.Group>(null);

  // Models change only at milestone steps, not on every simulation tick: the
  // construction site grows in visible stages instead of rebuilding each frame.
  const stage = building.progress >= 1 ? 20 : Math.floor(building.progress * 4);
  const progress = building.progress >= 1 ? 1 : Math.max(0.05, (stage + 1) / 5);
  const model = useMemo(
    () => buildBuildingModel(building.kind, progress, building.id),
    [building.kind, progress, building.id],
  );

  useEffect(() => () => model.geometry.dispose(), [model]);

  const crane = model.animated.find((a): a is Extract<AnimatedPart, { type: 'crane' }> => a.type === 'crane');
  const smoke = model.animated.find((a): a is Extract<AnimatedPart, { type: 'smoke' }> => a.type === 'smoke');

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (craneRef.current) {
      // Slow sweep, each site on its own rhythm.
      craneRef.current.rotation.y = Math.sin(t * 0.32 + crane!.phase) * 0.9 + 0.5;
    }
    if (smokeRef.current) {
      smokeRef.current.children.forEach((child, i) => {
        const phase = (t * 0.22 + smoke!.phase * 0.2 + i * 0.33) % 1;
        const s = 0.04 + phase * 0.09;
        child.scale.setScalar(s);
        child.position.set(
          Math.sin(phase * 3 + i) * 0.04,
          smoke!.origin.y + phase * 0.55,
          Math.cos(phase * 2.5 + i) * 0.04,
        );
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = 0.55 * (1 - phase);
      });
    }
    // A breeze through the parks.
    const g = groupRef.current;
    if (g && building.kind === 'park') {
      g.rotation.z = Math.sin(t * 0.6 + building.id) * 0.002;
    }
  });

  return (
    <group ref={groupRef} position={[cellX(x, size), -0.05, cellZ(y, size)]}>
      {/* A lot is a full cell, so the model fills it — a half-size building
          leaves the town reading as scattered sheds. */}
      <group rotation={[0, Math.PI / 4, 0]} scale={1.18}>
        <mesh geometry={model.geometry} material={material} castShadow receiveShadow />
        {crane && (
          <group position={crane.pivot.toArray()} ref={craneRef}>
            <Crane height={crane.height} />
          </group>
        )}
        {smoke && (
          <group ref={smokeRef}>
            {[0, 1, 2, 3].map(i => (
              <mesh key={i} position={smoke.origin.toArray()}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#e9ecee" transparent opacity={0.5} depthWrite={false} />
              </mesh>
            ))}
          </group>
        )}
      </group>
      {/* Courtyard greening */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.15, 1.15]} />
        <meshStandardMaterial color="#3f7f3f" roughness={1} />
      </mesh>
      {[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.03, 0.16, 6]} />
            <meshStandardMaterial color="#5a3a1b" />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color="#2e6b2e" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Yellow tower crane with a rotating jib and a hanging hook. */
function Crane({ height }: { height: number }) {
  const hookRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (hookRef.current) hookRef.current.position.x = Math.sin(clock.elapsedTime * 1.1) * 0.03;
  });
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[0.045, height, 0.045]} />
        <meshStandardMaterial color="#f2b705" roughness={0.6} />
      </mesh>
      <mesh position={[0, height + 0.05, 0]} castShadow>
        <boxGeometry args={[0.6, 0.04, 0.04]} />
        <meshStandardMaterial color="#f2b705" roughness={0.6} />
      </mesh>
      <mesh position={[0, height + 0.13, 0]}>
        <boxGeometry args={[0.025, 0.12, 0.025]} />
        <meshStandardMaterial color="#5d4a05" />
      </mesh>
      <mesh position={[-0.14, height - 0.02, 0]}>
        <boxGeometry args={[0.14, 0.07, 0.07]} />
        <meshStandardMaterial color="#6e6f72" />
      </mesh>
      <group ref={hookRef} position={[0.28, height, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.24, 4]} />
          <meshStandardMaterial color="#2b2b2b" />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[0.035, 0.03, 0.035]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
      </group>
    </group>
  );
}

function Ground({
  city,
  hover,
  selected,
  onPick,
  onHover,
}: Pick<CityScene3DProps, 'city' | 'hover' | 'selected' | 'onPick' | 'onHover'>) {
  const size = city.size;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const cells = useMemo(() => {
    const out: { x: number; y: number; cell: Cell }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) out.push({ x, y, cell: city.cells[y][x] });
    }
    return out;
  }, [city, size]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    cells.forEach(({ x, y, cell }, i) => {
      dummy.position.set(cellX(x, size), 0, cellZ(y, size));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const shade = n - Math.floor(n);
      if (cell.type === 'road') color.set('#6f7377');
      else if (cell.type === 'lot') color.set(shade > 0.5 ? '#4f8a4c' : '#4a8248');
      else color.set(shade > 0.5 ? '#3f7340' : '#3b6c3c');
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells, size, dummy, color]);

  const roadLines = useMemo(() => {
    // Dashed centre lines down every road, so the street grid reads from above.
    const dashes: { x: number; z: number; horizontal: boolean }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = city.cells[y][x];
        if (c.type !== 'road') continue;
        const horizontal = x > 0 && x < size - 1 && city.cells[y][x - 1].type === 'road';
        if ((x + y) % 2 === 0) dashes.push({ x, z: y, horizontal });
      }
    }
    return dashes;
  }, [city, size]);

  const toCell = (e: { point: THREE.Vector3 }) => {
    const p = e.point;
    const x = Math.floor(p.x + size / 2);
    const y = Math.floor(p.z + size / 2);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, cells.length]}
        receiveShadow
        onPointerMove={e => {
          e.stopPropagation();
          onHover(toCell(e));
        }}
        onPointerOut={() => onHover(null)}
        onClick={e => {
          e.stopPropagation();
          const c = toCell(e);
          if (c) onPick(c);
        }}
      >
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>

      {roadLines.map(({ x, z, horizontal }) => (
        <mesh key={`${x}:${z}`} position={[cellX(x, size), 0.052, cellZ(z, size)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={horizontal ? [0.5, 0.035] : [0.035, 0.5]} />
          <meshBasicMaterial color="#e8d99a" transparent opacity={0.6} />
        </mesh>
      ))}

      {hover && (
        <mesh position={[cellX(hover.x, size), 0.06, cellZ(hover.y, size)]} renderOrder={2}>
          <boxGeometry args={[1.02, 0.02, 1.02]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      {selected && (
        <mesh position={[cellX(selected.x, size), 0.061, cellZ(selected.y, size)]} renderOrder={3}>
          <boxGeometry args={[1.04, 0.02, 1.04]} />
          <meshBasicMaterial color="#ffd60a" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function StreetLabels({ city }: { city: CityState }) {
  const size = city.size;
  const labels = useMemo(() => {
    const out: { text: string; x: number; z: number }[] = [];
    for (const st of listStreets(city)) {
      // Place the name near the middle of its road, nudged to the view centre.
      let sx = -1;
      let sy = -1;
      let best = Infinity;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const c = city.cells[y][x];
          if (c.type !== 'road' || c.street !== st.name) continue;
          const d = Math.abs(x - size / 2) + Math.abs(y - size / 2);
          if (d < best) {
            best = d;
            sx = x;
            sy = y;
          }
        }
      }
      if (sx >= 0) out.push({ text: st.name, x: sx, z: sy });
    }
    return out;
  }, [city, size]);

  const textures = useMemo(
    () =>
      labels.map(l => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(15,23,42,0.78)';
          ctx.beginPath();
          ctx.roundRect(0, 0, 256, 64, 18);
          ctx.fill();
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 32px Nunito, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = l.text.toUpperCase();
          ctx.fillText(label.length > 18 ? `${label.slice(0, 17)}…` : label, 128, 34);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
      }),
    [labels],
  );

  useEffect(() => () => textures.forEach(t => t.dispose()), [textures]);

  return (
    <group>
      {labels.map((l, i) => (
        <sprite key={l.text} position={[cellX(l.x, size), 1.1, cellZ(l.z, size)]} scale={[1.5, 0.375, 1]}>
          <spriteMaterial map={textures[i]} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

function Buildings({
  city,
  material,
}: {
  city: CityState;
  material: THREE.Material;
}) {
  const size = city.size;
  const list = useMemo(() => {
    const seen = new Set<Building>();
    const out: { building: Building; x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = city.cells[y][x];
        if (c.type !== 'lot' || !c.building || seen.has(c.building)) continue;
        seen.add(c.building);
        out.push({ building: c.building, x, y });
      }
    }
    return out;
    // city identity changes on every placement; rebuild the list then.
  }, [city, size]);

  return (
    <group>
      {list.map(({ building, x, y }) => (
        <BuildingNode key={building.id} building={building} x={x} y={y} size={size} material={material} />
      ))}
    </group>
  );
}

/**
 * Isometric-ish 3D plan of the city. Drag with the left button to orbit,
 * wheel to zoom; a click (without dragging) places or demolishes on the cell.
 */
export function CityScene3D(props: CityScene3DProps) {
  const { city } = props;
  const material = useMemo(() => createBuildingMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 44, 44], fov: 32, near: 0.1, far: 400 }}
      onPointerMissed={() => props.onHover(null)}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#20301f']} />
      <fog attach="fog" args={['#20301f', 40, 90]} />
      <hemisphereLight args={['#cfe8ff', '#3b4a2f', 1.1]} />
      <directionalLight
        position={[18, 30, 12]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-bias={-0.0008}
      />
      <Ground city={city} hover={props.hover} selected={props.selected} onPick={props.onPick} onHover={props.onHover} />
      <Buildings city={city} material={material} />
      {props.showLabels && <StreetLabels city={city} />}
      <People city={city} peopleCount={props.peopleCount ?? 0} />
      <LookAtCentre />
    </Canvas>
  );
}

/**
 * A small pedestrian that walks between adjacent road cells.
 */
function Person({ city, size }: { city: CityState; size: number }) {
  const ref = useRef<THREE.Group>(null);
  const [target, setTarget] = useState<{ x: number; z: number } | null>(null);
  const start = useRef(new THREE.Vector3());
  const progress = useRef(0);

  // Pick a starting road cell for this person.
  const roadCells = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (city.cells[y][x].type === 'road') out.push({ x: cellX(x, size), z: cellZ(y, size) });
      }
    }
    return out;
  }, [city, size]);

  useEffect(() => {
    if (roadCells.length === 0 || !ref.current) return;
    const startCell = roadCells[Math.floor(Math.random() * roadCells.length)];
    ref.current.position.set(startCell.x, 0.06, startCell.z);
    start.current.copy(ref.current.position);
    setTarget(startCell);
  }, [roadCells, size]);

  // Pick a new random adjacent road cell to walk toward.
  useFrame((_, delta) => {
    if (!ref.current || !target) return;
    progress.current += delta * 1.2;
    if (progress.current >= 1) {
      progress.current = 0;
      start.current.copy(ref.current.position);
      const cx = Math.floor(ref.current.position.x + size / 2);
      const cz = Math.floor(ref.current.position.z + size / 2);
      const neighbors: { x: number; z: number }[] = [];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx >= 0 && nz >= 0 && nx < size && nz < size && city.cells[nz][nx].type === 'road') {
          neighbors.push({ x: cellX(nx, size), z: cellZ(nz, size) });
        }
      }
      if (neighbors.length > 0) {
        setTarget(neighbors[Math.floor(Math.random() * neighbors.length)]);
      }
    } else if (target) {
      ref.current.position.lerpVectors(start.current, new THREE.Vector3(target.x, 0.06, target.z), progress.current);
      ref.current.lookAt(target.x, 0.06, target.z);
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.06, 0.28, 8]} />
        <meshStandardMaterial color="#e2b969" />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#d4a373" />
      </mesh>
    </group>
  );
}

/**
 * Pedestrians walking the sidewalks — one per person in the pleasure-house roster.
 */
function People({ city, peopleCount }: { city: CityState; peopleCount: number }) {
  const size = city.size;
  return (
    <group>
      {Array.from({ length: Math.max(0, peopleCount) }, (_, i) => (
        <Person key={i} city={city} size={size} />
      ))}
    </group>
  );
}

/**
 * Keeps the camera aimed at the middle of the town (which sits half a cell in
 * from the origin) so the generated blocks line up with the frame edge.
 */
function LookAtCentre() {
  useFrame(({ camera }) => camera.lookAt(0, 0, 0));
  return null;
}


