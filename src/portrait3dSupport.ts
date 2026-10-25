/**
 * Capability probes for 3D portraits.
 *
 * The decision logic is pure ({@link resolvePortraitRenderMode}) so it can
 * be unit-tested without a DOM; the probe functions below are the only
 * browser-touching code and are cached after the first call.
 *
 * three.js r150+ requires WebGL2, which every Chromium-based WebView
 * (Telegram Mini App, Capacitor Android) exposes on virtually all
 * devices — but the check stays cheap and the fallback is mandatory:
 * `prefers-reduced-data` users and legacy WebViews keep the WebP path.
 */

export type PortraitRenderMode = '3d' | '2d';

export interface Portrait3dCapabilities {
  /** The `emporium_3d` feature flag from app settings. */
  flag: boolean;
  /** WebGL2 context available. */
  webgl2: boolean;
  /** The user asked the browser to reduce data usage. */
  reducedData: boolean;
}

/** Pure decision: 3D only when the flag is on, WebGL2 exists and data saving is off. */
export function resolvePortraitRenderMode(caps: Portrait3dCapabilities): PortraitRenderMode {
  if (!caps.flag) return '2d';
  if (!caps.webgl2) return '2d';
  if (caps.reducedData) return '2d';
  return '3d';
}

let webgl2Support: boolean | undefined;

/** Probes for a WebGL2 context once and caches the result. */
export function supportsWebGL2(): boolean {
  if (webgl2Support !== undefined) return webgl2Support;
  try {
    const canvas = document.createElement('canvas');
    webgl2Support = Boolean(canvas.getContext('webgl2'));
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

/** True when the browser is asked to reduce data usage. */
export function prefersReducedData(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-data: reduce)').matches;
}

/** Resolves the render mode from live probes plus the feature flag. */
export function currentPortraitRenderMode(flag: boolean): PortraitRenderMode {
  return resolvePortraitRenderMode({
    flag,
    webgl2: supportsWebGL2(),
    reducedData: prefersReducedData()
  });
}
