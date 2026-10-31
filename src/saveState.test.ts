import { describe, expect, it } from 'vitest';
import { createInitialCampaign, migrateCampaignState } from './saveState';
import { createDefaultMezzanineView } from './mezzanineViewState';

describe('saveState meta-progress migration', () => {
  it('creates a campaign with meta progress and an empty report history', () => {
    const campaign = createInitialCampaign({ fresh: true });
    expect(campaign.metaProgress).toBeDefined();
    expect(campaign.metaProgress.goalStatus).toBe('ongoing');
    expect(campaign.metaProgress.prestige.level).toBe(0);
    expect(campaign.weeklyReports).toEqual([]);
    expect(campaign.lastWeeklyReport).toBeNull();
  });

  it('migrates a legacy lastWeeklyReport into the history', () => {
    const legacy = {
      ...createInitialCampaign({ fresh: true }),
      lastWeeklyReport: {
        week: 13,
        revenue: { venue: 100, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
        expenses: { wages: 50, hospital: 0, restZone: 0, staffSlots: 0, loanPayment: 0 },
        netIncome: 50,
        treasuryAfter: 125050
      }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.weeklyReports).toHaveLength(1);
    expect(migrated.weeklyReports[0].week).toBe(13);
    expect(migrated.lastWeeklyReport?.week).toBe(13);
  });

  it('keeps an existing report history and drops invalid entries', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const withHistory = {
      ...campaign,
      weeklyReports: [
        {
          week: 1,
          revenue: { venue: 10, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
          expenses: { wages: 5, hospital: 0, restZone: 0, staffSlots: 0, loanPayment: 0 },
          netIncome: 5,
          treasuryAfter: 125005
        },
        'garbage',
        {
          week: 2,
          revenue: { venue: 20, caravans: 0, captureOps: 0, contracts: 0, salon: 0 },
          expenses: { wages: 5, hospital: 0, restZone: 0, staffSlots: 0, loanPayment: 0 },
          netIncome: 15,
          treasuryAfter: 125020
        }
      ]
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(withHistory)));
    expect(migrated.weeklyReports).toHaveLength(2);
    expect(migrated.weeklyReports.map(report => report.week)).toEqual([1, 2]);
  });

  it('normalizes partial meta progress from older saves', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const withPartialMeta = {
      ...campaign,
      metaProgress: {
        achievements: { week_10: 10, unknown_achievement: 3 },
        stats: { totalRevenue: 5000, peakFunds: 9999 },
        prestige: { level: 2, victories: 1 },
        goalStatus: 'victory',
        endingWeek: 100
      }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(withPartialMeta)));
    expect(migrated.metaProgress.achievements).toEqual({ week_10: 10 });
    expect(migrated.metaProgress.stats.totalRevenue).toBe(5000);
    expect(migrated.metaProgress.stats.peakFunds).toBe(9999);
    expect(migrated.metaProgress.stats.auctionsCompleted).toBe(0);
    expect(migrated.metaProgress.prestige).toEqual({ level: 2, victories: 1 });
    expect(migrated.metaProgress.goalStatus).toBe('victory');
    expect(migrated.metaProgress.endingWeek).toBe(100);
  });

  it('starts a new campaign with an empty mezzanine view', () => {
    const campaign = createInitialCampaign({ fresh: true });
    expect(campaign.mezzanine).toEqual({
      selectedRegionId: null,
      selectedCity: null,
      viewMode: 'region',
      gridSize: 64,
      offset: { x: 0, y: 0 },
      citySeed: 1101
    });
  });

  it('restores the mezzanine view saved in 0.3.7', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const withView = {
      ...campaign,
      mezzanine: {
        selectedRegionId: 'gomel',
        selectedCity: { name: 'Калинковичи', lat: 52.1288, lon: 29.3325, seed: 1101 },
        viewMode: 'city',
        gridSize: 48,
        offset: { x: 0, y: 0 },
        citySeed: 1101
      }
    };
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(withView)));
    expect(migrated.mezzanine.viewMode).toBe('city');
    expect(migrated.mezzanine.selectedRegionId).toBe('gomel');
    expect(migrated.mezzanine.selectedCity?.name).toBe('Калинковичи');
    expect(migrated.mezzanine.gridSize).toBe(48);
  });

  it('loads pre-0.3.7 saves that have no mezzanine block', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const { mezzanine: _mezzanine, ...legacy } = campaign;
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.mezzanine).toEqual(createDefaultMezzanineView());
  });

  it('repairs a corrupted mezzanine block instead of dropping the campaign', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const migrated = migrateCampaignState({
      ...JSON.parse(JSON.stringify(campaign)),
      mezzanine: { viewMode: 'city', gridSize: 5000, selectedCity: { name: 'X', lat: 0, lon: 0, seed: 0 } }
    });
    expect(migrated.mezzanine.gridSize).toBe(200);
    expect(migrated.mezzanine.selectedCity?.seed).toBe(1);
    expect(migrated.mezzanine.viewMode).toBe('city');
  });

  it('falls back to defaults when meta progress is missing entirely', () => {
    const campaign = createInitialCampaign({ fresh: true });
    const { metaProgress: _metaProgress, weeklyReports: _weeklyReports, ...legacy } = campaign;
    const migrated = migrateCampaignState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.metaProgress.goalStatus).toBe('ongoing');
    expect(migrated.metaProgress.prestige.level).toBe(0);
    expect(migrated.weeklyReports).toEqual([]);
  });
});
