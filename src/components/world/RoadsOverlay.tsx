import * as THREE from 'three';

const ROADS: [number, number, number, number][] = [
  [-40, -20, 40, -20],
  [-40, 0, 40, 0],
  [-40, 20, 40, 20],
  [-20, -40, -20, 40],
  [0, -40, 0, 40],
  [20, -40, 20, 40],
];

export function RoadsOverlay() {
  const points = ROADS.flatMap(([x1, z1, x2, z2]) => [
    new THREE.Vector3(x1, 0.05, z1),
    new THREE.Vector3(x2, 0.05, z2),
  ]);
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#8a8a8a" linewidth={2} />
    </lineSegments>
  );
}
