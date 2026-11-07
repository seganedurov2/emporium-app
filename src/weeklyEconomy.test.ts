import { describe, it, expect } from 'vitest';
import { safeNumber, safeAmount, computeWeeklyTotals } from './weeklyEconomy';

describe('weeklyEconomy numeric guards (0.6.4)', () => {
  it('safeNumber falls back on NaN/Infinity/invalid', () => {
    expect(safeNumber(NaN, 7)).toBe(7);
    expect(safeNumber(Infinity, 1)).toBe(1);
    expect(safeNumber('x', 2)).toBe(2);
    expect(safeNumber(5.5, 0)).toBe(5.5);
  });

  it('safeAmount clamps and floors', () => {
    expect(safeAmount(9.9, 0)).toBe(9);
    expect(safeAmount(-5, 0)).toBe(0);
  });

  it('computeWeeklyTotals is defensive', () => {
    const t = computeWeeklyTotals({ a: 100, b: NaN as any }, { x: 40 }, 1000, 10);
    expect(t.totalRevenue).toBe(100);
    expect(t.totalExpenses).toBe(40);
    expect(t.netIncome).toBe(50);
    expect(t.treasuryAfter).toBe(1050);
  });
});
