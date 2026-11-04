import { it } from "vitest";
import { advanceCityEconomy, KIND_LABELS } from "./cityEconomyEngine";
import { generateCity, placeBuilding } from "./cityBuilder";
import { serializeCityPlan } from "./cityPlanState";

it("smoke: city economy report", () => {
  const city = generateCity(42);
  const lots: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  for (let y = 0; y < city.size; y++)
    for (let x = 0; x < city.size; x++) {
      const c = city.cells[y][x];
      if (c.type === "lot" && !seen.has(c.lot)) {
        seen.add(c.lot);
        lots.push({ x, y });
      }
    }
  const kinds = [
    "factory",
    "house",
    "house",
    "house",
    "house",
    "house",
    "house",
    "house",
    "house",
    "house",
    "house",
  ];
  kinds.forEach((kind, i) => {
    const r = placeBuilding(
      city,
      lots[i].x,
      lots[i].y,
      kind as "house",
      1_000_000,
    );
    r.building!.progress = 1;
  });
  const plan = serializeCityPlan(city, 42, {
    savedAt: 1_000_000,
    wasOpenAtSave: false,
  });
  const res = advanceCityEconomy({
    plan,
    week: 10,
    now: 1_000_000,
    random: () => 0,
    balance: { taxPerResident: 20, taxPerJob: 20, growthBudgetShare: 1 },
  });
  console.log("labels", JSON.stringify(KIND_LABELS));
  console.log("log", JSON.stringify(res.report.log));
});
