import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Maximize2, Smartphone } from 'lucide-react';
import { currentPortraitRenderMode } from '../portrait3dSupport';
import { usePortrait3dEnabled } from '../portrait3dFlag';
import { useAppSettings } from '../settings';

const Portrait3DCanvas = lazy(() =>
  import('./Portrait3DCanvas').then(module => ({ default: module.Portrait3DCanvas }))
);
const Portrait3DARCanvas = lazy(() =>
  import('./Portrait3DARCanvas').then(module => ({ default: module.Portrait3DARCanvas }))
);

/**
 * Lazy handle for call sites that render the canvas directly
 * (the market preview panel). Importing this instead of
 * Portrait3DCanvas keeps three.js out of the main bundle.
 */
export const LazyPortrait3DCanvas = Portrait3DCanvas;

// Probed once at module load: environments without
// IntersectionObserver (old WebViews) render the 3D
// canvas immediately instead of gating on visibility.
const HAS_INTERSECTION_OBSERVER = typeof IntersectionObserver !== 'undefined';

/**
 * Drop-in portrait renderer for character cards.
 *
 * Renders the existing 2D `<img>` path by default. When the
 * `emporium_3d` flag is on, WebGL2 is available, the user has
 * not asked to reduce data, and a glTF model exists for the
 * character, it swaps in a lazily-imported R3F canvas — but
 * only once the card scrolls into view (IntersectionObserver
 * with a 256px preload margin), so long lists never spin up
 * dozens of GL contexts. Any 3D failure falls back to the
 * WebP portrait.
 *
 * Mirrors the two card shapes used across the app: a plain
 * lazy image, or a button that opens the full-size 2D portrait
 * preview (the preview always uses the WebP — it is the
 * full-resolution asset).
 */

interface Portrait3DProps {
  /** glTF model URL; undefined keeps the 2D portrait. */
  model?: string;
  /** WebP portrait URL — fallback and preview asset. */
  poster: string;
  alt: string;
  /** Classes for the 2D image element. */
  className?: string;
  /** Opens the full-size 2D portrait (existing preview flow). */
  onPreviewImage?: (imageUrl: string) => void;
}

export function Portrait3D({ model, poster, alt, className, onPreviewImage }: Portrait3DProps) {
  const flag = usePortrait3dEnabled();
  const settings = useAppSettings();
  const [inView, setInView] = useState(false);
  const [failed, setFailed] = useState(false);
  const [arOpen, setArOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const use3d = model !== undefined && !failed && currentPortraitRenderMode(flag) === '3d';
  const showAr = settings.ar_mode && use3d && !!model && !arOpen;

  const arButton = showAr ? (
    <button
      type="button"
      onClick={() => setArOpen(true)}
      className="absolute top-2 right-2 z-20 rounded-full border border-amber-500/50 bg-slate-900/80 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition backdrop-blur"
      aria-label="Открыть в AR"
    >
      <Smartphone className="h-3 w-3 shrink-0" /> AR
    </button>
  ) : null;

  const arModal = arOpen && model ? (
    <Suspense fallback={null}>
      <Portrait3DARCanvas model={model} onClose={() => setArOpen(false)} />
    </Suspense>
  ) : null;

  useEffect(() => {
    if (!use3d || !HAS_INTERSECTION_OBSERVER) return;
    const element = wrapRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '256px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [use3d]);

  const media = use3d && (inView || !HAS_INTERSECTION_OBSERVER) ? (
    <Suspense fallback={<img src={poster} alt={alt} className={className} />}>
      <Portrait3DCanvas model={model} onError={() => setFailed(true)} />
    </Suspense>
  ) : (
    <img src={poster} alt={alt} className={className} loading="lazy" />
  );

  if (!onPreviewImage) {
    return (
      <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
        {media}
        {arButton}
        {arModal}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreviewImage(poster)}
      aria-label={`Открыть портрет ${alt}`}
      className="group absolute inset-0 h-full w-full focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-400"
    >
      <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
        {media}
        {arButton}
      </div>
      {arModal}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Maximize2 className="h-4 w-4" />
      </span>
    </button>
  );
}
