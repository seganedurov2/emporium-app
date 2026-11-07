/** Numeric guards for weekly economy/reporting (0.6.4). Defensive: prevents NaN/Infinity propagation. */

export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeAmount(value: unknown, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  const n = Math.floor(safeNumber(value, 0));
  return Math.min(max, Math.max(min, n));
}

export function safeNonNegative(value: unknown): number {
  return safeAmount(value, 0);
}

export interface WeeklyReportTotals {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  treasuryAfter: number;
}

export function computeWeeklyTotals(
  revenue: Partial<Record<string, number>> | null | undefined,
  expenses: Partial<Record<string, number>> | null | undefined,
  treasuryBefore: unknown,
  loanPayment: unknown
): WeeklyReportTotals {
  const revSum = Object.values(revenue ?? {}).reduce<number>((s, v) => s + safeNumber(v, 0), 0);
  const expSum = Object.values(expenses ?? {}).reduce<number>((s, v) => s + safeNumber(v, 0), 0);
  const totalRevenue = safeNonNegative(revSum);
  const totalExpenses = safeNonNegative(expSum);
  const netIncome = safeNumber(totalRevenue - totalExpenses - safeNonNegative(loanPayment), 0);
  const treasuryAfter = safeNumber(safeNumber(treasuryBefore, 0) + netIncome, 0);
  return { totalRevenue, totalExpenses, netIncome, treasuryAfter };
}
