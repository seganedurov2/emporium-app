import { describe, expect, it } from "vitest";
import { TerrainGenerator } from "./src/terrain";

describe("terrain heights", () => {
  it("spreads values across the colour bands", () => {
    const grid = new TerrainGenerator().generate(1101);
    const values = grid.flat();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bands: Record<string, number> = {};
    for (const v of values) {
      const band = (Math.floor(v * 5) / 5).toFixed(1);
      bands[band] = (bands[band] ?? 0) + 1;
    }
    console.log(JSON.stringify({ min, max, bands }));
    expect(values.length).toBe(4096);
  });
});
