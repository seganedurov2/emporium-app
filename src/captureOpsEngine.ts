import type { Character } from './gameEngine';
import { generateSlaveCharacter } from './gameEngine';
import { REGION_DANGER } from './caravanRaidsEngine';
import { formatMoney } from './currency';

/**
 * Capture Operations engine.
 *
 * A capture operation ("захват") sends a hand-picked squad of operatives into a
 * foreign region to snatch a specific, high-value target and bring them back to
 * the syndicate as a captive. Unlike a trade caravan, an operation is run by
 * people the player names explicitly, which makes it far more dangerous:
 *
 *  - every week the squad is on the road it can be ambushed (the same raid
 *    mini-event caravans use, but with a higher roll — see `raidChanceForRoute`),
 *  - the snatch itself is resisted by the target's household guard,
 *  - a squad that is wiped out is lost for good.
 *
 * The squad is away from the syndicate for the whole operation, earns no venue
 * income, and is flagged with `assignedTask` so the roster can show it as
 * deployed.
 */

export type CaptureTargetQuality = 'low' | 'medium' | 'high' | 'elite';
export type CaptureOperationStatus = 'outbound' | 'completed' | 'failed' | 'lost';

export interface CaptureOperation {
  id: string;
  codename: string;
  /** Name of the abducted person, generated at dispatch. */
  targetName: string;
  targetRegionId: string;
  targetRegionName: string;
  targetQuality: CaptureTargetQuality;
  /** Paid up front at dispatch; forfeited on failure. */
  upfrontCost: number;
  /** Paid on a successful snatch. */
  bounty: number;
  leaderId: string;
  leaderName: string;
  squadIds: string[];
  squadSize: number;
  squadAvgSkill: number;
  squadAvgLoyalty: number;
  weeksTotal: number;
  weeksRemaining: number;
  status: CaptureOperationStatus;
  /** Ambushes already survived/fired on this operation (0..weeksTotal). */
  raidsTriggered: number;
  /** Percent chance the snatch itself succeeds, shown in the UI. */
  captureChance: number;
  /** Snapshot of route danger at dispatch, used by the raid roll. */
  routeDanger: number;
}

export interface CaptureDispatchParams {
  codename: string;
  targetRegionId: string;
  targetRegionName: string;
  targetQuality: CaptureTargetQuality;
  budget: number;
  squad: Character[];
}

export interface CaptureResolution {
  operationId: string;
  codename: string;
  success: boolean;
  /** The abducted target when the snatch succeeded, otherwise null. */
  captured: Character | null;
  fundsDelta: number;
  reputationDelta: number;
  squadLostIds: string[];
  squadWoundedIds: string[];
  status: CaptureOperationStatus;
  message: string;
}

export const CAPTURE_OPERATION_WEEKS = 2;
export const MIN_CAPTURE_SQUAD = 2;
export const MAX_CAPTURE_SQUAD = 4;

/** Prefix of `Character.assignedTask` while an operative is on an operation. */
export const CAPTURE_TASK_PREFIX = 'capture_op:';

export function captureTaskId(operationId: string): string {
  return `${CAPTURE_TASK_PREFIX}${operationId}`;
}

/** True when the operative is deployed on a capture operation and away from the syndicate. */
export function isOnCaptureOp(character: Character): boolean {
  return typeof character.assignedTask === 'string' && character.assignedTask.startsWith(CAPTURE_TASK_PREFIX);
}

/** Returns the operative with the mission flag stripped, so they are available again. */
export function clearCaptureTask(character: Character): Character {
  if (!isOnCaptureOp(character)) return character;
  const { assignedTask, ...rest } = character;
  void assignedTask;
  return rest;
}

/** Bounty paid per successful snatch, before the region/danger premium. */
const BASE_BOUNTY: Record<CaptureTargetQuality, number> = {
  low: 22000,
  medium: 38000,
  high: 62000,
  elite: 95000
};

/** Household resistance before squad skill and funding are taken into account. */
const BASE_RESISTANCE: Record<CaptureTargetQuality, number> = {
  low: 20,
  medium: 32,
  high: 44,
  elite: 56
};

const CODENAME_PREFIXES = [
  'Операция', 'Операция', 'Контракт', 'Задание', 'Поручение'
];
const CODENAME_NOUNS = [
  'Бархатная ловушка', 'Железная сеть', 'Полночное похищение', 'Солёная лилия', 'Сломанная клятва',
  'Багровый счёт', 'Молчаливый регистр', 'Чёрный регистр', 'Кобальтовый шёпот', 'Пустое обещание'
];

/** Base bounty for a quality tier, before danger and budget multipliers. */
export function baseBountyFor(quality: CaptureTargetQuality): number {
  return BASE_BOUNTY[quality];
}

/**
 * Danger of a route as a plain multiplier — exported so the raid engine and the
 * capture UI share one source of truth for how lawless a region is.
 */
export function routeDanger(regionId: string): number {
  return REGION_DANGER[regionId] ?? 0.4;
}

function average(stat: (character: Character) => number, squad: Character[]): number {
  if (squad.length === 0) return 0;
  return Math.round(squad.reduce((sum, character) => sum + stat(character), 0) / squad.length);
}

/**
 * Percent chance that the snatch itself succeeds once the squad is in the room.
 * Squad skill and size carry the weight; the target's household guard and the
 * lawlessness of the region make it harder. Funding below the recommended
 * budget means thinner kit, fewer bribes and a worse plan on the ground.
 */
export function captureChanceFor(
  quality: CaptureTargetQuality,
  squad: Character[],
  regionId: string,
  budget = 0
): number {
  const danger = routeDanger(regionId);
  const avgSkill = average(c => c.skill, squad);
  const avgLoyalty = average(c => c.loyalty, squad);
  const sizeBonus = Math.max(0, squad.length - MIN_CAPTURE_SQUAD) * 8;
  const reference = recommendedBudget(quality, regionId);
  const fundingTerm = reference > 0
    ? Math.max(-10, Math.min(10, (budget / reference - 1) * 8))
    : 0;
  const raw = 74
    - BASE_RESISTANCE[quality]
    - danger * 10
    + (avgSkill - 50) * 0.8
    + sizeBonus
    + (avgLoyalty - 50) * 0.25
    + fundingTerm;
  return Math.max(5, Math.min(95, Math.round(raw)));
}

/** Suggested budget: the cheapest amount that keeps the raid rolls survivable. */
export function recommendedBudget(quality: CaptureTargetQuality, regionId: string): number {
  const danger = routeDanger(regionId);
  return Math.round((BASE_BOUNTY[quality] * (0.45 + danger * 0.55)) / 500) * 500;
}

export function generateCodename(usedNames: string[] = []): string {
  for (let attempt = 0; attempt < 12; attempt++) {
    const prefix = CODENAME_PREFIXES[Math.floor(Math.random() * CODENAME_PREFIXES.length)];
    const noun = CODENAME_NOUNS[Math.floor(Math.random() * CODENAME_NOUNS.length)];
    const codename = `${prefix} ${noun}`;
    if (!usedNames.includes(codename)) return codename;
  }
  return `${CODENAME_PREFIXES[0]} ${CODENAME_NOUNS[0]} ${usedNames.length + 1}`;
}

/** Builds the target profile shown in the dispatch form and mission list. */
export function generateCaptureTarget(regionId: string, quality: CaptureTargetQuality): Character {
  // The shared captive factory tops out at 'high'; an elite target is a high
  // quality captive with the profile pushed further by the caller.
  const target = generateSlaveCharacter({
    regionId,
    quality: quality === 'elite' ? 'high' : quality,
    origin: 'capture_op'
  });
  target.role = quality === 'elite'
    ? 'Похищенная элита (пленный)'
    : quality === 'high'
      ? 'Похищенная знать (пленный)'
      : 'Похищенная цель (пленный)';
  return target;
}

export function createCaptureOperation(params: CaptureDispatchParams): CaptureOperation {
  const danger = routeDanger(params.targetRegionId);
  const target = generateCaptureTarget(params.targetRegionId, params.targetQuality);
  const budgetFactor = 0.8 + Math.min(1, params.budget / Math.max(1, BASE_BOUNTY[params.targetQuality])) * 0.35;
  const bounty = Math.round(BASE_BOUNTY[params.targetQuality] * (0.75 + danger * 0.6) * budgetFactor);
  const leader = params.squad[0];

  return {
    id: 'capture_' + Math.random().toString(36).substring(2, 9),
    codename: params.codename,
    targetName: target.name,
    targetRegionId: params.targetRegionId,
    targetRegionName: params.targetRegionName,
    targetQuality: params.targetQuality,
    upfrontCost: params.budget,
    bounty,
    leaderId: leader.id,
    leaderName: leader.name,
    squadIds: params.squad.map(character => character.id),
    squadSize: params.squad.length,
    squadAvgSkill: average(c => c.skill, params.squad),
    squadAvgLoyalty: average(c => c.loyalty, params.squad),
    weeksTotal: CAPTURE_OPERATION_WEEKS,
    weeksRemaining: CAPTURE_OPERATION_WEEKS,
    status: 'outbound',
    raidsTriggered: 0,
    captureChance: captureChanceFor(params.targetQuality, params.squad, params.targetRegionId, params.budget),
    routeDanger: danger
  };
}

/**
 * Resolves the week an operation arrives in the target's city: the squad either
 * snatches the target or is driven off. Pure — the caller applies the roster,
 * treasury and reputation changes.
 */
export function resolveCaptureArrival(operation: CaptureOperation): CaptureResolution {
  const success = Math.random() * 100 < operation.captureChance;

  if (success) {
    const captured = generateCaptureTarget(operation.targetRegionId, operation.targetQuality);
    captured.name = operation.targetName;
    if (operation.targetQuality === 'elite') {
      // An elite prize is stronger and more willing to serve than a raid captive.
      captured.skill = Math.min(100, captured.skill + 25);
      captured.submission = Math.min(100, captured.submission + 10);
    }
    return {
      operationId: operation.id,
      codename: operation.codename,
      success: true,
      captured,
      fundsDelta: operation.bounty,
      reputationDelta: operation.targetQuality === 'elite' ? -3 : -1,
      squadLostIds: [],
      squadWoundedIds: [],
      status: 'completed',
      message: `${operation.codename}: цель ${operation.targetName} захвачена в регионе ${operation.targetRegionName}. Отряд возвращается с добычей — +${formatMoney(operation.bounty)}.`
    };
  }

  // Failure: the target's guard held. The harsher the region and the more
  // valuable the target, the more likely the squad is simply gone.
  const danger = routeDanger(operation.targetRegionId);
  const wipeoutChance = Math.min(0.4, 0.06 + danger * 0.18
    + (operation.targetQuality === 'elite' ? 0.12 : operation.targetQuality === 'high' ? 0.06 : 0));
  const squadLost = Math.random() < wipeoutChance;
  const squadLostIds = squadLost ? [...operation.squadIds] : [];
  const wounded = squadLost ? [] : operation.squadIds.slice(0, Math.max(1, operation.squadIds.length - 1));

  return {
    operationId: operation.id,
    codename: operation.codename,
    success: false,
    captured: null,
    fundsDelta: 0,
    reputationDelta: squadLost ? -6 : -3,
    squadLostIds,
    squadWoundedIds: wounded,
    status: squadLost ? 'lost' : 'failed',
    message: squadLost
      ? `${operation.codename}: похищение сорвалось. Домашняя стража ${operation.targetName} вырезала отряд в регионе ${operation.targetRegionName}. Никто не вернулся.`
      : `${operation.codename}: похищение сорвалось. Стража ${operation.targetName} отбила отряд в регионе ${operation.targetRegionName}. Авансовый бюджет отряда потерян.`
  };
}

/** Sum of the upfront budgets still committed to operations on the road. */
export function committedCaptureSpend(operations: CaptureOperation[]): number {
  return operations
    .filter(operation => operation.status === 'outbound')
    .reduce((sum, operation) => sum + operation.upfrontCost, 0);
}
