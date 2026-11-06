import { describe, expect, it } from 'vitest';
import { isMezzanineEscapeAction, resolveEscape, type EscapeStackState } from './escapeStack';

const HUB_OVERLAYS = ['keymapOpen', 'cityPlanOpen', 'mapModeOpen', 'pauseMenuOpen'] as const;
const SHELL_OVERLAYS = ['appMenuOpen', 'mobileMenuOpen', 'notificationsOpen'] as const;

/** Every on/off combination of the given flags. */
function permutations(keys: readonly (keyof EscapeStackState)[]): EscapeStackState[] {
  return Array.from({ length: 1 << keys.length }, (_, mask) => {
    const state: EscapeStackState = { inMezzanine: false };
    keys.forEach((key, index) => {
      (state as unknown as Record<string, unknown>)[key] = Boolean(mask & (1 << index));
    });
    return state;
  });
}

const stackKeys = [...HUB_OVERLAYS, ...SHELL_OVERLAYS];

describe('escape stack resolver', () => {
  it('does nothing outside the hub when no shell overlay is open', () => {
    expect(resolveEscape({ inMezzanine: false })).toBeNull();
  });

  it('opens the pause menu when the hub has nothing open', () => {
    expect(resolveEscape({ inMezzanine: true })).toBe('open_pause_menu');
  });

  it('closes the hub overlays top-down: keymap, city plan, 3D, pause menu', () => {
    expect(resolveEscape({ inMezzanine: true, keymapOpen: true, cityPlanOpen: true, mapModeOpen: true, pauseMenuOpen: true }))
      .toBe('close_keymap');
    expect(resolveEscape({ inMezzanine: true, cityPlanOpen: true, mapModeOpen: true, pauseMenuOpen: true }))
      .toBe('close_city_plan');
    expect(resolveEscape({ inMezzanine: true, mapModeOpen: true, pauseMenuOpen: true }))
      .toBe('exit_map_mode');
    expect(resolveEscape({ inMezzanine: true, pauseMenuOpen: true })).toBe('close_pause_menu');
  });

  it('closes the mobile drawer before the app menu in the shell', () => {
    expect(resolveEscape({ inMezzanine: false, mobileMenuOpen: true, appMenuOpen: true }))
      .toBe('close_mobile_menu');
    expect(resolveEscape({ inMezzanine: false, appMenuOpen: true })).toBe('close_app_menu');
  });

  it('gives the hub priority over the app shell menu', () => {
    expect(resolveEscape({ inMezzanine: true, pauseMenuOpen: true, appMenuOpen: true }))
      .toBe('close_pause_menu');
    expect(resolveEscape({ inMezzanine: true, cityPlanOpen: true, appMenuOpen: true, mobileMenuOpen: true }))
      .toBe('close_city_plan');
  });

  it('closes a shell drawer through the hub before opening the hub menu', () => {
    expect(resolveEscape({ inMezzanine: true, mobileMenuOpen: true })).toBe('close_mobile_menu');
    expect(resolveEscape({ inMezzanine: true, appMenuOpen: true })).toBe('close_app_menu');
  });

  it('closes the notification dropdown alone, above every other overlay', () => {
    expect(resolveEscape({ inMezzanine: false, notificationsOpen: true })).toBe('close_notifications');
    expect(resolveEscape({ inMezzanine: false, notificationsOpen: true, appMenuOpen: true }))
      .toBe('close_notifications');
    expect(resolveEscape({ inMezzanine: true, notificationsOpen: true, pauseMenuOpen: true }))
      .toBe('close_notifications');
    expect(resolveEscape({ inMezzanine: true, notificationsOpen: true, keymapOpen: true }))
      .toBe('close_notifications');
  });

  it('returns exactly one action for every permutation', () => {
    for (const inMezzanine of [false, true]) {
      for (const perm of permutations(stackKeys)) {
        const state: EscapeStackState = { ...perm, inMezzanine };
        const action = resolveEscape(state);
        // Hub-only flags are ignored outside the hub, so they do not count as open.
        const anythingOpen = (inMezzanine && HUB_OVERLAYS.some(key => state[key]))
          || SHELL_OVERLAYS.some(key => state[key]);
        if (!inMezzanine && !anythingOpen) {
          expect(action).toBeNull();
        } else if (inMezzanine && !anythingOpen) {
          expect(action).toBe('open_pause_menu');
        } else {
          expect(action).not.toBeNull();
          // A second press acts on the remaining stack, so the first one closed one layer.
          expect(typeof action).toBe('string');
        }
      }
    }
  });

  it('closes exactly one overlay per press, layer by layer', () => {
    // Each action clears the flag it owns; replaying the resolver on the
    // remaining stack must never repeat an action and must end with nothing
    // open (or the hub pause menu, which is the "nothing open" state).
    const flagFor: Record<string, keyof EscapeStackState> = {
      close_keymap: 'keymapOpen',
      close_city_plan: 'cityPlanOpen',
      exit_map_mode: 'mapModeOpen',
      close_pause_menu: 'pauseMenuOpen',
      close_app_menu: 'appMenuOpen',
      close_mobile_menu: 'mobileMenuOpen',
      close_notifications: 'notificationsOpen'
    };
    for (const inMezzanine of [false, true]) {
      for (const perm of permutations(stackKeys)) {
        let state: EscapeStackState = { ...perm, inMezzanine };
        const seen = new Set<string>();
        for (let press = 0; press < stackKeys.length + 1; press++) {
          const action = resolveEscape(state);
          if (action === null || action === 'open_pause_menu') break;
          expect(seen.has(action)).toBe(false);
          seen.add(action);
          const flag = flagFor[action];
          expect(state[flag]).toBe(true);
          state = { ...state, [flag]: false };
        }
        // Outside the hub the hub-only flags are stale and never close.
        const stillOpen = stackKeys.filter(key => state[key] && (inMezzanine || !HUB_OVERLAYS.includes(key as typeof HUB_OVERLAYS[number])));
        expect(stillOpen).toEqual([]);
      }
    }
  });

  it('marks hub actions so the shell listener can stand down', () => {
    expect(isMezzanineEscapeAction('close_city_plan')).toBe(true);
    expect(isMezzanineEscapeAction('close_pause_menu')).toBe(true);
    expect(isMezzanineEscapeAction('exit_map_mode')).toBe(true);
    expect(isMezzanineEscapeAction('open_pause_menu')).toBe(true);
    expect(isMezzanineEscapeAction('close_app_menu')).toBe(false);
    expect(isMezzanineEscapeAction('close_mobile_menu')).toBe(false);
    expect(isMezzanineEscapeAction('close_notifications')).toBe(false);
    expect(isMezzanineEscapeAction(null)).toBe(false);
  });
});
