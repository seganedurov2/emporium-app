/**
 * The meta-progress half of the weekly cycle, lifted out of App.tsx.
 *
 * `advanceWeek` in App is a huge reducer-like body that mixes venue revenue,
 * contracts, the city and meta-progress and ends by calling several React
 * setters. These two helpers take the finished numbers and run the pure part:
 * lifetime stats, achievements, the campaign goal, the act script and the
 * records board. App keeps only the state writes.
 */

import type { WeeklyFinanceReport } from "./gameEngine";
import {
  ACHIEVEMENT_BY_ID,
  applyWeeklyStats,
  buildSnapshot,
  checkCampaignGoal,
  evaluateAchievements,
  recordCampaignResult,
  updateGameRecords,
  type CampaignSnapshot,
  type CampaignGoalStatus,
  type GameRecords,
  type LeaderboardEntry,
  type MetaProgressState,
  type WeeklyStatsDelta,
} from "./metaProgressEngine";

/** The slice of campaign state the weekly meta step reads. */
export interface WeeklyMetaInput {
  week: number;
  reputation: number;
  isBankrupt: boolean;
  roster: Parameters<typeof buildSnapshot>[0]["roster"];
  auxiliaryBuildings: Parameters<typeof buildSnapshot>[0]["auxiliaryBuildings"];
  warehouseLevel: number;
  metaProgress: MetaProgressState;
}

/**
 * Folds one finished week into the lifetime stats and the campaign goal.
 * Pure: returns the next meta-progress and the log lines it generated.
 */
export function applyWeeklyMetaProgress(options: {
  input: WeeklyMetaInput;
  funds: number;
  employees: Parameters<typeof buildSnapshot>[0]["employees"];
  dependents: Parameters<typeof buildSnapshot>[0]["dependents"];
  report: WeeklyFinanceReport;
  statsDelta: WeeklyStatsDelta;
}): {
  metaProgress: MetaProgressState;
  snapshot: CampaignSnapshot;
  goalStatus: CampaignGoalStatus;
  logs: string[];
} {
  const { input, funds, employees, dependents, report, statsDelta } = options;
  const snapshot = buildSnapshot({
    week: report.week,
    funds,
    reputation: input.reputation,
    isBankrupt: input.isBankrupt,
    roster: input.roster,
    employees,
    auxiliaryBuildings: input.auxiliaryBuildings,
    dependents,
    warehouseLevel: input.warehouseLevel,
  });

  let metaProgress = applyWeeklyStats(input.metaProgress, report, statsDelta);
  const goalStatus = checkCampaignGoal(snapshot, metaProgress);
  metaProgress = {
    ...metaProgress,
    goalStatus,
    endingWeek:
      goalStatus !== "ongoing" && metaProgress.endingWeek === null
        ? report.week
        : metaProgress.endingWeek,
  };
  const evaluation = evaluateAchievements(metaProgress, snapshot);
  metaProgress = { ...metaProgress, achievements: evaluation.achievements };

  const logs = evaluation.newlyUnlocked.map(
    (achievementId) =>
      `🏆 Достижение открыто: «${ACHIEVEMENT_BY_ID[achievementId].title}» — ${ACHIEVEMENT_BY_ID[achievementId].description}.`,
  );
  return { metaProgress, snapshot, goalStatus, logs };
}

/**
 * Records a finished week on the local records board and, when the campaign
 * just ended, on the leaderboard. Returns the values the caller must store.
 */
export function recordFinishedWeek(options: {
  records: GameRecords;
  leaderboard: LeaderboardEntry[];
  campaignName: string;
  snapshot: CampaignSnapshot;
  metaProgress: MetaProgressState;
  goalStatus: CampaignGoalStatus;
  previousGoalStatus: CampaignGoalStatus;
  funds: number;
}): {
  records: GameRecords;
  leaderboard: LeaderboardEntry[];
  ended: boolean;
  logs: string[];
} {
  const {
    records,
    leaderboard,
    campaignName,
    snapshot,
    metaProgress,
    goalStatus,
    previousGoalStatus,
    funds,
  } = options;
  const nextRecords = updateGameRecords(records, snapshot, campaignName);
  const logs: string[] = [];
  let nextLeaderboard = leaderboard;
  let ended = false;

  if (goalStatus !== "ongoing" && previousGoalStatus === "ongoing") {
    ended = true;
    nextLeaderboard = recordCampaignResult(leaderboard, {
      campaignName,
      result: goalStatus,
      week: snapshot.week,
      peakFunds: Math.max(metaProgress.stats.peakFunds, funds),
      totalRevenue: metaProgress.stats.totalRevenue,
      prestigeLevel: metaProgress.prestige.level,
      date: new Date().toLocaleString(),
    });
    const finalRecords: GameRecords = {
      ...nextRecords,
      campaignsCompleted: nextRecords.campaignsCompleted + 1,
      campaignsWon:
        nextRecords.campaignsWon + (goalStatus === "victory" ? 1 : 0),
    };
    return { records: finalRecords, leaderboard: nextLeaderboard, ended, logs };
  }

  return { records: nextRecords, leaderboard: nextLeaderboard, ended, logs };
}
