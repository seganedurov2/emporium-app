import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACHIEVEMENTS,
  CAMPAIGN_GOAL_FUNDS,
  CAMPAIGN_GOAL_WEEK,
  applyWeeklyStats,
  buildSnapshot,
  checkCampaignGoal,
  createEmptyRecords,
  createInitialMetaProgress,
  evaluateAchievements,
  loadGameRecords,
  loadLeaderboard,
  prestigeRevenueMultiplier,
  prestigeStartingFunds,
  recordCampaignResult,
  registerAuctionSale,
  registerBuildingConstructed,
  registerCaravanDispatched,
  registerLoanRepaid,
  registerLoanTaken,
  saveGameRecords,
  saveLeaderboard,
  updateGameRecords,
  type LeaderboardEntry
} from './metaProgressEngine';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }
};

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', localStorageMock);
});

const baseSnapshot = {
  week: 1,
  funds: 1000,
  reputation: 80,
  isBankrupt: false,
  rosterSize: 2,
  slaveCount: 0,
  employeeCount: 0,
  buildingCount: 0,
  dependentsCount: 0
};

const report = {
  week: 2,
  revenue: { venue: 5000, caravans: 3000, captureOps: 0, contracts: 2000, salon: 1000 },
  expenses: { wages: 2000, hospital: 500, restZone: 300, staffSlots: 100, loanPayment: 0 },
  netIncome: 8100,
  treasuryAfter: 9100
};

describe('metaProgressEngine', () => {
  it('starts with empty achievements and zeroed stats', () => {
    const meta = createInitialMetaProgress();
    expect(Object.keys(meta.achievements)).toHaveLength(0);
    expect(meta.stats.totalRevenue).toBe(0);
    expect(meta.prestige.level).toBe(0);
    expect(meta.goalStatus).toBe('ongoing');
    expect(meta.endingWeek).toBeNull();
  });

  it('defines unique achievements', () => {
    const ids = ACHIEVEMENTS.map(def => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('first_auction_sale');
    expect(ids).toContain('week_100');
    expect(ids).toContain('bankruptcy');
    expect(ids).toContain('campaign_victory');
  });

  it('accumulates lifetime stats from weekly reports', () => {
    let meta = createInitialMetaProgress();
    meta = applyWeeklyStats(meta, report, {
      caravansCompleted: 1,
      raidsSurvived: 1,
      captureOpsCompleted: 1,
      slavesAcquired: 2,
      employeesHired: 1,
      births: 1
    });
    expect(meta.stats.totalRevenue).toBe(11000);
    expect(meta.stats.totalExpenses).toBe(2900);
    expect(meta.stats.totalNetIncome).toBe(8100);
    expect(meta.stats.peakFunds).toBe(9100);
    expect(meta.stats.peakWeek).toBe(2);
    expect(meta.stats.caravansCompleted).toBe(1);
    expect(meta.stats.raidsSurvived).toBe(1);
    expect(meta.stats.captureOpsCompleted).toBe(1);
    expect(meta.stats.slavesAcquired).toBe(2);
    expect(meta.stats.employeesHired).toBe(1);
    expect(meta.stats.births).toBe(1);

    // A second week keeps accumulating and tracks a new peak.
    meta = applyWeeklyStats(meta, { ...report, week: 3, treasuryAfter: 20000 }, {});
    expect(meta.stats.totalRevenue).toBe(22000);
    expect(meta.stats.peakFunds).toBe(20000);
    expect(meta.stats.peakWeek).toBe(3);
  });

  it('registers between-week events', () => {
    let meta = createInitialMetaProgress();
    meta = registerAuctionSale(meta, 75000);
    meta = registerAuctionSale(meta, 120000);
    meta = registerCaravanDispatched(meta);
    meta = registerBuildingConstructed(meta);
    meta = registerLoanTaken(meta);
    meta = registerLoanTaken(meta);
    meta = registerLoanRepaid(meta);
    expect(meta.stats.auctionsCompleted).toBe(2);
    expect(meta.stats.auctionBestSale).toBe(120000);
    expect(meta.stats.caravansDispatched).toBe(1);
    expect(meta.stats.buildingsConstructed).toBe(1);
    expect(meta.stats.loansTaken).toBe(2);
    expect(meta.stats.loansRepaid).toBe(1);
  });

  it('unlocks week and fortune achievements from the snapshot', () => {
    const meta = createInitialMetaProgress();
    const { newlyUnlocked } = evaluateAchievements(meta, { ...baseSnapshot, week: 10, funds: 150000 });
    expect(newlyUnlocked).toContain('week_10');
    expect(newlyUnlocked).toContain('tycoon_100k');
    expect(newlyUnlocked).not.toContain('week_50');
    expect(newlyUnlocked).not.toContain('tycoon_1m');
  });

  it('unlocks auction and caravan achievements from stats', () => {
    let meta = createInitialMetaProgress();
    meta = registerAuctionSale(meta, 600000);
    meta = applyWeeklyStats(meta, report, { caravansDispatched: 1, caravansCompleted: 1, raidsSurvived: 1 });
    const { newlyUnlocked } = evaluateAchievements(meta, baseSnapshot);
    expect(newlyUnlocked).toContain('first_auction_sale');
    expect(newlyUnlocked).toContain('auction_whale');
    expect(newlyUnlocked).toContain('first_caravan');
    expect(newlyUnlocked).toContain('raid_survivor');
  });

  it('unlocks the bankruptcy achievement and keeps already unlocked ones', () => {
    const meta = createInitialMetaProgress();
    const first = evaluateAchievements(meta, { ...baseSnapshot, isBankrupt: true });
    expect(first.newlyUnlocked).toContain('bankruptcy');
    const second = evaluateAchievements({ ...meta, achievements: first.achievements }, { ...baseSnapshot, isBankrupt: true });
    expect(second.newlyUnlocked).not.toContain('bankruptcy');
  });

  it('builds a snapshot from campaign state', () => {
    const snapshot = buildSnapshot({
      week: 5,
      funds: 20000,
      reputation: 90,
      isBankrupt: false,
      roster: [{ isSlave: true }, { isSlave: false }, { isSlave: true }],
      employees: [{}, {}],
      auxiliaryBuildings: [{ level: 0 }, { level: 2 }],
      dependents: [{}]
    });
    expect(snapshot.week).toBe(5);
    expect(snapshot.slaveCount).toBe(2);
    expect(snapshot.employeeCount).toBe(2);
    expect(snapshot.buildingCount).toBe(1);
    expect(snapshot.dependentsCount).toBe(1);
  });

  it('declares victory only at the goal week with the goal capital and reputation', () => {
    const meta = createInitialMetaProgress();
    expect(checkCampaignGoal({ ...baseSnapshot, week: CAMPAIGN_GOAL_WEEK, funds: CAMPAIGN_GOAL_FUNDS, reputation: 50 }, meta)).toBe('victory');
    expect(checkCampaignGoal({ ...baseSnapshot, week: CAMPAIGN_GOAL_WEEK, funds: CAMPAIGN_GOAL_FUNDS - 1, reputation: 50 }, meta)).toBe('ongoing');
    expect(checkCampaignGoal({ ...baseSnapshot, week: CAMPAIGN_GOAL_WEEK - 1, funds: CAMPAIGN_GOAL_FUNDS, reputation: 50 }, meta)).toBe('ongoing');
    expect(checkCampaignGoal({ ...baseSnapshot, week: CAMPAIGN_GOAL_WEEK, funds: CAMPAIGN_GOAL_FUNDS, reputation: 49 }, meta)).toBe('ongoing');
  });

  it('declares defeat on bankruptcy and keeps terminal statuses sticky', () => {
    const meta = createInitialMetaProgress();
    expect(checkCampaignGoal({ ...baseSnapshot, isBankrupt: true }, meta)).toBe('defeat');
    const defeated = { ...meta, goalStatus: 'defeat' as const };
    expect(checkCampaignGoal({ ...baseSnapshot, isBankrupt: false, funds: 10_000_000 }, defeated)).toBe('defeat');
    const victorious = { ...meta, goalStatus: 'victory' as const };
    expect(checkCampaignGoal({ ...baseSnapshot, isBankrupt: true }, victorious)).toBe('victory');
  });

  it('scales prestige multipliers', () => {
    expect(prestigeRevenueMultiplier(0)).toBe(1);
    expect(prestigeRevenueMultiplier(1)).toBe(1.25);
    expect(prestigeRevenueMultiplier(4)).toBe(2);
    expect(prestigeStartingFunds(100000, 0)).toBe(100000);
    expect(prestigeStartingFunds(100000, 2)).toBe(200000);
  });

  it('merges records and keeps the best entries', () => {
    const records = updateGameRecords(createEmptyRecords(), { ...baseSnapshot, week: 42, funds: 500000 }, 'Синдикат А');
    expect(records.bestWeek).toBe(42);
    expect(records.peakFunds).toBe(500000);
    const better = updateGameRecords(records, { ...baseSnapshot, week: 10, funds: 900000 }, 'Синдикат Б');
    expect(better.bestWeek).toBe(42);
    expect(better.bestWeekCampaign).toBe('Синдикат А');
    expect(better.peakFunds).toBe(900000);
    expect(better.peakFundsCampaign).toBe('Синдикат Б');
  });

  it('sorts the leaderboard with victories first', () => {
    const defeatEntry: LeaderboardEntry = { campaignName: 'Б', result: 'defeat', week: 200, peakFunds: 10, totalRevenue: 10, prestigeLevel: 0, date: '' };
    const victoryEntry: LeaderboardEntry = { campaignName: 'A', result: 'victory', week: 100, peakFunds: 5, totalRevenue: 5, prestigeLevel: 0, date: '' };
    const entries = recordCampaignResult([defeatEntry], victoryEntry);
    expect(entries[0].result).toBe('victory');
    expect(entries).toHaveLength(2);
  });

  it('round-trips records and leaderboard through storage', () => {
    const records = { ...createEmptyRecords(), bestWeek: 77, bestWeekCampaign: 'Тест', peakFunds: 12345, peakFundsCampaign: 'Тест', campaignsCompleted: 2, campaignsWon: 1 };
    saveGameRecords(records);
    expect(loadGameRecords()).toEqual(records);

    const entries: LeaderboardEntry[] = [
      { campaignName: 'Тест', result: 'victory', week: 100, peakFunds: 1000000, totalRevenue: 500000, prestigeLevel: 1, date: 'сегодня' }
    ];
    saveLeaderboard(entries);
    expect(loadLeaderboard()).toEqual(entries);
  });

  it('returns empty records when storage is corrupt', () => {
    storage.set('emporium_records_v1', '{not json');
    expect(loadGameRecords()).toEqual(createEmptyRecords());
    storage.set('emporium_leaderboard_v1', '[]');
    expect(loadLeaderboard()).toEqual([]);
  });
});
