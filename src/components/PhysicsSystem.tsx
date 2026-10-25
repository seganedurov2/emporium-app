import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export interface PhysicsObject {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  type: 'dynamic' | 'static' | 'kinematic';
  mass?: number;
  friction?: number;
  restitution?: number;
  onCollide?: (other: PhysicsObject) => void;
}

// Enhanced RigidBody component for physics simulation
export function PhysicsObject({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  mass = 1,
  friction = 0.5,
  restitution = 0.3,
  type = 'dynamic',
  onCollisionEnter,
  ...props
}: {
  children: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  mass?: number;
  friction?: number;
  restitution?: number;
  type?: 'dynamic' | 'static' | 'kinematic';
  onCollisionEnter?: (other: any) => void;
} & React.ComponentProps<any>) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      // Apply gentle floating motion for visual interest
      meshRef.current.rotation.y += 0.02;
      meshRef.current.rotation.x += 0.01;
    }
  });

  return (
    <mesh position={position as any} rotation={rotation as any} scale={scale as any} {...props}>
      {children}
    </mesh>
  );
}