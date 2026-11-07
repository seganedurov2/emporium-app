import { describe, expect, it } from "vitest";
import {
  BOILER_DEFINITION_BY_ID,
  FUEL_STORAGE_CAP,
  addFuel,
  advanceBoilerHouseWeek,
  boilerHeatDemand,
  boilerHeatOutput,
  buildBoiler,
  createBoilerHouseState,
  fuelPurchaseCost,
  fuelWeeksRemaining,
  heatExhaustionBump,
  heatRevenueMultiplier,
  normalizeBoilerHouseState,
  planBoilerAutomation,
  repairBoiler,
  setBoilerAutomation,
  setBoilerMode,
} from "./boilerHouseEngine";

describe("boiler house automation", () => {
  const automated = (patch: Parameters<typeof setBoilerAutomation>[1] = {}) =>
    setBoilerAutomation(createBoilerHouseState(), { enabled: true, ...patch });

  it("is off by default and does nothing when disabled", () => {
    const state = createBoilerHouseState();
    expect(state.automation.enabled).toBe(false);
    const plan = planBoilerAutomation({ state, week: 1, activeVenues: 1, funds: 100000 });
    expect(plan.totalCost).toBe(0);
    expect(plan.buy.coal).toBe(0);
    expect(plan.notes[0]).toContain("выключена");
  });

  it("buys fuel up to the reserve target within the budget", () => {
    const state = automated({ reserveWeeks: 3, weeklyBudget: 20000 });
    const plan = planBoilerAutomation({ state, week: 1, activeVenues: 1, funds: 100000 });
    // 168 ед./нед. × 3 недели = 504, в баке 400 → докупить 104.
    expect(plan.buy.coal).toBe(104);
    expect(plan.fuelCost).toBe(104 * 40);
    expect(plan.totalCost).toBeLessThanOrEqual(20000);
  });

  it("never spends more than the weekly budget or the treasury", () => {
    const state = automated({ reserveWeeks: 12, weeklyBudget: 5000 });
    const plan = planBoilerAutomation({ state, week: 1, activeVenues: 1, funds: 100000 });
    expect(plan.totalCost).toBeLessThanOrEqual(5000);
    expect(plan.notes.some((note) => note.includes("бюджет"))).toBe(true);

    const poor = planBoilerAutomation({ state, week: 1, activeVenues: 1, funds: 100 });
    expect(poor.totalCost).toBeLessThanOrEqual(100);
    expect(poor.notes.some((note) => note.includes("кассой"))).toBe(true);
  });

  it("starts reserve boilers when coverage drops and stops them when heat is abundant", () => {
    const built = buildBoiler(automated({ autoStart: true, autoStop: false }), "reserve")!;
    const plan = planBoilerAutomation({ state: built, week: 1, activeVenues: 5, funds: 100000 });
    // 5 площадок + 3 служебных = 160 тепла, главный даёт 60 → нужен резерв.
    expect(plan.start).toEqual(["reserve"]);
    expect(plan.coverageAfter).toBeGreaterThan(0.5);

    const running = setBoilerMode(built, "reserve", { status: "running" });
    const stopPlan = planBoilerAutomation({
      state: setBoilerAutomation(running, { autoStop: true, autoStart: false }),
      week: 1,
      activeVenues: 0,
      funds: 100000,
    });
    // 0 площадок → 60 тепла нужно, 105 дают два котла → резерв лишний.
    // Главный котёл автоматика не гасит, резервный — да.
    expect(stopPlan.stop).toEqual(["reserve"]);
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("main");
    expect(stopPlan.stop).not.toContain("workshop");
    expect(stopPlan.stop).toEqual(["reserve"]);
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("main");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("workshop");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("main");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("workshop");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("main");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("workshop");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("main");
    expect(stopPlan.stop).toHaveLength(1);
    expect(stopPlan.stop).toContain("reserve");
    expect(stopPlan.stop).not.toContain("main");
    expect(stopPlan.coverageAfter).toBeGreaterThanOrEqual(1);
    expect(stopPlan.heatAfter).toBeGreaterThanOrEqual(stopPlan.heatDemand);
    expect(stopPlan.heatAfter).toBe(60);
    expect(stopPlan.heatDemand).toBe(60);
    expect(stopPlan.notes).toEqual([]);
    expect(stopPlan.start).toEqual([]);
    expect(stopPlan.repair).toEqual([]);
    // Главный котёл всё ещё греет 3 служебных объекта (60 тепла) и жжёт уголь,
    // поэтому автоматика докупает топливо под него, даже после того как резерв погашен.
    expect(stopPlan.buy).toEqual({ coal: 104, gas: 0, bio: 0 });
    expect(stopPlan.fuelCost).toBe(4160);
    expect(stopPlan.repairCost).toBe(0);
    expect(stopPlan.totalCost).toBe(4160);
    expect(stopPlan.heatAfter).toBe(60);
    expect(stopPlan.coverageAfter).toBe(1);
    expect(stopPlan.heatDemand).toBe(60);
    expect(stopPlan.stop).toEqual(["reserve"]);
  });

  it("repairs a broken boiler before the week is calculated", () => {
    const broken = {
      ...automated({ autoRepair: true }),
      boilers: [{ ...createBoilerHouseState().boilers[0], status: "broken" as const, wear: 60, brokenSinceWeek: 1 }],
    };
    const { state, report } = advanceBoilerHouseWeek({
      state: broken,
      week: 2,
      activeVenues: 1,
      funds: 100000,
      random: () => 0.99,
    });
    expect(report.repairCost).toBeGreaterThan(0);
    expect(report.autoSpent).toBeGreaterThan(0);
    // Отремонтирован до расчёта и сразу запущен — неделя отработана.
    expect(state.boilers[0].status).toBe("running");
    expect(state.boilers[0].wear).toBeLessThan(60);
    expect(report.autoStarted).toContain("main");
    expect(report.heatProduced).toBeGreaterThan(0);
  });

  it("keeps the loop warm across weeks without manual input", () => {
    // Один главный котёл тянет 3 площадки (60 тепла); резервный подхватывает
    // остальные, когда площадок становится больше.
    let state = buildBoiler(automated({ reserveWeeks: 4, weeklyBudget: 50000 }), "reserve")!;
    for (let week = 1; week <= 6; week += 1) {
      const result = advanceBoilerHouseWeek({
        state,
        week,
        activeVenues: 5,
        funds: 200000,
        random: () => 0.99,
      });
      state = result.state;
      // 160 тепла нужно, 105 дают два котла — автоматика держит максимум.
      expect(result.report.coverage).toBeGreaterThanOrEqual(0.5);
      expect(result.report.autoFuelBought).toBeGreaterThan(0);
    }
    // 105 тепла на 160 потребности — контур не замерзает, но и не перегрет.
    // Первая неделя стартует с 22°C, дальше температура держится выше нуля.
    expect(state.coldWeeks).toBeLessThanOrEqual(1);
    expect(state.temperature).toBeGreaterThan(0);
    expect(state.fuelStock.coal).toBeGreaterThan(0);
    expect(state.boilers.every((boiler) => boiler.status === "running")).toBe(true);
  });

  it("normalizes automation settings from a save", () => {
    const normalized = normalizeBoilerHouseState({
      automation: { enabled: true, reserveWeeks: 99, weeklyBudget: -5, preferredFuel: "bio", autoStop: true },
    });
    expect(normalized.automation.enabled).toBe(true);
    expect(normalized.automation.reserveWeeks).toBe(12);
    expect(normalized.automation.weeklyBudget).toBe(0);
    expect(normalized.automation.preferredFuel).toBe("bio");
    expect(normalized.automation.autoStop).toBe(true);
    expect(normalized.automation.autoRepair).toBe(true);
  });
});

describe("boiler house engine", () => {
  it("starts with one running coal boiler and a coal reserve", () => {
    const state = createBoilerHouseState();
    expect(state.boilers).toHaveLength(1);
    expect(state.boilers[0].status).toBe("running");
    expect(state.fuelStock.coal).toBeGreaterThan(0);
    expect(state.temperature).toBeGreaterThan(18);
  });

  it("burns fuel and keeps the loop warm when the boiler runs", () => {
    const state = createBoilerHouseState();
    const { state: next, report } = advanceBoilerHouseWeek({
      state,
      week: 1,
      activeVenues: 1,
      random: () => 0.99,
    });
    expect(next.fuelStock.coal).toBeLessThan(state.fuelStock.coal);
    expect(report.fuelSpent).toBeGreaterThan(0);
    expect(report.coverage).toBeGreaterThan(0);
    expect(next.temperature).toBeGreaterThanOrEqual(18);
    expect(next.coldWeeks).toBe(0);
  });

  it("goes cold and penalises revenue when there is no fuel", () => {
    const state = {
      ...createBoilerHouseState(),
      fuelStock: { coal: 0, gas: 0, bio: 0 },
    };
    const { state: next, report } = advanceBoilerHouseWeek({
      state,
      week: 1,
      activeVenues: 3,
      random: () => 0.99,
    });
    expect(report.coverage).toBe(0);
    expect(report.revenueMultiplier).toBeLessThan(1);
    expect(report.exhaustionBump).toBeGreaterThan(0);
    expect(next.boilers[0].status).toBe("idle");
    expect(next.coldWeeks).toBe(1);
  });

  it("breaks a boiler on a bad roll and repairs it the next week", () => {
    const state = createBoilerHouseState();
    const broken = advanceBoilerHouseWeek({
      state,
      week: 1,
      activeVenues: 1,
      random: () => 0,
    });
    expect(broken.state.boilers[0].status).toBe("broken");
    expect(broken.report.brokenBoilers).toEqual(["main"]);
    expect(broken.state.breakdowns).toBe(1);

    const repaired = advanceBoilerHouseWeek({
      state: broken.state,
      week: 2,
      activeVenues: 1,
      random: () => 0.99,
    });
    expect(repaired.state.boilers[0].status).toBe("idle");
    expect(repaired.report.repairedBoilers).toEqual(["main"]);
    expect(repaired.report.repairCost).toBeGreaterThan(0);
  });

  it("builds, repairs and reconfigures boilers", () => {
    const state = createBoilerHouseState();
    const built = buildBoiler(state, "reserve");
    expect(built?.boilers).toHaveLength(2);
    expect(buildBoiler(built!, "reserve")).toBeNull();

    const running = setBoilerMode(built!, "reserve", {
      status: "running",
      fuel: "gas",
    });
    expect(running.boilers[1].status).toBe("running");
    expect(running.boilers[1].fuel).toBe("gas");

    const worn = {
      ...running,
      boilers: running.boilers.map((b) => ({
        ...b,
        wear: 50,
        status: "broken" as const,
      })),
    };
    const repaired = repairBoiler(worn, "main");
    expect(repaired.boilers[0].wear).toBe(0);
    expect(repaired.boilers[0].status).toBe("idle");
  });

  it("caps fuel storage and prices purchases per unit", () => {
    const state = addFuel(
      createBoilerHouseState(),
      "coal",
      FUEL_STORAGE_CAP * 2,
    );
    expect(state.fuelStock.coal).toBe(FUEL_STORAGE_CAP);
    expect(fuelPurchaseCost("gas", 10)).toBe(900);
  });

  it("reports how many weeks the stock lasts", () => {
    const state = createBoilerHouseState();
    const weeks = fuelWeeksRemaining(state);
    expect(weeks.coal).toBeGreaterThan(0);
    expect(weeks.gas).toBe(Infinity);
  });

  it("scales heat demand with the number of heated venues", () => {
    expect(boilerHeatDemand(0)).toBeLessThan(boilerHeatDemand(3));
    expect(
      boilerHeatOutput(createBoilerHouseState().boilers[0]),
    ).toBeGreaterThan(0);
  });

  it("maps coverage to revenue and exhaustion", () => {
    expect(heatRevenueMultiplier(1)).toBeGreaterThan(1);
    expect(heatRevenueMultiplier(0)).toBeLessThan(1);
    expect(heatExhaustionBump(1)).toBe(0);
    expect(heatExhaustionBump(0)).toBeGreaterThan(0);
  });

  it("normalizes legacy and broken saves", () => {
    expect(normalizeBoilerHouseState(undefined).boilers).toHaveLength(1);
    const normalized = normalizeBoilerHouseState({
      boilers: [
        {
          id: "main",
          status: "broken",
          wear: 500,
          hoursPerWeek: 999,
          fuel: "plasma",
        },
      ],
      fuelStock: { coal: -5, gas: 10 },
      temperature: 5,
    });
    expect(normalized.boilers[0].wear).toBe(100);
    expect(normalized.boilers[0].hoursPerWeek).toBe(168);
    expect(normalized.boilers[0].fuel).toBe("coal");
    expect(normalized.fuelStock.coal).toBe(0);
    expect(normalized.fuelStock.gas).toBe(10);
    expect(normalized.temperature).toBe(5);
    expect(BOILER_DEFINITION_BY_ID.main.power).toBeGreaterThan(0);
  });
});
