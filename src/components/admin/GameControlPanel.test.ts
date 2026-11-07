import { describe, expect, it } from "vitest";
import { generateCity, placeBuilding, cityStats } from "../../cityBuilder";
import {
  serializeCityPlan,
  normalizeCityPlanSave,
  restoreCityPlan,
} from "../../cityPlanState";

// The panel's field schemas are the contract between the form and the model:
// every value that reaches the game must already be normalized here.
import { validateForm, type GameFieldSpec } from "./GameControlPanel";

interface PlanForm {
  seed: string;
  size: string;
  pitch: string;
}

const PLAN_FIELDS: GameFieldSpec<PlanForm>[] = [
  {
    key: "seed",
    label: "Seed",
    kind: "number",
    validate: (raw) => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 1 && n <= 999_999
        ? { ok: true, value: String(n) }
        : { ok: false, error: "seed" };
    },
  },
  {
    key: "size",
    label: "Size",
    kind: "number",
    validate: (raw) => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 20 && n <= 80
        ? { ok: true, value: String(n) }
        : { ok: false, error: "size" };
    },
  },
  {
    key: "pitch",
    label: "Pitch",
    kind: "number",
    validate: (raw) => {
      const n = Number(raw);
      return Number.isSafeInteger(n) && n >= 3 && n <= 10
        ? { ok: true, value: String(n) }
        : { ok: false, error: "pitch" };
    },
  },
];

describe("validateForm", () => {
  it("accepts a valid project form", () => {
    const result = validateForm(PLAN_FIELDS, {
      seed: "1101",
      size: "40",
      pitch: "8",
    });
    expect(result.ok).toBe(true);
  });

  it("reports every invalid field at once", () => {
    const result = validateForm(PLAN_FIELDS, {
      seed: "0",
      size: "500",
      pitch: "1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "pitch",
      "seed",
      "size",
    ]);
  });

  it("rejects non-numeric input instead of coercing it", () => {
    const result = validateForm(PLAN_FIELDS, {
      seed: "abc",
      size: "40",
      pitch: "8",
    });
    expect(result.ok).toBe(false);
  });
});

describe("city generation with a custom pitch", () => {
  it("keeps the default layout when pitch is omitted", () => {
    const a = generateCity(1101);
    const b = generateCity(1101, 40, 8);
    expect(a.blocks.length).toBe(b.blocks.length);
    expect(a.cells[0][2]).toEqual(b.cells[0][2]);
  });

  it("produces more blocks with a smaller pitch", () => {
    const wide = generateCity(1101, 40, 8);
    const dense = generateCity(1101, 40, 4);
    expect(dense.blocks.length).toBeGreaterThan(wide.blocks.length);
  });

  it("clamps a pitch that leaves no room for a block", () => {
    const city = generateCity(1101, 40, 1);
    expect(city.blocks.length).toBeGreaterThan(0);
  });
});

describe("panel round-trip through the save schema", () => {
  it("serializes, validates and restores a city built through the panel", () => {
    const city = generateCity(4242, 40, 8);
    const lot = city.blocks[0].lots[0];
    let placed = false;
    for (let y = 0; y < city.size && !placed; y++) {
      for (let x = 0; x < city.size && !placed; x++) {
        const cell = city.cells[y][x];
        if (cell.type === "lot" && cell.lot === lot) {
          placed = placeBuilding(city, x, y, "shop").ok;
        }
      }
    }
    expect(placed).toBe(true);
    expect(cityStats(city).building).toBe(1);

    const save = serializeCityPlan(city, 4242, {
      savedAt: 1_000,
      wasOpenAtSave: true,
    });
    expect(save).not.toBeNull();
    const normalized = normalizeCityPlanSave(JSON.parse(JSON.stringify(save)));
    expect(normalized).not.toBeNull();

    const restored = restoreCityPlan(normalized, 4242, 1_000);
    expect(cityStats(restored.city).building).toBe(1);
  });
});
