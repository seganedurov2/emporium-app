import { describe, expect, it } from "vitest";
import {
  MEZZANINE_KEYMAP_ROWS,
  MEZZANINE_REGION_SHORTCUTS,
  accumulateWheelZoom,
  resolveMezzanineShortcut,
  type ShortcutContext,
} from "./mezzanineShortcuts";
import {
  normalizeMezzanineViewState,
  type MezzanineViewMode,
} from "./mezzanineViewState";

const base: ShortcutContext = {
  typing: false,
  overlayOpen: false,
  hasRegion: true,
};

describe("resolveMezzanineShortcut", () => {
  it("jumps to a region by digit", () => {
    expect(resolveMezzanineShortcut("3", base)).toEqual({
      type: "region",
      index: 2,
    });
    expect(resolveMezzanineShortcut("7", base)).toEqual({
      type: "region",
      index: 6,
    });
    expect(MEZZANINE_REGION_SHORTCUTS[2].id).toBe("gomel");
  });

  it("switches view modes with letter hotkeys", () => {
    expect(resolveMezzanineShortcut("c", base)).toEqual({ type: "toggleCity" });
    expect(resolveMezzanineShortcut("R", base)).toEqual({
      type: "viewMode",
      mode: "region",
    });
    expect(resolveMezzanineShortcut("m", base)).toEqual({
      type: "viewMode",
      mode: "city",
    });
    expect(resolveMezzanineShortcut("b", base)).toEqual({
      type: "viewMode",
      mode: "city_plan",
    });
    expect(resolveMezzanineShortcut("k", base)).toEqual({
      type: "viewMode",
      mode: "3d",
    });
  });

  it("does not fire while typing in a field", () => {
    expect(resolveMezzanineShortcut("c", { ...base, typing: true })).toBeNull();
    expect(resolveMezzanineShortcut("?", { ...base, typing: true })).toBeNull();
  });

  it("keeps the keymap reachable but blocks map keys while an overlay is open", () => {
    expect(
      resolveMezzanineShortcut("?", { ...base, overlayOpen: true }),
    ).toEqual({ type: "keymap" });
    expect(
      resolveMezzanineShortcut("c", { ...base, overlayOpen: true }),
    ).toBeNull();
    expect(
      resolveMezzanineShortcut("Tab", { ...base, overlayOpen: true }),
    ).toBeNull();
  });

  it("requires a region before city-level keys", () => {
    const noRegion = { ...base, hasRegion: false };
    expect(resolveMezzanineShortcut("c", noRegion)).toBeNull();
    expect(resolveMezzanineShortcut("1", noRegion)).toEqual({
      type: "region",
      index: 0,
    });
  });

  it("zooms with plus and minus", () => {
    expect(resolveMezzanineShortcut("+", base)).toEqual({
      type: "zoom",
      delta: 8,
    });
    expect(resolveMezzanineShortcut("-", base)).toEqual({
      type: "zoom",
      delta: -8,
    });
    expect(resolveMezzanineShortcut("Tab", base)).toEqual({ type: "sections" });
  });
});

describe("mezzanine keymap", () => {
  it("documents every hotkey once", () => {
    const keys = MEZZANINE_KEYMAP_ROWS.map((row) => row.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("Esc");
    expect(keys).toContain("?");
  });
});

describe("accumulateWheelZoom", () => {
  it("collapses several wheel events into one zoom delta", () => {
    expect(accumulateWheelZoom(0, -100)).toBe(5);
    expect(accumulateWheelZoom(accumulateWheelZoom(0, -100), -100)).toBe(10);
  });
});

describe("mezzanine view state and hotkeys stay in sync", () => {
  it("every mode a hotkey produces survives a save round-trip", () => {
    for (const key of ["r", "m", "b", "k"]) {
      const action = resolveMezzanineShortcut(key, base);
      expect(action?.type).toBe("viewMode");
      const mode = (action as { mode: MezzanineViewMode }).mode;
      const stored = normalizeMezzanineViewState({
        viewMode: mode,
        selectedCity:
          mode === "region"
            ? null
            : { name: "Калинковичи", lat: 52.1, lon: 29.3, seed: 1101 },
      });
      expect(stored.viewMode).toBe(mode);
    }
  });
});
