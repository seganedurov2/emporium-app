import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
import type { Mesh, Object3D, Texture } from 'three';
import * as THREE from 'three';

/**
 * Dispose three.js objects to prevent memory leaks
 */
function disposeObject(root: Object3D): void {
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value && (value as Texture).isTexture) (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}

interface PortraitModelProps {
  model: string;
  onError: () => void;
}

function PortraitModel({ model, onError }: PortraitModelProps) {
  const groupRef = useRef<Object3D>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const loader = new GLTFLoader();
    const group = groupRef.current;
    let cancelled = false;
    loader.load(
      model,
      gltf => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }
        // Normalize: fit the model into a ~1.6 unit box centered
        // at the origin so any source model frames correctly.
        const box = new Box3().setFromObject(gltf.scene);
        const size = box.getSize(new Vector3());
        const scale = 1.6 / Math.max(size.x, size.y, size.z, 0.0001);
        gltf.scene.scale.setScalar(scale);
        const scaledBox = new Box3().setFromObject(gltf.scene);
        const center = scaledBox.getCenter(new Vector3());
        gltf.scene.position.set(-center.x, -center.y, -center.z);
        group?.add(gltf.scene);
      },
      undefined,
      () => {
        if (!cancelled) onErrorRef.current();
      }
    );
    return () => {
      cancelled = true;
      if (group) {
        for (const child of [...group.children]) {
          group.remove(child);
          disposeObject(child);
        }
      }
    };
  }, [model]);

  return <group ref={groupRef} />;
}

// Particle system for visual feedback
function ParticleSystem({
  count = 100,
  size = 0.02,
  color = '#ff6b6b',
  speed = 0.5
}: { count?: number; size?: number; color?: string; speed?: number }) {
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

interface Portrait3DCanvasProps {
  model: string;
  onError: () => void;
}

export function Portrait3DCanvas({ model, onError }: Portrait3DCanvasProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [particleSystemProps, setParticleSystemProps] = useState({
    count: 100,
    size: 0.02,
    color: '#ff6b6b',
    speed: 0.8
  });
  const [physicsObjects] = useState([
    {
      id: 'sphere-1',
      position: [-0.5, 0, -0.5],
      rotation: [0, 0.5, 0],
      scale: [0.3, 0.3, 0.3],
      type: 'dynamic',
      mass: 0.5,
      friction: 0.3,
      restitution: 0.4
    },
    {
      id: 'sphere-2',
      position: [0.5, 0, 0.5],
      rotation: [0.2, 0, 0.2],
      scale: [0.4, 0.4, 0.4],
      type: 'dynamic',
      mass: 0.8,
      friction: 0.4,
      restitution: 0.6
    }
  ]);

  const { camera, scene, gl } = useThree();

  // Setup enhanced lighting with shadows
  useEffect(() => {
    if (!isInitialized) return;

    // Enhanced ambient lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Primary directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    // Secondary fill light
    const fillLight = new THREE.DirectionalLight(0x808080, 0.3);
    fillLight.position.set(-10, 5, -5);
    scene.add(fillLight);

    // Point light for accent
    const pointLight = new THREE.PointLight(0xff6b6b, 0.8, 20);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // Enable shadows for the renderer
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    return () => {
      scene.remove(ambientLight);
      scene.remove(directionalLight);
      scene.remove(fillLight);
      scene.remove(pointLight);
    };
  }, [isInitialized, scene, gl]);

  // Animation loop for continuous effects
  useFrame((state, delta) => {
    if (!isInitialized) return;

    // Update camera aspect ratio
    (camera as THREE.PerspectiveCamera).aspect = state.size.width / state.size.height;
    camera.updateProjectionMatrix();

    // Gentle rotation of the scene for visual interest
    scene.rotation.y += delta * 0.005;

    // Animate physics objects
    physicsObjects.forEach((obj) => {
      // Apply gentle floating motion
      obj.rotation[1] += delta * 0.02;
      obj.rotation[0] += delta * 0.01;
    });
  });

  // Initialize 3D scene
  useEffect(() => {
    setIsInitialized(true);

    // Initialize particle system
    setParticleSystemProps({
      count: 150,
      size: 0.02,
      color: '#ff6b6b',
      speed: 0.8
    });

    // Setup gesture listeners for simple 3D interactions
    const handlePointerDown = (event: any) => {
      const element = event.target;
      if (element) {
        element.addEventListener('pointermove', handlePointerMove);
        element.addEventListener('pointerup', handlePointerUp);
        element.addEventListener('touchmove', handleTouchMove);
        element.addEventListener('touchend', handleTouchEnd);
      }
    };

    const handlePointerMove = (event: any) => {
      const canvas = event.target;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 2 - 1;
      const y = -(event.clientY - rect.top) / rect.height * 2 + 1;

      // Handle rotation based on mouse movement
      if (event.buttons & 1) {
        camera.position.x += x * 0.01;
        camera.position.y -= y * 0.01;
        camera.lookAt(scene.position);
      }

      // Handle zoom with scroll
      if (event.deltaY) {
        camera.position.z = Math.max(2, Math.min(10, camera.position.z - event.deltaY * 0.001));
      }
    };

    const handlePointerUp = () => {
      const element = document.activeElement;
      if (element) {
        element.removeEventListener('pointermove', handlePointerMove);
        element.removeEventListener('pointerup', handlePointerUp);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }
    };

    const handleTouchMove = (event: any) => {
      event.preventDefault();
      const canvas = event.target;
      const rect = canvas.getBoundingClientRect();
      const touch = event.touches[0];
      const x = (touch.clientX - rect.left) / rect.width * 2 - 1;
      const y = -(touch.clientY - rect.top) / rect.height * 2 + 1;

      // Handle touch rotation
      if (event.touches.length > 0) {
        camera.position.x += x * 0.02;
        camera.position.y -= y * 0.02;
        camera.lookAt(scene.position);
      }
    };

    const handleTouchEnd = () => {
      const element = document.activeElement;
      if (element) {
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }
    };

    const canvasElement = gl.domElement;
    if (canvasElement) {
      canvasElement.addEventListener('pointerdown', handlePointerDown);
    }

    return () => {
      if (canvasElement) {
        canvasElement.removeEventListener('pointerdown', handlePointerDown);
      }
    };
  }, [camera, scene, gl]);

  // Particle tap effect handler
  const handleParticleTap = () => {
    setParticleSystemProps(prev => ({
      ...prev,
      count: prev.count + 20,
      speed: prev.speed + 0.3
    }));
  };
  void handleParticleTap;

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 4], fov: 35, near: 0.1, far: 50 }}
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1.2} 
        castShadow={true}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={0.6} distance={20} />
      
      {/* 3D Model */}
      <PortraitModel model={model} onError={onError} />
      
      {/* Enhanced 3D controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        panSpeed={0.8}
        zoomSpeed={1.0}
        rotateSpeed={0.5}
        maxDistance={8}
        minDistance={2}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={0}
      />
      
      {/* Particle System for visual feedback */}
      {isInitialized && (
        <ParticleSystem
          count={particleSystemProps.count}
          size={particleSystemProps.size}
          color={particleSystemProps.color}
          speed={particleSystemProps.speed}
        />
      )}
      
      {/* Physics Objects */}
      {physicsObjects.map(obj => (
        <mesh
          key={obj.id}
          position={obj.position as any}
          rotation={obj.rotation as any}
          scale={obj.scale as any}
        >
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial 
            color={obj.id.startsWith('sphere-1') || obj.id.startsWith('sphere-3') ? '#ff6b6b' : '#4ecdc4'}
            metalness={0.3}
            roughness={0.4}
            emissive={obj.id.startsWith('sphere-2') ? '#4ecdc4' : '#000000'}
            emissiveIntensity={obj.id.startsWith('sphere-2') ? 0.2 : 0}
          />
        </mesh>
      ))}
      
      {/* Grid helper for reference */}
      <gridHelper args={[20, 20, 0x444444, 0x222222]} position={[0, -2, 0]} />
      
      {/* Axis helper */}
      <axesHelper args={[5]} />
    </Canvas>
  );
}