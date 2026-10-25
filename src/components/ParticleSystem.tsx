// Particle system for visual feedback
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface ParticleSystemProps {
  count?: number;
  size?: number;
  color?: string;
  speed?: number;
}

export function ParticleSystem({
  count = 100,
  size = 0.02,
  color = '#ff6b6b',
  speed = 0.5
}: ParticleSystemProps) {
  const particlesRef = useRef<THREE.Points>(null);

  // Generate initial particles
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorObj = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Random positions in a sphere around center
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.5;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      colors[i3] = colorObj.r;
      colors[i3 + 1] = colorObj.g;
      colors[i3 + 2] = colorObj.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count, color]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
  }, [size]);

  useFrame((_state, delta) => {
    if (!particlesRef.current) return;
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Simple particle movement
      positions[i3] += (Math.random() - 0.5) * delta * speed;
      positions[i3 + 1] += (Math.random() - 0.5) * delta * speed;
      positions[i3 + 2] += (Math.random() - 0.5) * delta * speed;
      
      // Add subtle circular motion
      const age = i * 0.05;
      const circleRadius = 0.1 * Math.sin(age);
      
      positions[i3] += circleRadius * Math.cos(age);
      positions[i3 + 1] += circleRadius * Math.sin(age);
      
      // Update colors based on position
      const r = 0.5 + Math.sin(Date.now() * 0.001 + i * 0.1) * 0.5;
      const g = 0.5 + Math.cos(Date.now() * 0.001 + i * 0.1) * 0.5;
      const b = Math.sin(Date.now() * 0.001 + i * 0.1);
      
      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} geometry={geometry} material={material} />
  );
}