import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlayerProps {
  position?: [number, number, number];
  speed?: number;
}

export function Player({ position = [0, 0, 0], speed = 0.1 }: PlayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(position[0], 0.5, position[2]);
    }
  }, []);
  
  useFrame((state: any) => {
    // Simple WASD movement
    const keys = (window as any).__gameKeys || state.keys || {};
    const moveVector = new THREE.Vector3();
    
    if (keys['KeyW'] || keys['ArrowUp']) moveVector.z -= speed;
    if (keys['KeyS'] || keys['ArrowDown']) moveVector.z += speed;
    if (keys['KeyA'] || keys['ArrowLeft']) moveVector.x -= speed;
    if (keys['KeyD'] || keys['ArrowRight']) moveVector.x += speed;
    
    if (moveVector.length() > 0 && meshRef.current) {
      moveVector.normalize().multiplyScalar(speed);
      meshRef.current.position.add(moveVector);
      
      // Keep camera above player for top-down view
      camera.position.set(
        meshRef.current.position.x,
        20,
        meshRef.current.position.z
      );
      camera.lookAt(meshRef.current.position);
    }
  });
  
  return (
    <mesh ref={meshRef} position={[position[0], 0.5, position[2]]}>
      <cylinderGeometry args={[0.3, 0.3, 1, 8]} />
      <meshStandardMaterial color="#8b4513" />
    </mesh>
  );
}
