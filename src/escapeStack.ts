/**
 * One owner for the Escape key.
 *
 * Several layers listen for Escape: the in-mezzanine keymap and city plan, the
 * mezzanine pause menu, and the app shell menu/mobile navigation. Before this
 * module a single press could reach more than one listener and close two
 * overlays at once (for example the city plan *and* the in-game menu).
 *
 * `resolveEscape` is a pure resolver: given the overlay states it returns the
 * one action a press should take, or null when nothing is open. Listeners call
 * it with the same input and act only on the action that belongs to them, so
 * exactly one overlay closes per press regardless of event order.
 */

export type EscapeAction =
  /** Close the mezzanine pause menu. */
  | 'close_pause_menu'
  /** Close the keymap overlay. */
  | 'close_keymap'
  /** Down one level from the 3D map. */
  | 'exit_map_mode'
  /** Leave the city plan back to the city map. */
  | 'close_city_plan'
  /** Close the app shell in-game menu. */
  | 'close_app_menu'
  /** Close the app shell mobile navigation drawer. */
  | 'close_mobile_menu'
  /** Nothing was open; the mezzanine opens its pause menu. */
  | 'open_pause_menu';

export interface EscapeStackState {
  /** Inside the mezzanine hub tab. */
  inMezzanine: boolean;
  /** Keymap overlay inside the mezzanine. */
  keymapOpen?: boolean;
  /** City-plan screen inside the mezzanine. */
  cityPlanOpen?: boolean;
  /** 3D map screen inside the mezzanine. */
  mapModeOpen?: boolean;
  /** Mezzanine pause menu. */
  pauseMenuOpen?: boolean;
  /** App shell menu (the "in-game menu" overlay). */
  appMenuOpen?: boolean;
  /** App shell mobile navigation drawer. */
  mobileMenuOpen?: boolean;
}

/**
 * The overlay stack, top first. Mezzanine overlays sit above the app shell:
 * the hub is a child screen, so anything it owns closes before the shell menu.
 * Within the hub the 0.3.7 order is kept: keymap, then city plan, then 3D,
 * then the pause menu, and a press with nothing open opens the pause menu.
 */
export function resolveEscape(state: EscapeStackState): EscapeAction | null {
  if (state.inMezzanine) {
    if (state.keymapOpen) return 'close_keymap';
    if (state.cityPlanOpen) return 'close_city_plan';
    if (state.mapModeOpen) return 'exit_map_mode';
    if (state.pauseMenuOpen) return 'close_pause_menu';
    // The shell drawer may still be open over the hub; it wins over "open menu".
    if (state.mobileMenuOpen) return 'close_mobile_menu';
    // An app-menu overlay above the hub closes before the hub opens its menu.
    if (state.appMenuOpen) return 'close_app_menu';
    return 'open_pause_menu';
  }

  // Hub-only overlays do not exist in the shell; ignore stale flags from a
  // previous tab so the resolver stays a single source of truth.
  // One press closes only the most recently opened shell surface.
  if (state.mobileMenuOpen) return 'close_mobile_menu';
  if (state.appMenuOpen) return 'close_app_menu';
  return null;
}

/**
 * True when the action belongs to the mezzanine hub. The shell listener uses
 * this to stand down so a single press never closes a hub overlay and a shell
 * menu together.
 */
export function isMezzanineEscapeAction(action: EscapeAction | null): boolean {
  return action === 'close_keymap'
    || action === 'close_city_plan'
    || action === 'exit_map_mode'
    || action === 'close_pause_menu'
    || action === 'open_pause_menu';
}
