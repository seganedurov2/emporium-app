import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

interface Portrait3DARCanvasProps {
  model: string;
  onClose: () => void;
}

export function Portrait3DARCanvas({ model, onClose }: Portrait3DARCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const [arSupported, setArSupported] = useState(false);
  const [arSession, setArSession] = useState<XRSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.xr) {
      setArSupported(false);
      return;
    }
    navigator.xr
      .isSessionSupported('immersive-ar')
      .then(supported => setArSupported(supported))
      .catch(() => setArSupported(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.xr.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const loader = new GLTFLoader();
    loader.load(
      model,
      gltf => {
        const box = new Box3().setFromObject(gltf.scene);
        const size = box.getSize(new Vector3());
        const scale = 1.2 / Math.max(size.x, size.y, size.z, 0.0001);
        gltf.scene.scale.setScalar(scale);
        const scaledBox = new Box3().setFromObject(gltf.scene);
        const center = scaledBox.getCenter(new Vector3());
        gltf.scene.position.set(-center.x, -center.y, -center.z);
        modelRef.current = gltf.scene;
        scene.add(gltf.scene);
      },
      undefined,
      () => setError('Не удалось загрузить 3D-модель для AR')
    );

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.005;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [model]);

  const enterAR = async () => {
    if (!navigator.xr || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    setError(null);
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local']
      });
      rendererRef.current.xr.setSession(session);
      setArSession(session);
      session.addEventListener('end', () => {
        setArSession(null);
      });
    } catch {
      setError('AR-сессия не удалась. Попробуйте в браузере с поддержкой WebXR — Yandex Browser, Edge, Chrome (Android) или Safari (iOS).');
    }
  };

  const exitAR = () => {
    if (arSession) {
      arSession.end();
    }
    setArSession(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black p-4 flex flex-col">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={onClose}
          className="rounded-full border border-slate-600 bg-slate-900 p-2 text-slate-200 hover:bg-slate-800 transition"
          aria-label="Закрыть AR"
        >
          ✕
        </button>
      </div>

      {!arSupported && !error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
          <p className="text-sm">AR не поддерживается этим устройством или браузером.</p>
          <p className="text-[10px] mt-2 text-slate-500">Нужен WebXR (Yandex Browser, Edge, Chrome на Android; Safari на iOS).</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg border border-slate-600 bg-slate-800 px-4 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="flex-1 w-full h-full" />
          {error && (
            <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 text-center backdrop-blur">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline underline-offset-2 text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          )}
          {!arSession && (
            <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
              <button
                onClick={enterAR}
                disabled={!arSupported}
                className={`rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${!arSupported ? 'disabled' : ''}`}
              >
                {arSupported ? 'Войти в AR' : 'AR не поддерживается'}
              </button>
            </div>
          )}
          {arSession && (
            <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
              <button
                onClick={exitAR}
                className="rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3 shadow-lg transition"
              >
                Выйти из AR
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
