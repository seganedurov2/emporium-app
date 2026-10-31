import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  CITY_RADIUS,
  cityVisibleRect,
  heightColor,
  regionTileCount,
  shade,
} from "./mezzanineRender";

describe("heightColor", () => {
  it("maps elevation bands to terrain colours", () => {
    expect(heightColor(0)).toBe("#4a9b3c");
    expect(heightColor(0.3)).toBe("#6aa84f");
    expect(heightColor(0.5)).toBe("#8b7355");
    expect(heightColor(0.7)).toBe("#7a6244");
    expect(heightColor(0.9)).toBe("#6b5b4a");
  });
});

describe("shade", () => {
  it("brightens and darkens without overflowing a channel", () => {
    expect(shade("#ffffff", 2)).toBe("rgb(255,255,255)");
    expect(shade("#000000", 0.5)).toBe("rgb(0,0,0)");
    expect(shade("#808080", 0.5)).toBe("rgb(64,64,64)");
  });
});

describe("cityVisibleRect", () => {
  it("centres a radius-sized window on the city cell", () => {
    // At the region centre the cell is 0, so the window is clamped to the corner.
    const centred = cityVisibleRect(64, 29.3325, 52.1288, 29.3325, 52.1288, 48);
    expect(centred.startX).toBe(0);
    expect(centred.endX).toBe(CITY_RADIUS);
    expect(centred.startY).toBe(0);
    expect(centred.endY).toBe(CITY_RADIUS);

    // A city ~1.5 tiles east lands inside the map and gets a full window.
    const rect = cityVisibleRect(64, 30.4525, 52.1288, 29.3325, 52.1288, 48);
    expect(rect.startX).toBe(0);
    expect(rect.endX).toBe(CITY_RADIUS * 2);
    expect(rect.centerX).toBe(CITY_RADIUS);
    expect(rect.startY).toBe(0);
    expect(rect.endY).toBe(CITY_RADIUS);
  });

  it("clamps the window to the map bounds instead of going negative", () => {
    const rect = cityVisibleRect(64, 40, 70, 20, 50, 32);
    expect(rect.startX).toBeGreaterThanOrEqual(0);
    expect(rect.startY).toBeGreaterThanOrEqual(0);
    expect(rect.endX).toBeLessThanOrEqual(64);
    expect(rect.endY).toBeLessThanOrEqual(64);
    expect(rect.endX - rect.startX).toBeLessThanOrEqual(CITY_RADIUS * 2);
    expect(rect.endY - rect.startY).toBeLessThanOrEqual(CITY_RADIUS * 2);
  });

  it("flattens the window for a city far outside the region", () => {
    // 20° west of the reference puts the cell at -300. Only the X slice is
    // empty; Y stays centred on the reference row.
    const rect = cityVisibleRect(64, 10, 50, 30, 50, 48);
    expect(rect.startX).toBe(0);
    expect(rect.endX).toBe(0);
    expect(rect.endY - rect.startY).toBe(CITY_RADIUS);
  });
});

describe("region tile budget", () => {
  it("scales quadratically with the map size", () => {
    expect(regionTileCount(64)).toBe(4096);
    expect(regionTileCount(200)).toBe(40000);
  });

  it("chunks a region map into cache-friendly blocks", () => {
    expect(Math.ceil(64 / CHUNK_SIZE)).toBe(4);
    expect(Math.ceil(200 / CHUNK_SIZE)).toBe(13);
  });

  it("keeps a radius window far cheaper than a full region pass", () => {
    const windowTiles = (CITY_RADIUS * 2) * (CITY_RADIUS * 2);
    expect(windowTiles).toBeLessThan(regionTileCount(64) / 2);
  });
});
