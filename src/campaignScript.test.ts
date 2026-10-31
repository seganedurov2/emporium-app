import { describe, expect, it } from "vitest";
import { formatMoney } from "./currency";
import {
  CAMPAIGN_ACTS,
  actForWeek,
  advanceCampaignScript,
  createCampaignScript,
  evaluateScript,
  formatShortMoney,
  normalizeCampaignScript,
  type ScriptSnapshot,
} from "./campaignScript";

const base: ScriptSnapshot = {
  week: 12,
  funds: 125_000,
  reputation: 85,
  activeVenues: 1,
  employees: 2,
  dealsCompleted: 0,
  cityHubUnlocked: false,
  isBankrupt: false,
};

describe("campaign acts", () => {
  it("covers weeks 1..100 without gaps or overlaps", () => {
    expect(CAMPAIGN_ACTS[0].weeks[0]).toBe(1);
    for (let i = 1; i < CAMPAIGN_ACTS.length; i++) {
      expect(CAMPAIGN_ACTS[i].weeks[0]).toBe(CAMPAIGN_ACTS[i - 1].weeks[1] + 1);
    }
    expect(CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1].weeks[1]).toBe(100);
  });

  it("maps a week to the act that contains it", () => {
    expect(actForWeek(1).id).toBe("founding");
    expect(actForWeek(30).id).toBe("founding");
    expect(actForWeek(31).id).toBe("expansion");
    expect(actForWeek(60).id).toBe("expansion");
    expect(actForWeek(61).id).toBe("syndicate");
    expect(actForWeek(85).id).toBe("syndicate");
    expect(actForWeek(86).id).toBe("reckoning");
    expect(actForWeek(100).id).toBe("reckoning");
  });

  it("clamps out-of-range weeks instead of returning undefined", () => {
    expect(actForWeek(0).id).toBe("founding");
    expect(actForWeek(999).id).toBe("reckoning");
    expect(actForWeek(Number.NaN).id).toBe("founding");
  });
});

describe("evaluateScript", () => {
  it("reports partial progress for a fresh campaign", () => {
    const progress = evaluateScript(base, 12);
    expect(progress.act.id).toBe("founding");
    expect(progress.actComplete).toBe(false);
    expect(progress.weeksLeft).toBe(18);
    expect(progress.objectives).toHaveLength(3);
    const capital = progress.objectives.find(
      (item) => item.objective.id === "capital",
    );
    expect(capital?.done).toBe(false);
    expect(capital?.percent).toBeGreaterThan(30);
    expect(capital?.percent).toBeLessThan(50);
  });

  it("marks the act complete when every objective is met", () => {
    const progress = evaluateScript(
      { ...base, funds: 400_000, employees: 8, activeVenues: 3 },
      20,
    );
    expect(progress.actComplete).toBe(true);
    expect(progress.objectiveProgress).toBe(1);
    expect(progress.objectives.every((item) => item.done)).toBe(true);
  });

  it("counts previous acts that were already met", () => {
    const strong: ScriptSnapshot = {
      ...base,
      week: 40,
      funds: 800_000,
      reputation: 90,
      activeVenues: 4,
      employees: 10,
      dealsCompleted: 30,
      cityHubUnlocked: true,
    };
    const progress = evaluateScript(strong, 40);
    expect(progress.act.id).toBe("expansion");
    expect(progress.completedActs).toContain("founding");
  });

  it("never exceeds 100 percent for an objective", () => {
    const progress = evaluateScript({ ...base, funds: 9_000_000 }, 12);
    expect(progress.objectives.every((item) => item.percent <= 100)).toBe(true);
  });

  it("uses the final act for weeks past the goal", () => {
    const progress = evaluateScript(
      { ...base, week: 130, funds: 2_000_000, reputation: 60 },
      130,
    );
    expect(progress.act.id).toBe("reckoning");
    expect(progress.actComplete).toBe(true);
    expect(progress.weeksLeft).toBe(0);
  });
});

describe("campaign script persistence", () => {
  it("creates the script for the current week", () => {
    expect(createCampaignScript(12)).toEqual({
      actId: "founding",
      enteredWeek: 1,
    });
    expect(createCampaignScript(70)).toEqual({
      actId: "syndicate",
      enteredWeek: 61,
    });
  });

  it("accepts a stored act the month still belongs to", () => {
    expect(
      normalizeCampaignScript({ actId: "expansion", enteredWeek: 33 }, 40),
    ).toEqual({ actId: "expansion", enteredWeek: 33 });
  });

  it("falls back when the script is missing or corrupt", () => {
    expect(normalizeCampaignScript(undefined, 12)).toEqual(
      createCampaignScript(12),
    );
    expect(normalizeCampaignScript("junk", 70)).toEqual(
      createCampaignScript(70),
    );
    expect(normalizeCampaignScript({ actId: "nonsense" }, 40)).toEqual(
      createCampaignScript(40),
    );
  });

  it("advances a stale act instead of trusting it", () => {
    // A save from act 1 loaded at week 70 must not stay in act 1.
    expect(
      normalizeCampaignScript({ actId: "founding", enteredWeek: 1 }, 70),
    ).toEqual({ actId: "syndicate", enteredWeek: 61 });
  });

  it("repairs a non-numeric enteredWeek", () => {
    expect(
      normalizeCampaignScript({ actId: "expansion", enteredWeek: "x" }, 40),
    ).toEqual({ actId: "expansion", enteredWeek: 31 });
  });

  it("advances the script when the week crosses into a new act", () => {
    const current = createCampaignScript(20);
    expect(advanceCampaignScript(current, 25)).toBe(current);
    expect(advanceCampaignScript(current, 31)).toEqual({
      actId: "expansion",
      enteredWeek: 31,
    });
  });
});

describe("formatShortMoney", () => {
  it("formats the goal currency the same way as the rest of the game", () => {
    // The economy is USD internally, but every screen shows BTC.
    expect(formatShortMoney(1_000_000)).toBe(formatMoney(1_000_000));
    expect(formatShortMoney(1_000_000).startsWith("₿")).toBe(true);
    expect(formatShortMoney(1_000_000)).not.toContain("$");
  });
});
