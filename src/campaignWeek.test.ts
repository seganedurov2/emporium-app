import { describe, expect, it } from 'vitest';
import { advanceCampaignWeek, type WeeklyDeps } from './campaignWeek';
import { createInitialCampaign } from './saveState';

function makeDeps(overrides: Partial<WeeklyDeps> = {}): WeeklyDeps {
  return {
    showNotify: () => {},
    pushHospitalNotice: () => {},
    offDutyExhaustionRecovery: 8,
    queuedRaids: 0,
    maxQueuedRaids: 3,
    hospitalLevel: 0,
    hospitalStaff: { nurses: 0, midwives: 0, nurseBonus: 0, midwifeBonus: 0 },
    hospitalPsychologistsOnDuty: [],
    gameRecords: { campaignsCompleted: 0, campaignsWon: 0, bestWeek: 0 } as WeeklyDeps['gameRecords'],
    leaderboard: [],
    ...overrides
  };
}

describe('advanceCampaignWeek', () => {
  it('advances exactly one week from the saved week', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps());

    expect(result.nextState).not.toBe(campaign);
    expect(result.nextState.week).toBe(campaign.week + 1);
    expect(result.weekNumber).toBe(campaign.week + 1);
    expect(result.notify).toContain(String(campaign.week + 1));
    expect(result.nextState.lastWeeklyReport?.week).toBe(campaign.week + 1);
  });

  it('reports the meta progress and the records it produced', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps());

    expect(result.nextState.metaProgress.stats.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(result.gameRecords.bestWeek).toBeGreaterThanOrEqual(campaign.week + 1);
    expect(result.campaignEnded).toBe(false);
    expect(result.ending).toBeNull();
  });

  it('never rolls ambushes while the caller reports a full queue', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps({ queuedRaids: 3, maxQueuedRaids: 3 }));
    expect(result.pendingRaids).toHaveLength(0);
  });

  it('keeps the save shape: the next state still migrates', async () => {
    const { migrateCampaignState } = await import('./saveState');
    const campaign = createInitialCampaign({ fresh: true });
    const result = advanceCampaignWeek(campaign, makeDeps());
    const roundTripped = migrateCampaignState(JSON.parse(JSON.stringify(result.nextState)));

    expect(roundTripped.week).toBe(result.nextState.week);
    expect(roundTripped.funds).toBe(result.nextState.funds);
    expect(roundTripped.mezzanine.offset).toEqual(result.nextState.mezzanine.offset);
  });
});
