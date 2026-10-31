import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarfieldProps {
  /** Number of stars. 1800 is ~cheap: one BufferGeometry, one draw call. */
  count?: number;
  /** Radius of the shell the stars are spread on. */
  radius?: number;
  /** Slow rotation, radians per second. 0 freezes the sky. */
  drift?: number;
}

/**
 * Deep-space backdrop for the 3D hub.
 *
 * Built with plain `THREE.Points` rather than a skybox texture: no asset to
 * download, no mip-mapping cost, and the size attenuation makes near stars
 * noticeably bigger. Three colour classes (white, ice, amber) keep the sky
 * from looking like noise.
 */
export function Starfield({ count = 1800, radius = 90, drift = 0.006 }: StarfieldProps) {
  const group = useRef<THREE.Group>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Deterministic placement: a rerender must not reshuffle the sky.
    let seed = 0x9e3779b9;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const white = new THREE.Color('#e8f1ff');
    const ice = new THREE.Color('#7dd3fc');
    const amber = new THREE.Color('#fbbf24');
    const scratch = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Uniform direction on a shell, biased away from the camera's near plane.
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = radius * (0.75 + random() * 0.25);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 2;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const roll = random();
      scratch.copy(roll > 0.94 ? amber : roll > 0.78 ? ice : white);
      const brightness = 0.55 + random() * 0.45;
      colors[i * 3] = scratch.r * brightness;
      colors[i * 3 + 1] = scratch.g * brightness;
      colors[i * 3 + 2] = scratch.b * brightness;

      sizes[i] = 0.35 + random() * 0.9;
    }

    return { positions, colors, sizes };
  }, [count, radius]);

  useFrame((_, delta) => {
    if (group.current && drift) group.current.rotation.y += delta * drift;
  });

  return (
    <group ref={group}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.55}
          sizeAttenuation
          transparent
          depthWrite={false}
          opacity={0.95}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
