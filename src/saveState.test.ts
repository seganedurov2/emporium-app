import { describe, it, expect } from 'vitest';
import { migrateCampaignState, createInitialCampaign } from './saveState';

describe('migrateCampaignState (backward compatibility)', () => {
  it('throws on non-object input', () => {
    expect(() => migrateCampaignState(undefined)).toThrow();
    expect(() => migrateCampaignState(null)).toThrow();
    expect(() => migrateCampaignState('not an object')).toThrow();
    expect(() => migrateCampaignState(42)).toThrow();
  });

  it('normalizes a very old save without new fields without crashing', () => {
    const oldSave = {
      version: 1,
      week: 3,
      funds: 5000,
      reputation: 42,
      isBankrupt: false,
      isReceivership: false,
      roster: [],
      marketPool: [],
      caravans: [],
      employees: [],
      employeeCandidates: [],
      auxiliaryBuildings: [],
      log: []
    } as unknown;

    const state = migrateCampaignState(oldSave);

    expect(state.version).toBe(5);
    expect(state.week).toBe(3);
    expect(state.funds).toBe(5000);
    expect(state.reputation).toBe(42);

    // New 0.4.x fields must exist with safe defaults, not be undefined.
    expect(state.boilerHouse).toBeDefined();
    expect(state.warehouse).toBeDefined();
    expect(state.cityPlan).toBeDefined();
    expect(state.cityEconomy).toBeDefined();
    expect(state.auctionHouse).toBeDefined();
    expect(state.cityHubOpenedAt).toBeNull();
  });

  it('preserves provided new fields through normalization', () => {
    const saveWithNewFields = {
      week: 7,
      funds: 12345,
      reputation: 88,
      boilerHouse: {
        boilers: [],
        fuel: { coal: 100, gas: 0, bio: 0 },
        automation: { enabled: true, reserveWeeks: 2, minCoal: 10, minGas: 0, minBio: 0, autoBuy: true, autoRepair: true },
        temperature: 20,
        logs: []
      },
      warehouse: { level: 3, capacity: 3000, occupancy: 1200, automation: true },
      cityPlan: null,
      cityEconomy: { treasury: 0, weeklyIncome: 0, weeklyUpkeep: 0, expenses: { upkeep: 0, unemployment: 0 }, report: { week: 0, income: 0, upkeep: 0, unemployment: 0, construction: 0 } },
      auctionHouse: { level: 1, pendingLots: [], recentSales: [], inspections: [], pendingSaleConsents: [] },
      log: ['Старый лог запись']
    } as unknown;

    const state = migrateCampaignState(saveWithNewFields);

    expect(state.version).toBe(5);
    expect(state.week).toBe(7);
    expect(state.funds).toBe(12345);
    expect(state.log).toContain('Старый лог запись');
    expect(state.warehouse.automation).toBeDefined();
    expect(typeof state.warehouse.automation).toBe('object');
    // cityPlan preserved (null)
    expect(state.cityPlan).toBeNull();
  });

  it('createInitialCampaign produces a loadable state', () => {
    const fresh = createInitialCampaign({ fresh: true, week: 1 });
    const migrated = migrateCampaignState(fresh);
    expect(migrated.version).toBe(5);
    expect(migrated.week).toBe(1);
    expect(migrated.roster.length).toBeGreaterThan(0);
  });
});
