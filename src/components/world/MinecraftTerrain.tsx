import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface MinecraftTerrainProps {
  grid: number[][];
  blockSize?: number;
}

const MAX_HEIGHT = 8;

export function MinecraftTerrain({ grid, blockSize = 1 }: MinecraftTerrainProps) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    while (group.children.length) {
      group.remove(group.children[0]);
    }

    const size = grid.length;
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

    const grassMat = new THREE.MeshStandardMaterial({ color: '#4a7c59' });
    const dirtMat = new THREE.MeshStandardMaterial({ color: '#7f5f3f' });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#6b6b6b' });

    const grassMats: THREE.Matrix4[] = [];
    const dirtMats: THREE.Matrix4[] = [];
    const stoneMats: THREE.Matrix4[] = [];

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const h = Math.max(0, Math.min(MAX_HEIGHT, Math.floor(grid[z][x] * MAX_HEIGHT)));
        for (let y = 0; y < h; y++) {
          const m = new THREE.Matrix4();
          m.makeTranslation(
            (x - size / 2) * blockSize,
            y * blockSize,
            (z - size / 2) * blockSize
          );
          if (y === h - 1) grassMats.push(m);
          else if (y === 0) stoneMats.push(m);
          else dirtMats.push(m);
        }
      }
    }

    const build = (mats: THREE.Matrix4[], material: THREE.Material) => {
      if (mats.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, material, mats.length);
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    };

    build(stoneMats, stoneMat);
    build(dirtMats, dirtMat);
    build(grassMats, grassMat);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(size * blockSize, size * blockSize),
      new THREE.MeshStandardMaterial({ color: '#111', roughness: 1, metalness: 0 })
    );
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);

    return () => {
      while (group.children.length) {
        const child = group.children[0];
        group.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      }
      geometry.dispose();
      grassMat.dispose();
      dirtMat.dispose();
      stoneMat.dispose();
    };
  }, [grid, blockSize]);

  return <group ref={groupRef} />;
}
