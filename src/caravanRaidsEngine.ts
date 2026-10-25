import type { Caravan, Character } from './gameEngine';
import { generateSlaveCharacter } from './gameEngine';
import { formatMoney } from './currency';

/**
 * Road ambush engine.
 *
 * Both kinds of syndicate missions that leave the building — trade caravans and
 * capture operations — can be ambushed by bandits or pirates while travelling.
 * The chance depends on the danger of the route (destination region), the
 * quality of the leader/crew and the deterrence bought at the caravan depot.
 * When an ambush fires the player is offered a mini-event with three choices —
 * Fight / Flee / Pay Tribute — each resolving with a success chance driven by
 * the crew's skill and loyalty.
 *
 * Ambushes are deliberately frequent: caravans roll on every week spent on the
 * road, capture operations roll even harder, and several ambushes can land in
 * the same week (the App layer queues them into a modal stack).
 */

export type RaidResolutionAction = 'fight' | 'flee' | 'tribute';

/** Which kind of mission the ambush struck. */
export type RaidMissionKind = 'caravan' | 'capture';

export interface ActiveRaid {
  missionKind: RaidMissionKind;
  /** Caravan id for caravan ambushes, operation id for capture ambushes. */
  raidId: string;
  /** Caravan name or capture operation codename. */
  missionName: string;
  leaderName: string;
  /** Roster id of the mission leader, absent for legacy saves without one. */
  leaderId?: string;
  destRegion: string;
  /** Bandits on land routes, pirates when the mission crosses water. */
  enemyType: 'bandits' | 'pirates';
  enemyName: string;
  severity: 'minor' | 'moderate' | 'severe';
  /** Crew statistics used to resolve the player's choice. */
  leaderSkill: number;
  leaderLoyalty: number;
  crewSize: number;
  crewAvgSkill: number;
  crewAvgLoyalty: number;
  /** Estimated success chance for each choice, shown to the player. */
  fightChance: number;
  fleeChance: number;
  tributeChance: number;
  /** Tribute demanded if the player chooses to pay. */
  tributeDemand: number;
  /** Deterrence applied by the caravan depot, in percentage points, 0 when unstaffed. */
  depotRiskReduction: number;
  depotVictoryBonus: number;
  /** Value at stake — caravan projected profit, or the capture bounty. */
  stakeValue: number;
  /** Capture operations only: the person the squad was sent to abduct. */
  targetName?: string;
}

/** Raid modifiers contributed by the caravan depot's current level and staffing. */
export interface RaidDeterrence {
  riskReduction?: number;
  victoryBonus?: number;
}

/** Status a mission adopts after the ambush resolves. */
export type RaidMissionStatus = Caravan['status'] | 'failed' | 'lost';

export interface RaidOutcome {
  success: boolean;
  /** Money gained (positive) or lost (negative) as a direct result. */
  fundsDelta: number;
  reputationDelta: number;
  /** Fraction of the mission's stake lost (0..1) — cargo plundered, bounty gutted. */
  stakeLossFraction: number;
  /** Whether the mission leader (караванщик / командир отряда) was killed. */
  leaderKilled: boolean;
  /** True when the whole detachment is destroyed and the mission is over. */
  detachmentWiped: boolean;
  /** Number of captured enemies pressed into the roster as slaves. */
  capturedSlaves: number;
  slaveQuality: 'low' | 'medium' | 'high';
  /** Final status the mission should adopt after resolution. */
  resultingStatus: RaidMissionStatus;
  message: string;
  failureMessage: string;
}

/**
 * Per-region danger of the trade route (0..1). Higher values mean bandits and
 * pirates are more common: remote, poorly-governed, mountainous or maritime
 * corridors are the most dangerous, stable Western hubs the safest.
 */
export const REGION_DANGER: Record<string, number> = {
  '01_north_america': 0.35,
  '02_south_america': 0.75,
  '03_western_europe': 0.1,
  '04_eastern_europe': 0.45,
  '05_middle_east': 0.8,
  '06_north_africa': 0.85,
  '07_west_africa': 0.9,
  '08_central_africa': 1.0,
  '09_east_south_africa': 0.75,
  '10_central_asia': 0.7,
  '11_east_asia': 0.3,
  '12_south_asia': 0.65,
  '13_southeast_asia': 0.6,
  '14_australia_oceania': 0.3,
  '15_roma': 0.5,
  '16_jewish_diaspora': 0.35,
  '99_ceo': 0.05
};

/** Regions reached primarily by sea — pirates rather than bandits. */
const MARITIME_REGIONS = new Set<string>([
  '01_north_america',
  '14_australia_oceania',
  '13_southeast_asia'
]);

/** Hard bounds on the weekly ambush roll. */
const RAID_CHANCE_FLOOR = 0.05;
const RAID_CHANCE_CEILING = 0.85;
/** Largest share of the roll the caravan depot can shave off, in percentage points. */
const DETERRENCE_CAP = 45;

/** Maps a region display name back to its id so danger can be looked up. */
export function regionNameToId(regionName: string): string | null {
  const map: Record<string, string> = {
    'Северная Америка и Карибы': '01_north_america',
    'Южная Америка': '02_south_america',
    'Западная Европа и Скандинавия': '03_western_europe',
    'Восточная Европа и Балканы': '04_eastern_europe',
    'Ближний Восток и Кавказ': '05_middle_east',
    'Северная Африка и Сахель': '06_north_africa',
    'Западная Африка': '07_west_africa',
    'Центральная Африка': '08_central_africa',
    'Восточная и Южная Африка': '09_east_south_africa',
    'Центральная Азия и Сибирь': '10_central_asia',
    'Восточная Азия': '11_east_asia',
    'Южная Азия': '12_south_asia',
    'Юго-Восточная Азия': '13_southeast_asia',
    'Австралия и Океания': '14_australia_oceania',
    'Диаспора рома': '15_roma',
    'Еврейская диаспора': '16_jewish_diaspora',
    'Исполнительный совет (CEO)': '99_ceo',
    // Английские алиасы для старых сохранений
    'North America & Caribbean': '01_north_america',
    'South America': '02_south_america',
    'Western Europe & Nordics': '03_western_europe',
    'Eastern Europe & Balkans': '04_eastern_europe',
    'Middle East & Caucasus': '05_middle_east',
    'North Africa & Sahel': '06_north_africa',
    'West Africa': '07_west_africa',
    'Central Africa': '08_central_africa',
    'East & South Africa': '09_east_south_africa',
    'Central Asia & Siberia': '10_central_asia',
    'East Asia': '11_east_asia',
    'South Asia': '12_south_asia',
    'Southeast Asia': '13_southeast_asia',
    'Australia & Oceania': '14_australia_oceania',
    'Roma Diaspora': '15_roma',
    'Jewish Diaspora': '16_jewish_diaspora',
    'Executive Council (CEO)': '99_ceo'
  };
  return map[regionName] ?? null;
}

export function dangerForRegion(regionName: string): number {
  const id = regionNameToId(regionName);
  if (!id) return 0.4;
  return REGION_DANGER[id] ?? 0.4;
}

/**
 * Ambush probability for any road mission, clamped to 5%–85%.
 *
 * Base rates are intentionally high: a caravan in a lawless corridor is attacked
 * roughly 70% of the time per week on the road, and a capture operation — which
 * is a felony in every region the syndicate operates in — even more often. A
 * well-trained crew lowers the roll by up to ±20% relative, and the caravan
 * depot shaves a further 45 percentage points at full investment.
 *
 * `riskReduction` is the depot's deterrence in percentage points.
 */
export function raidChanceForRoute(
  destRegionName: string,
  crewSkill = 55,
  riskReduction = 0,
  missionKind: RaidMissionKind = 'caravan'
): number {
  const danger = dangerForRegion(destRegionName);
  // Caravans: danger 0.05 -> ~37%, danger 1.0 -> ~70%.
  // Capture operations: danger 0.05 -> ~47%, danger 1.0 -> ~85%.
  const base = missionKind === 'capture' ? 0.45 + danger * 0.40 : 0.35 + danger * 0.35;
  // Skilled crews deter would-be raiders (up to ±20% relative).
  const skillFactor = 1 - (crewSkill - 55) / 500;
  const deterrence = Math.min(DETERRENCE_CAP, Math.max(0, riskReduction));
  const percent = base * skillFactor * 100 - deterrence;
  return Math.min(RAID_CHANCE_CEILING, Math.max(RAID_CHANCE_FLOOR, percent / 100));
}

/** Ambush chance for a trade caravan — kept as the caravan-specific entry point. */
export function raidChanceForCaravan(caravan: Caravan, crewSkill = 55, riskReduction = 0): number {
  return raidChanceForRoute(caravan.destRegion, crewSkill, riskReduction, 'caravan');
}

/** Rolls a percent value (1-100), or 0 when empty. */
function roll(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const BANDIT_NAMES = [
  'Багровые мародёры песков',
  'Разбойники железной дороги',
  'Дюнные волки',
  'Пепельные караванные воры',
  'Грабители солёных дорог',
  'Компания «Полый топор»'
];
const PIRATE_NAMES = [
  'Корсары Чёрного прилива',
  'Рейдеры Свободной гавани',
  'Избранные Кракена',
  'Частные пираты «Соляной ветер»',
  'Серый след',
  'Пираты Девяти фонарей'
];

interface AmbushRollInput {
  missionKind: RaidMissionKind;
  missionName: string;
  leaderName: string;
  leaderId?: string;
  destRegion: string;
  crewSkill: number;
  leaderSkill: number;
  leaderLoyalty: number;
  crew: Character[];
  escorts: { skill: number; loyalty: number }[];
  stakeValue: number;
  riskReduction: number;
  victoryBonus: number;
  targetName?: string;
}

/**
 * Shared ambush body: the roll, the enemy identity, severity and the three
 * resolution odds. Returns null when the mission passes unmolested.
 */
function rollAmbush(input: AmbushRollInput): ActiveRaid | null {
  const {
    missionKind, missionName, leaderName, leaderId, destRegion, crewSkill,
    leaderSkill, leaderLoyalty, crew, escorts, stakeValue,
    riskReduction, victoryBonus, targetName
  } = input;

  if (Math.random() > raidChanceForRoute(destRegion, crewSkill, riskReduction, missionKind)) return null;

  const regionId = regionNameToId(destRegion) || '03_western_europe';
  const enemyType: 'bandits' | 'pirates' = MARITIME_REGIONS.has(regionId) ? 'pirates' : 'bandits';

  const crewSize = Math.max(1, crew.length + escorts.length);
  const rosterSkillSum = crew.reduce((s, c) => s + c.skill, 0);
  const rosterLoyaltySum = crew.reduce((s, c) => s + c.loyalty, 0);
  const escortSkillSum = escorts.reduce((s, e) => s + e.skill, 0);
  const escortLoyaltySum = escorts.reduce((s, e) => s + e.loyalty, 0);
  const crewAvgSkill = Math.round((rosterSkillSum + escortSkillSum) / crewSize);
  const crewAvgLoyalty = Math.round((rosterLoyaltySum + escortLoyaltySum) / crewSize);

  const danger = dangerForRegion(destRegion);
  const severity: ActiveRaid['severity'] = danger > 0.75 ? 'severe' : danger > 0.45 ? 'moderate' : 'minor';

  // Fight: crew skill vs a difficulty that scales with danger, sharpened by the
  // depot's training and guard doctrine.
  const fightDifficulty = 45 + danger * 35;
  const fightChance = clampPct(50 + (leaderSkill + crewAvgSkill) / 2 - fightDifficulty + (leaderLoyalty - 50) / 4 + victoryBonus);

  // Flee: speed & nerve — skill dominant, danger is a penalty.
  const fleeChance = clampPct(55 + (leaderSkill + crewAvgSkill) / 2 * 0.8 - danger * 30);

  // Tribute: a successful negotiation (or a well-liked, disciplined crew that
  // scares raiders off cheap) depends on loyalty more than raw skill.
  const tributeChance = clampPct(45 + (leaderLoyalty + crewAvgLoyalty) / 2 - danger * 25);

  const tributeDemand = Math.round(stakeValue * (0.12 + danger * 0.18) + 500);

  const names = enemyType === 'pirates' ? PIRATE_NAMES : BANDIT_NAMES;

  return {
    missionKind,
    raidId: '',
    missionName,
    leaderName,
    leaderId,
    destRegion,
    enemyType,
    enemyName: names[Math.floor(Math.random() * names.length)],
    severity,
    leaderSkill,
    leaderLoyalty,
    crewSize,
    crewAvgSkill,
    crewAvgLoyalty,
    fightChance,
    fleeChance,
    tributeChance,
    tributeDemand,
    depotRiskReduction: riskReduction,
    depotVictoryBonus: victoryBonus,
    stakeValue,
    targetName
  };
}

/**
 * Attempts to spawn an ambush for a traveling caravan. Returns null when the
 * caravan crosses the week unmolested.
 *
 * `escorts` are hired caravan-escort employees from the Caravan Depot. They are
 * not part of the roster, so they are merged into the crew statistics by hand
 * rather than appended as Characters.
 */
export function trySpawnRaid(
  caravan: Caravan,
  leader: Character | undefined,
  crew: Character[],
  escorts: { skill: number; loyalty: number }[] = [],
  deterrence: RaidDeterrence = {}
): ActiveRaid | null {
  const riskReduction = Math.max(0, deterrence.riskReduction ?? 0);
  const victoryBonus = Math.max(0, deterrence.victoryBonus ?? 0);
  const escortSkill = escorts.length > 0
    ? Math.round(escorts.reduce((s, e) => s + e.skill, 0) / escorts.length)
    : 0;
  const crewSkill = Math.max(leader ? leader.skill : 55, escortSkill || (leader ? leader.skill : 55));

  const raid = rollAmbush({
    missionKind: 'caravan',
    missionName: caravan.name,
    leaderName: caravan.leaderName,
    leaderId: caravan.leaderId,
    destRegion: caravan.destRegion,
    crewSkill,
    leaderSkill: leader?.skill ?? 50,
    leaderLoyalty: leader?.loyalty ?? 50,
    crew: leader ? [leader, ...crew] : crew,
    escorts,
    stakeValue: caravan.potentialProfit,
    riskReduction,
    victoryBonus
  });
  if (!raid) return null;
  raid.raidId = caravan.id;
  return raid;
}

/**
 * Attempts to spawn an ambush for a capture operation on the road. Capture
 * squads roll higher than trade caravans: the syndicate is not merely carrying
 * goods, it is openly poaching a person.
 */
export function trySpawnCaptureRaid(
  operation: {
    id: string;
    codename: string;
    targetName: string;
    targetRegionName: string;
    leaderName: string;
    leaderId: string;
    squad: Character[];
    squadAvgSkill: number;
    squadAvgLoyalty: number;
    bounty: number;
  },
  escorts: { skill: number; loyalty: number }[] = [],
  deterrence: RaidDeterrence = {}
): ActiveRaid | null {
  const riskReduction = Math.max(0, deterrence.riskReduction ?? 0);
  const victoryBonus = Math.max(0, deterrence.victoryBonus ?? 0);
  const leader = operation.squad[0];
  const escortSkill = escorts.length > 0
    ? Math.round(escorts.reduce((s, e) => s + e.skill, 0) / escorts.length)
    : 0;
  const crewSkill = Math.max(operation.squadAvgSkill, escortSkill || operation.squadAvgSkill);

  const raid = rollAmbush({
    missionKind: 'capture',
    missionName: operation.codename,
    leaderName: operation.leaderName,
    leaderId: operation.leaderId,
    destRegion: operation.targetRegionName,
    crewSkill,
    leaderSkill: leader?.skill ?? operation.squadAvgSkill,
    leaderLoyalty: leader?.loyalty ?? operation.squadAvgLoyalty,
    crew: operation.squad,
    escorts,
    stakeValue: operation.bounty,
    riskReduction,
    victoryBonus,
    targetName: operation.targetName
  });
  if (!raid) return null;
  raid.raidId = operation.id;
  return raid;
}

function clampPct(v: number): number {
  return Math.round(Math.min(95, Math.max(5, v)));
}

/**
 * Probability that a losing capture operation ends with the whole squad dead
 * rather than merely scattered. Lawless regions and valuable targets are
 * deadlier.
 */
function wipeoutChanceFor(raid: ActiveRaid): number {
  const danger = dangerForRegion(raid.destRegion);
  const severityBump = raid.severity === 'severe' ? 0.12 : raid.severity === 'moderate' ? 0.05 : 0;
  return Math.min(0.6, 0.1 + danger * 0.3 + severityBump);
}

/**
 * Resolves the player's choice in an ambush mini-event and produces all of its
 * consequences. This is pure — the caller applies funds/reputation/stake/slaves.
 */
export function resolveRaid(raid: ActiveRaid, action: RaidResolutionAction): RaidOutcome {
  switch (action) {
    case 'fight':
      return resolveFight(raid);
    case 'flee':
      return resolveFlee(raid);
    case 'tribute':
      return resolveTribute(raid);
  }
}

function resolveFight(raid: ActiveRaid): RaidOutcome {
  const success = Math.random() * 100 < raid.fightChance;
  if (success) {
    // Win: rout the raiders, they surrender and are pressed into service.
    const capturedSlaves = roll(1, raid.severity === 'severe' ? 3 : 2);
    const slaveQuality: RaidOutcome['slaveQuality'] = raid.severity === 'severe' ? 'high'
      : raid.severity === 'moderate' ? 'medium' : 'low';
    const loot = Math.round(raid.tributeDemand * 0.6);
    return {
      success: true,
      fundsDelta: loot,
      reputationDelta: raid.severity === 'severe' ? 6 : 4,
      stakeLossFraction: 0.1 + Math.random() * 0.15,
      leaderKilled: false,
      detachmentWiped: false,
      capturedSlaves,
      slaveQuality,
      resultingStatus: 'traveling',
      message: `Отряд отбился от ${raid.enemyType} «${raid.enemyName}»! ${capturedSlaves} нападавший(их) схвачено и обращено в службу, добыча +${formatMoney(loot)}.`,
      failureMessage: ''
    };
  }
  // Loss: hard-fought defeat — heavy losses, and for capture squads a real risk
  // that nobody walks away.
  const leaderKilled = Math.random() < 0.35;
  const detachmentWiped = raid.missionKind === 'capture' && Math.random() < wipeoutChanceFor(raid);
  return {
    success: false,
    fundsDelta: 0,
    reputationDelta: detachmentWiped ? -8 : -4,
    stakeLossFraction: 0.4 + Math.random() * 0.3,
    leaderKilled,
    detachmentWiped,
    capturedSlaves: 0,
    slaveQuality: 'low',
    resultingStatus: detachmentWiped ? 'lost' : 'raided',
    message: '',
    failureMessage: detachmentWiped
      ? `«${raid.enemyName}» разбили отряд. ${raid.targetName ? `Попытка похищения ${raid.targetName} переросла` : 'Попытка'} в кровавую бойню — ни один боец не вернулся домой.`
      : `«${raid.enemyName}» прорвали охрану. ${leaderKilled ? `Глава операции ${raid.leaderName} погиб в бою. ` : ''}Ставка потеряна, операция сорвана.`
  };
}

function resolveFlee(raid: ActiveRaid): RaidOutcome {
  const success = Math.random() * 100 < raid.fleeChance;
  if (success) {
    return {
      success: true,
      fundsDelta: 0,
      reputationDelta: 0,
      // Escaping still costs some of the stake to lighten the load.
      stakeLossFraction: 0.1 + Math.random() * 0.1,
      leaderKilled: false,
      detachmentWiped: false,
      capturedSlaves: 0,
      slaveQuality: 'low',
      resultingStatus: 'traveling',
      message: `Группа ушла от ${raid.enemyType} «${raid.enemyName}» под покровом ночи. Часть ставки пришлось бросить ради скорости, но отряд выжил.`,
      failureMessage: ''
    };
  }
  const leaderKilled = Math.random() < 0.25;
  const detachmentWiped = raid.missionKind === 'capture' && Math.random() < wipeoutChanceFor(raid) * 0.5;
  return {
    success: false,
    fundsDelta: 0,
    reputationDelta: detachmentWiped ? -7 : -2,
    stakeLossFraction: 0.5 + Math.random() * 0.25,
    leaderKilled,
    detachmentWiped,
    capturedSlaves: 0,
    slaveQuality: 'low',
    // A chase that ends in a beating still leaves the mission limping home
    // with whatever is left — only a wipeout ends it outright.
    resultingStatus: detachmentWiped ? 'lost' : 'traveling',
    message: '',
    failureMessage: detachmentWiped
      ? `Побег не удался — налётчики догнали отряд и покончили с ним. Ни один боец не вернулся из ${raid.destRegion}.`
      : `Побег не удался — налётчики догнали их. ${leaderKilled ? `Глава ${raid.leaderName} погиб, прикрывая отход. ` : ''}Большая часть ставки потеряна, но операция выкарабкивается в безопасное место.`
  };
}

function resolveTribute(raid: ActiveRaid): RaidOutcome {
  const success = Math.random() * 100 < raid.tributeChance;
  if (success) {
    // Negotiated a lower price than demanded.
    const paid = Math.round(raid.tributeDemand * (0.5 + Math.random() * 0.3));
    return {
      success: true,
      fundsDelta: -paid,
      reputationDelta: -1,
      stakeLossFraction: 0,
      leaderKilled: false,
      detachmentWiped: false,
      capturedSlaves: 0,
      slaveQuality: 'low',
      resultingStatus: 'traveling',
      message: `Дань в ${formatMoney(paid)} выплачена «${raid.enemyName}». Операции разрешили продолжить путь.`,
      failureMessage: ''
    };
  }
  // Raiders took the tribute and the stake anyway.
  return {
    success: false,
    fundsDelta: -raid.tributeDemand,
    reputationDelta: -3,
    stakeLossFraction: 0.3 + Math.random() * 0.2,
    leaderKilled: Math.random() < 0.15,
    detachmentWiped: false,
    capturedSlaves: 0,
    slaveQuality: 'low',
    resultingStatus: 'traveling',
    message: '',
    failureMessage: `Вы заплатили ${formatMoney(raid.tributeDemand)} — а «${raid.enemyName}» предало перемирие и всё равно забрало ставку. Операция продолжается, но опустошённая.`
  };
}

/**
 * Builds the enslaved captives produced by an ambush win so the roster can gain
 * new operatives. Kept here so the App layer stays declarative.
 */
export function buildCapturedSlaves(outcome: RaidOutcome, regionName: string): Character[] {
  if (!outcome.success || outcome.capturedSlaves <= 0) return [];
  const regionId = regionNameToId(regionName) || '03_western_europe';
  const slaves: Character[] = [];
  for (let i = 0; i < outcome.capturedSlaves; i++) {
    slaves.push(generateSlaveCharacter({
      regionId,
      quality: outcome.slaveQuality,
      origin: 'caravan_raid'
    }));
  }
  return slaves;
}
