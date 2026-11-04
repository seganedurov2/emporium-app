import type { WeeklyFinanceReport } from './gameEngine';

/**
 * Meta-progress engine: achievements, the campaign goal (win/lose
 * conditions), prestige (New Game+) and the local records board.
 *
 * Every function here is pure apart from the explicit localStorage
 * load/save helpers at the bottom, so the whole system is unit-testable
 * without a DOM.
 */

export type AchievementId =
  | 'first_auction_sale'
  | 'auction_tycoon'
  | 'auction_whale'
  | 'first_caravan'
  | 'caravan_mogul'
  | 'raid_survivor'
  | 'first_capture'
  | 'capture_king'
  | 'first_slave'
  | 'slave_empire'
  | 'first_employee'
  | 'staff_empire'
  | 'first_building'
  | 'tycoon_100k'
  | 'tycoon_1m'
  | 'tycoon_10m'
  | 'week_10'
  | 'week_50'
  | 'week_100'
  | 'reputation_peak'
  | 'bankruptcy'
  | 'loan_shark'
  | 'debt_free'
  | 'midwife'
  | 'campaign_victory'
  | 'warehouse_1'
  | 'warehouse_3'
  | 'warehouse_5';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_auction_sale', title: 'Первый торг', description: 'Продать первый лот на аукционе' },
  { id: 'auction_tycoon', title: 'Аукционный магнат', description: 'Продать 25 лотов на аукционе' },
  { id: 'auction_whale', title: 'Кит аукциона', description: 'Продать один лот за $500 000+' },
  { id: 'first_caravan', title: 'Первый караван', description: 'Отправить караван в путь' },
  { id: 'caravan_mogul', title: 'Караванный магнат', description: 'Завершить 10 караванов с прибылью' },
  { id: 'raid_survivor', title: 'Сквозь засаду', description: 'Провести караван через нападение и доставить груз' },
  { id: 'first_capture', title: 'Первая операция', description: 'Завершить операцию захвата' },
  { id: 'capture_king', title: 'Охотник за головами', description: 'Завершить 10 операций захвата' },
  { id: 'first_slave', title: 'Первый раб', description: 'Завести первого раба в компании' },
  { id: 'slave_empire', title: 'Империя рабов', description: 'Держать 25 рабов одновременно' },
  { id: 'first_employee', title: 'Первый наём', description: 'Нанять первого сотрудника' },
  { id: 'staff_empire', title: 'Корпорация', description: 'Держать 20 сотрудников одновременно' },
  { id: 'first_building', title: 'Первый камень', description: 'Построить первое вспомогательное здание' },
  { id: 'tycoon_100k', title: 'Капиталист', description: 'Достичь казны в $100 000' },
  { id: 'tycoon_1m', title: 'Миллионер', description: 'Достичь казны в $1 000 000' },
  { id: 'tycoon_10m', title: 'Имперец', description: 'Достичь казны в $10 000 000' },
  { id: 'week_10', title: 'Десятая неделя', description: 'Дожить до 10-й недели кампании' },
  { id: 'week_50', title: 'Полвека', description: 'Дожить до 50-й недели кампании' },
  { id: 'week_100', title: 'Столетие', description: 'Дожить до 100-й недели кампании' },
  { id: 'reputation_peak', title: 'Безупречная репутация', description: 'Поднять репутацию синдиката до 100' },
  { id: 'bankruptcy', title: 'Банкрот', description: 'Объявить банкротство синдиката' },
  { id: 'loan_shark', title: 'Долговая яма', description: 'Взять 3 займа за кампанию' },
  { id: 'debt_free', title: 'Свободен от долгов', description: 'Полностью погасить заём' },
  { id: 'midwife', title: 'Поколение', description: 'Первое рождение в компании' },
  { id: 'campaign_victory', title: 'Победа кампании', description: 'Выполнить цель кампании' },
  { id: 'warehouse_1', title: 'Первый склад', description: 'Улучшить складской мезонин до уровня 1' },
  { id: 'warehouse_3', title: 'Автоматизированный склад', description: 'Достичь уровня 3 на складском мезонине' },
  { id: 'warehouse_5', title: 'Полный AS/RS', description: 'Достичь 5-го уровня складского мезонина с полной автоматизацией' }
];

export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDef> = ACHIEVEMENTS.reduce(
  (map, def) => { map[def.id] = def; return map; },
  {} as Record<AchievementId, AchievementDef>
);

export interface LifetimeStats {
  totalRevenue: number;
  totalExpenses: number;
  totalNetIncome: number;
  peakFunds: number;
  peakWeek: number;
  auctionsCompleted: number;
  auctionBestSale: number;
  caravansDispatched: number;
  caravansCompleted: number;
  caravansLost: number;
  raidsSurvived: number;
  captureOpsCompleted: number;
  slavesAcquired: number;
  employeesHired: number;
  buildingsConstructed: number;
  loansTaken: number;
  loansRepaid: number;
  births: number;
  warehouseLevel: number;
}

export interface PrestigeState {
  /** How many campaigns were won and restarted with a bonus. */
  level: number;
  /** Total victories across all runs, including the current one. */
  victories: number;
}

export type CampaignGoalStatus = 'ongoing' | 'victory' | 'defeat';

export interface MetaProgressState {
  /** Achievement id -> campaign week it was unlocked in. */
  achievements: Record<AchievementId, number>;
  stats: LifetimeStats;
  prestige: PrestigeState;
  goalStatus: CampaignGoalStatus;
  /** Week the campaign ending (victory or defeat) was first reached. */
  endingWeek: number | null;
}

/** The campaign goal: survive to week 100 as a millionaire with a name to keep. */
export const CAMPAIGN_GOAL_WEEK = 100;
export const CAMPAIGN_GOAL_FUNDS = 1_000_000;
export const CAMPAIGN_GOAL_REPUTATION = 50;

export const PRESTIGE_REVENUE_BONUS_PER_LEVEL = 0.25;
export const PRESTIGE_STARTING_FUNDS_BONUS_PER_LEVEL = 0.5;

export function createEmptyLifetimeStats(): LifetimeStats {
  return {
    totalRevenue: 0,
    totalExpenses: 0,
    totalNetIncome: 0,
    peakFunds: 0,
    peakWeek: 0,
    auctionsCompleted: 0,
    auctionBestSale: 0,
    caravansDispatched: 0,
    caravansCompleted: 0,
    caravansLost: 0,
    raidsSurvived: 0,
    captureOpsCompleted: 0,
    slavesAcquired: 0,
    employeesHired: 0,
    buildingsConstructed: 0,
    loansTaken: 0,
    loansRepaid: 0,
    births: 0,
    warehouseLevel: 0
  };
}

export function createInitialMetaProgress(): MetaProgressState {
  return {
    achievements: {} as Record<AchievementId, number>,
    stats: createEmptyLifetimeStats(),
    prestige: { level: 0, victories: 0 },
    goalStatus: 'ongoing',
    endingWeek: null
  };
}

/** Revenue multiplier granted by prestige levels (New Game+). */
export function prestigeRevenueMultiplier(level: number): number {
  return 1 + Math.max(0, Math.floor(level)) * PRESTIGE_REVENUE_BONUS_PER_LEVEL;
}

/** Starting funds for a prestige run: +50% of the base per level. */
export function prestigeStartingFunds(baseFunds: number, level: number): number {
  return Math.floor(Math.max(0, baseFunds) * (1 + Math.max(0, Math.floor(level)) * PRESTIGE_STARTING_FUNDS_BONUS_PER_LEVEL));
}

/** The slice of campaign state the meta engine needs to evaluate progress. */
export interface CampaignSnapshot {
  week: number;
  funds: number;
  reputation: number;
  isBankrupt: boolean;
  rosterSize: number;
  slaveCount: number;
  employeeCount: number;
  buildingCount: number;
  dependentsCount: number;
  warehouseLevel: number;
}

export function buildSnapshot(state: {
  week: number;
  funds: number;
  reputation: number;
  isBankrupt: boolean;
  roster: { isSlave?: boolean }[];
  employees: unknown[];
  auxiliaryBuildings: { level: number }[];
  dependents: unknown[];
  warehouseLevel: number;
}): CampaignSnapshot {
  return {
    week: Math.max(1, Math.floor(state.week)),
    funds: Math.floor(state.funds),
    reputation: Math.max(0, Math.min(100, Math.floor(state.reputation))),
    isBankrupt: state.isBankrupt === true,
    rosterSize: state.roster.length,
    slaveCount: state.roster.filter(character => character.isSlave === true).length,
    employeeCount: state.employees.length,
    buildingCount: state.auxiliaryBuildings.filter(building => building.level > 0).length,
    dependentsCount: state.dependents.length,
    warehouseLevel: Math.max(0, Math.floor(state.warehouseLevel))
  };
}

/** Per-week counters the weekly advance already knows; App computes the deltas. */
export interface WeeklyStatsDelta {
  caravansDispatched?: number;
  caravansCompleted?: number;
  caravansLost?: number;
  raidsSurvived?: number;
  captureOpsCompleted?: number;
  slavesAcquired?: number;
  employeesHired?: number;
  buildingsConstructed?: number;
  births?: number;
}

const nonNegative = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** Folds one weekly finance report and its event deltas into the lifetime stats. */
export function applyWeeklyStats(
  meta: MetaProgressState,
  report: WeeklyFinanceReport,
  delta: WeeklyStatsDelta = {}
): MetaProgressState {
  const stats = { ...meta.stats };
  stats.totalRevenue += Math.max(0, Math.floor(report.revenue.venue + report.revenue.caravans + report.revenue.captureOps + report.revenue.contracts + report.revenue.salon + (report.revenue.city ?? 0)));
  stats.totalExpenses += Math.max(0, Math.floor(report.expenses.wages + report.expenses.hospital + report.expenses.restZone + report.expenses.staffSlots + report.expenses.loanPayment + report.expenses.warehouse + (report.expenses.city ?? 0)));
  stats.totalNetIncome += Math.floor(report.netIncome);
  if (report.treasuryAfter > stats.peakFunds) {
    stats.peakFunds = Math.floor(report.treasuryAfter);
    stats.peakWeek = report.week;
  }
  stats.caravansDispatched += nonNegative(delta.caravansDispatched);
  stats.caravansCompleted += nonNegative(delta.caravansCompleted);
  stats.caravansLost += nonNegative(delta.caravansLost);
  stats.raidsSurvived += nonNegative(delta.raidsSurvived);
  stats.captureOpsCompleted += nonNegative(delta.captureOpsCompleted);
  stats.slavesAcquired += nonNegative(delta.slavesAcquired);
  stats.employeesHired += nonNegative(delta.employeesHired);
  stats.buildingsConstructed += nonNegative(delta.buildingsConstructed);
  stats.births += nonNegative(delta.births);
  return { ...meta, stats };
}

/** Records an auction sale (called on every confirmed sale, not just weekly). */
export function registerAuctionSale(meta: MetaProgressState, proceeds: number): MetaProgressState {
  const stats = { ...meta.stats };
  stats.auctionsCompleted += 1;
  stats.auctionBestSale = Math.max(stats.auctionBestSale, Math.floor(proceeds));
  return { ...meta, stats };
}

export function registerLoanTaken(meta: MetaProgressState): MetaProgressState {
  return { ...meta, stats: { ...meta.stats, loansTaken: meta.stats.loansTaken + 1 } };
}

export function registerLoanRepaid(meta: MetaProgressState): MetaProgressState {
  return { ...meta, stats: { ...meta.stats, loansRepaid: meta.stats.loansRepaid + 1 } };
}

/** Records a caravan dispatch (happens between weekly advances). */
export function registerCaravanDispatched(meta: MetaProgressState): MetaProgressState {
  return { ...meta, stats: { ...meta.stats, caravansDispatched: meta.stats.caravansDispatched + 1 } };
}

/** Records a constructed/upgraded auxiliary building. */
export function registerBuildingConstructed(meta: MetaProgressState): MetaProgressState {
  return { ...meta, stats: { ...meta.stats, buildingsConstructed: meta.stats.buildingsConstructed + 1 } };
}

interface AchievementRule {
  id: AchievementId;
  test: (snapshot: CampaignSnapshot, stats: LifetimeStats, goalStatus: CampaignGoalStatus) => boolean;
}

const ACHIEVEMENT_RULES: AchievementRule[] = [
  { id: 'first_auction_sale', test: (_s, stats) => stats.auctionsCompleted >= 1 },
  { id: 'auction_tycoon', test: (_s, stats) => stats.auctionsCompleted >= 25 },
  { id: 'auction_whale', test: (_s, stats) => stats.auctionBestSale >= 500_000 },
  { id: 'first_caravan', test: (_s, stats) => stats.caravansDispatched >= 1 },
  { id: 'caravan_mogul', test: (_s, stats) => stats.caravansCompleted >= 10 },
  { id: 'raid_survivor', test: (_s, stats) => stats.raidsSurvived >= 1 },
  { id: 'first_capture', test: (_s, stats) => stats.captureOpsCompleted >= 1 },
  { id: 'capture_king', test: (_s, stats) => stats.captureOpsCompleted >= 10 },
  { id: 'first_slave', test: (s, stats) => s.slaveCount >= 1 || stats.slavesAcquired >= 1 },
  { id: 'slave_empire', test: s => s.slaveCount >= 25 },
  { id: 'first_employee', test: (_s, stats) => stats.employeesHired >= 1 },
  { id: 'staff_empire', test: s => s.employeeCount >= 20 },
  { id: 'first_building', test: (_s, stats) => stats.buildingsConstructed >= 1 },
  { id: 'tycoon_100k', test: s => s.funds >= 100_000 },
  { id: 'tycoon_1m', test: s => s.funds >= 1_000_000 },
  { id: 'tycoon_10m', test: s => s.funds >= 10_000_000 },
  { id: 'week_10', test: s => s.week >= 10 },
  { id: 'week_50', test: s => s.week >= 50 },
  { id: 'week_100', test: s => s.week >= 100 },
  { id: 'reputation_peak', test: s => s.reputation >= 100 },
  { id: 'bankruptcy', test: s => s.isBankrupt },
  { id: 'loan_shark', test: (_s, stats) => stats.loansTaken >= 3 },
  { id: 'debt_free', test: (_s, stats) => stats.loansRepaid >= 1 },
  { id: 'midwife', test: (_s, stats) => stats.births >= 1 },
  { id: 'campaign_victory', test: (_s, _stats, goalStatus) => goalStatus === 'victory' },
  { id: 'warehouse_1', test: s => s.warehouseLevel >= 1 },
  { id: 'warehouse_3', test: s => s.warehouseLevel >= 3 },
  { id: 'warehouse_5', test: s => s.warehouseLevel >= 5 }
];

/**
 * Evaluates every achievement against the current snapshot and lifetime
 * stats. Returns the merged achievements map and the ids unlocked now.
 */
export function evaluateAchievements(
  meta: MetaProgressState,
  snapshot: CampaignSnapshot
): { achievements: Record<AchievementId, number>; newlyUnlocked: AchievementId[] } {
  const achievements = { ...meta.achievements };
  const newlyUnlocked: AchievementId[] = [];
  for (const rule of ACHIEVEMENT_RULES) {
    if (achievements[rule.id] !== undefined) continue;
    if (rule.test(snapshot, meta.stats, meta.goalStatus)) {
      achievements[rule.id] = snapshot.week;
      newlyUnlocked.push(rule.id);
    }
  }
  return { achievements, newlyUnlocked };
}

/**
 * The campaign goal (win/lose condition). Victory: reach the goal week
 * with the goal capital and reputation. Defeat: bankruptcy. Once a
 * terminal status is set it never reverts — the ending is a fact.
 */
export function checkCampaignGoal(snapshot: CampaignSnapshot, meta: MetaProgressState): CampaignGoalStatus {
  if (meta.goalStatus === 'victory' || meta.goalStatus === 'defeat') return meta.goalStatus;
  if (snapshot.isBankrupt) return 'defeat';
  if (
    snapshot.week >= CAMPAIGN_GOAL_WEEK
    && snapshot.funds >= CAMPAIGN_GOAL_FUNDS
    && snapshot.reputation >= CAMPAIGN_GOAL_REPUTATION
  ) return 'victory';
  return 'ongoing';
}

// ---------------------------------------------------------------------------
// Local records board and leaderboard (localStorage-backed, pure merging)
// ---------------------------------------------------------------------------

export interface GameRecords {
  bestWeek: number;
  bestWeekCampaign: string;
  peakFunds: number;
  peakFundsCampaign: string;
  campaignsCompleted: number;
  campaignsWon: number;
}

export interface LeaderboardEntry {
  campaignName: string;
  result: 'victory' | 'defeat' | 'retired';
  week: number;
  peakFunds: number;
  totalRevenue: number;
  prestigeLevel: number;
  date: string;
}

export const LEADERBOARD_LIMIT = 10;

export const RECORDS_STORAGE_KEY = 'emporium_records_v1';
export const LEADERBOARD_STORAGE_KEY = 'emporium_leaderboard_v1';

export function createEmptyRecords(): GameRecords {
  return {
    bestWeek: 0,
    bestWeekCampaign: '',
    peakFunds: 0,
    peakFundsCampaign: '',
    campaignsCompleted: 0,
    campaignsWon: 0
  };
}

/** Merges the current campaign into the all-time records. */
export function updateGameRecords(
  records: GameRecords,
  snapshot: CampaignSnapshot,
  campaignName: string
): GameRecords {
  const next = { ...records };
  if (snapshot.week > next.bestWeek) {
    next.bestWeek = snapshot.week;
    next.bestWeekCampaign = campaignName;
  }
  if (snapshot.funds > next.peakFunds) {
    next.peakFunds = snapshot.funds;
    next.peakFundsCampaign = campaignName;
  }
  return next;
}

/** Adds a finished campaign to the leaderboard, keeping the top entries. */
export function recordCampaignResult(
  entries: LeaderboardEntry[],
  entry: LeaderboardEntry
): LeaderboardEntry[] {
  return [entry, ...entries]
    .sort((a, b) => (b.result === 'victory' ? 1 : 0) - (a.result === 'victory' ? 1 : 0) || b.week - a.week || b.peakFunds - a.peakFunds)
    .slice(0, LEADERBOARD_LIMIT);
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

export function loadGameRecords(): GameRecords {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return createEmptyRecords();
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return createEmptyRecords();
    const num = (value: unknown) => {
      const parsedNum = Math.floor(Number(value));
      return Number.isFinite(parsedNum) ? Math.max(0, parsedNum) : 0;
    };
    return {
      bestWeek: num(parsed.bestWeek),
      bestWeekCampaign: typeof parsed.bestWeekCampaign === 'string' ? parsed.bestWeekCampaign : '',
      peakFunds: num(parsed.peakFunds),
      peakFundsCampaign: typeof parsed.peakFundsCampaign === 'string' ? parsed.peakFundsCampaign : '',
      campaignsCompleted: num(parsed.campaignsCompleted),
      campaignsWon: num(parsed.campaignsWon)
    };
  } catch {
    return createEmptyRecords();
  }
}

export function saveGameRecords(records: GameRecords): void {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage full or unavailable — records are best-effort only.
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).map(entry => {
      const rawResult = entry.result;
      const result: LeaderboardEntry['result'] =
        rawResult === 'victory' || rawResult === 'defeat' || rawResult === 'retired' ? rawResult : 'retired';
      return {
        campaignName: typeof entry.campaignName === 'string' ? entry.campaignName : 'Безымянный синдикат',
        result,
        week: Math.max(1, Math.floor(Number(entry.week)) || 1),
        peakFunds: Math.max(0, Math.floor(Number(entry.peakFunds)) || 0),
        totalRevenue: Math.max(0, Math.floor(Number(entry.totalRevenue)) || 0),
        prestigeLevel: Math.max(0, Math.floor(Number(entry.prestigeLevel)) || 0),
        date: typeof entry.date === 'string' ? entry.date : ''
      };
    }).slice(0, LEADERBOARD_LIMIT);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries.slice(0, LEADERBOARD_LIMIT)));
  } catch {
    // Storage full or unavailable — the leaderboard is best-effort only.
  }
}
