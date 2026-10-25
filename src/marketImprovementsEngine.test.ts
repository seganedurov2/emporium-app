import { describe, expect, it } from 'vitest';
import {
  MARKET_IMPROVEMENT_IDS,
  MARKET_IMPROVEMENT_TRACKS,
  generateMarketImprovementRequest,
  marketImprovementEffects,
  nextMarketImprovementCost,
  NO_MARKET_EFFECTS
} from '../src/marketImprovementsEngine';

describe('marketImprovementsEngine', () => {
  it('computes neutral effects for empty levels', () => {
    expect(marketImprovementEffects({})).toEqual(NO_MARKET_EFFECTS);
  });

  it('scales effects with track levels', () => {
    const effects = marketImprovementEffects({
      buyer_network: 2,
      market_research: 3,
      logistics: 1,
      risk_management: 4,
      trade_financing: 5
    });
    expect(effects.buyerPriceMultiplier).toBeCloseTo(1.16);
    expect(effects.buyerQuantityBonus).toBe(3);
    expect(effects.supplyDiscountBonus).toBeCloseTo(0.03);
    expect(effects.lotCostMultiplier).toBeCloseTo(0.96);
    expect(effects.riskReduction).toBe(8);
    expect(effects.proceedsMultiplier).toBeCloseTo(1.30);
  });

  it('quotes the next level cost and null at max', () => {
    expect(nextMarketImprovementCost('buyer_network', 0)).toBe(20000);
    expect(nextMarketImprovementCost('buyer_network', 4)).toBe(250000);
    expect(nextMarketImprovementCost('buyer_network', 5)).toBeNull();
  });

  it('rotates proposals by week and skips maxed tracks', () => {
    const base = { funds: 1000000, lastWeeklyReport: null };
    const week1 = generateMarketImprovementRequest({ week: 1, marketImprovements: {}, ...base });
    const week2 = generateMarketImprovementRequest({ week: 2, marketImprovements: {}, ...base });
    expect(week1?.track).toBe(MARKET_IMPROVEMENT_IDS[1 % MARKET_IMPROVEMENT_IDS.length]);
    expect(week2?.track).toBe(MARKET_IMPROVEMENT_IDS[2 % MARKET_IMPROVEMENT_IDS.length]);
    expect(week1?.author).toBe(MARKET_IMPROVEMENT_TRACKS[week1!.track].author);

    const maxed = Object.fromEntries(MARKET_IMPROVEMENT_IDS.map(id => [id, 5])) as Record<string, number>;
    expect(generateMarketImprovementRequest({ week: 3, marketImprovements: maxed, ...base })).toBeNull();
  });

  it('marks proposals Low priority when funds are short', () => {
    const request = generateMarketImprovementRequest({ week: 1, funds: 100, marketImprovements: {}, lastWeeklyReport: null });
    expect(request?.priority).toBe('Low');
  });
});
