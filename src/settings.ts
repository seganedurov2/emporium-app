import { useState } from 'react';
import { setOrientationLock, type OrientationLock } from './telegram';
import type { DataProtectionSettings } from './dataProtection';

export interface AppSettings {
  /** Screen orientation: follow the sensor or lock to one mode. */
  orientation: OrientationLock;
  /** Show toast notifications (the top-right banner). */
  notifications: boolean;
  /**
   * Feature flag `emporium_3d`: render character portraits as 3D glTF
   * models where a converted model exists. Off by default — the rollout
   * is staged per region, and devices without WebGL2 or with
   * `prefers-reduced-data` always fall back to the 2D WebP path.
   */
  emporium_3d: boolean;
  /** WebXR AR mode for viewing 3D portraits in augmented reality. */
  ar_mode: boolean;
  /** Data protection settings for distributed warehouse deployments. */
  data_protection: DataProtectionSettings;
  /** UI theme: 'dark' (default) or 'light'. */
  theme: 'dark' | 'light';
}

const STORAGE_KEY = 'emporium_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  orientation: 'auto',
  notifications: true,
  emporium_3d: false,
  ar_mode: false,
  data_protection: {
    encryption_at_rest: false,
    tls_wss: false,
    audit_log: false
  },
  theme: 'dark'
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      orientation:
        parsed.orientation === 'portrait' || parsed.orientation === 'landscape'
          ? parsed.orientation
          : DEFAULT_SETTINGS.orientation,
      notifications:
        typeof parsed.notifications === 'boolean'
          ? parsed.notifications
          : DEFAULT_SETTINGS.notifications,
      emporium_3d:
        typeof parsed.emporium_3d === 'boolean'
          ? parsed.emporium_3d
          : DEFAULT_SETTINGS.emporium_3d,
      ar_mode:
        typeof parsed.ar_mode === 'boolean'
          ? parsed.ar_mode
          : DEFAULT_SETTINGS.ar_mode,
      data_protection: {
        encryption_at_rest:
          typeof parsed.data_protection?.encryption_at_rest === 'boolean'
            ? parsed.data_protection.encryption_at_rest
            : DEFAULT_SETTINGS.data_protection.encryption_at_rest,
        tls_wss:
          typeof parsed.data_protection?.tls_wss === 'boolean'
            ? parsed.data_protection.tls_wss
            : DEFAULT_SETTINGS.data_protection.tls_wss,
        audit_log:
          typeof parsed.data_protection?.audit_log === 'boolean'
            ? parsed.data_protection.audit_log
            : DEFAULT_SETTINGS.data_protection.audit_log
      },
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark'
          ? parsed.theme
          : DEFAULT_SETTINGS.theme
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists settings and applies the orientation lock right away. */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* storage unavailable */ }
  setOrientationLock(settings.orientation);
}

export function useAppSettings(): AppSettings {
  const [settings] = useState<AppSettings>(() => loadSettings());
  return settings;
}
