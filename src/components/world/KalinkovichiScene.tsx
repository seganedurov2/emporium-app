import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { KalinkovichiMap } from './KalinkovichiMap';
import { KalinkovichiCamera } from './KalinkovichiCamera';

interface KalinkovichiSceneProps {
  className?: string;
  showUI?: boolean;
}

export function KalinkovichiScene({ className = '', showUI = true }: KalinkovichiSceneProps) {
  return (
    <div className={`relative w-full h-full ${className}`} style={{ background: '#1a4d2e' }}>
      <Canvas shadows={false}>
        <Suspense fallback={null}>
          <KalinkovichiCamera position={[0, 20, 0]} target={[0, 0, 0]} />
          <KalinkovichiMap scale={1} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 5]} intensity={0.8} />
        </Suspense>
      </Canvas>
      
      {showUI && (
        <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-2 rounded text-sm">
          Калинковичи, Республика Беларусь
        </div>
      )}
    </div>
  );
}
