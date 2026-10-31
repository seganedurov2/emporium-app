/**
 * Keyboard map of the mezzanine hub. Descriptions double as the pause-menu
 * keymap overlay, so the help text can never drift from the handler.
 */
import type { MezzanineViewMode } from "./mezzanineViewState";

export interface MezzanineShortcut {
  keys: string;
  label: string;
  action: MezzanineShortcutAction;
}

export type MezzanineShortcutAction =
  | { type: "region"; index: number }
  | { type: "toggleCity" }
  | { type: "viewMode"; mode: MezzanineViewMode }
  | { type: "sections" }
  | { type: "keymap" }
  | { type: "zoom"; delta: number };

/** Region order used by the 1..9 shortcuts; mirrors REGIONS in the map tab. */
export const MEZZANINE_REGION_SHORTCUTS: { id: string; digit: string }[] = [
  { id: "brest", digit: "1" },
  { id: "vitebsk", digit: "2" },
  { id: "gomel", digit: "3" },
  { id: "grodno", digit: "4" },
  { id: "minsk", digit: "5" },
  { id: "mogilev", digit: "6" },
  { id: "minsk-city", digit: "7" },
];

export const MEZZANINE_SHORTCUTS: MezzanineShortcut[] = [
  ...MEZZANINE_REGION_SHORTCUTS.map(({ id, digit }) => ({
    keys: digit,
    label: `Область: ${id}`,
    action: {
      type: "region",
      index: MEZZANINE_REGION_SHORTCUTS.findIndex((item) => item.id === id),
    } as const,
  })),
  {
    keys: "C",
    label: "Переключить карту города",
    action: { type: "toggleCity" },
  },
  {
    keys: "R",
    label: "Карта области",
    action: { type: "viewMode", mode: "region" },
  },
  {
    keys: "M",
    label: "Карта города",
    action: { type: "viewMode", mode: "city" },
  },
  {
    keys: "B",
    label: "План города",
    action: { type: "viewMode", mode: "city_plan" },
  },
  { keys: "K", label: "3D-карта", action: { type: "viewMode", mode: "3d" } },
  { keys: "+ / −", label: "Масштаб", action: { type: "zoom", delta: 0 } },
  { keys: "Tab", label: "Разделы игры", action: { type: "sections" } },
  { keys: "?", label: "Эта справка", action: { type: "keymap" } },
  { keys: "Esc", label: "Меню паузы", action: { type: "keymap" } },
];

/** Human-readable rows for the pause-menu keymap overlay. */
export const MEZZANINE_KEYMAP_ROWS: { keys: string; description: string }[] = [
  { keys: "1 – 7", description: "Области: Брест, Витебск, Гомель, Гродно, Минск, Могилёв, Город Минск" },
  { keys: "C", description: "Карта области ⇄ карта города" },
  { keys: "R / M", description: "Карта области / карта города" },
  { keys: "B", description: "План города: улицы, адреса, стройка" },
  { keys: "K", description: "3D-карта выбранного центра" },
  { keys: "+ / −", description: "Масштаб изометрии (или колёсико мыши)" },
  { keys: "Tab", description: "Разделы игры" },
  { keys: "?", description: "Карта горячих клавиш" },
  { keys: "Esc", description: "Меню паузы" },
];

export interface ShortcutContext {
  /** True while a text field or select has focus — hotkeys must not fire. */
  typing: boolean;
  /** True while an overlay (pause menu, keymap, 3D, city plan) owns the keyboard. */
  overlayOpen: boolean;
  hasRegion: boolean;
}

/** Pure resolver so the keymap can be unit-tested without a DOM. */
export function resolveMezzanineShortcut(
  key: string,
  context: ShortcutContext,
): MezzanineShortcutAction | null {
  if (context.typing) return null;
  const k = key.length === 1 ? key.toLowerCase() : key;

  if (k === "?") return { type: "keymap" };
  if (context.overlayOpen) return null;

  if (k === "Tab") return { type: "sections" };
  if (k === "+" || k === "=") return { type: "zoom", delta: 8 };
  if (k === "-" || k === "_") return { type: "zoom", delta: -8 };

  const regionIndex = MEZZANINE_REGION_SHORTCUTS.findIndex(
    (item) => item.digit === k,
  );
  if (regionIndex >= 0) return { type: "region", index: regionIndex };

  if (!context.hasRegion) return null;

  switch (k) {
    case "c":
      return { type: "toggleCity" };
    case "r":
      return { type: "viewMode", mode: "region" };
    case "m":
      return { type: "viewMode", mode: "city" };
    case "b":
      return { type: "viewMode", mode: "city_plan" };
    case "k":
      return { type: "viewMode", mode: "3d" };
    default:
      return null;
  }
}

/**
 * Wheel-to-zoom with a frame budget: several wheel events within one animation
 * frame collapse into a single state update instead of re-rendering per event.
 */
export function accumulateWheelZoom(
  accumulator: number,
  deltaY: number,
): number {
  return accumulator - deltaY * 0.05;
}
