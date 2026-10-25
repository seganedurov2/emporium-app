import { useSyncExternalStore } from 'react';

/**
 * Global `emporium_3d` flag store.
 *
 * Settings live as React state in App.tsx, but portrait rendering is
 * spread across many components (market preview, auction cards, six
 * PersonnelCard call sites). Instead of prop-drilling the flag through
 * every layer, App.tsx mirrors the setting into this tiny external
 * store and any component subscribes with {@link usePortrait3dEnabled}.
 */

let enabled = false;
const listeners = new Set<() => void>();

/** Mirrors the `emporium_3d` setting into the global store. */
export function setPortrait3dEnabled(value: boolean): void {
  if (enabled === value) return;
  enabled = value;
  for (const listener of listeners) listener();
}

/** Non-reactive read of the global flag (tests, imperative code). */
export function isPortrait3dEnabled(): boolean {
  return enabled;
}

/** Reactive read of the global `emporium_3d` flag. */
export function usePortrait3dEnabled(): boolean {
  return useSyncExternalStore(
    subscribe => {
      listeners.add(subscribe);
      return () => {
        listeners.delete(subscribe);
      };
    },
    () => enabled
  );
}
