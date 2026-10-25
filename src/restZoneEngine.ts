import type { Character } from './gameEngine';
import { exhaustionFromExact, healthFromExact } from './buildingsEngine';

export type CareSeverity = 'critical' | 'attention' | 'stable';
export type CareNeedKind = 'medical' | 'rest' | 'skin' | 'grooming';
/** Where an operative who needs care should be sent first. */
export type CareRoute = 'rest_zone' | 'salon' | 'none';

export interface CareNeed {
  kind: CareNeedKind;
  label: string;
}

export interface CareAssessment {
  severity: CareSeverity;
  status: string;
  needs: CareNeed[];
  recommendedRoute: CareRoute;
}

const SKIN_STEPS: Character['skinCondition'][] = ['Flawless', 'Clear', 'Dry', 'Blemished', 'Irritated'];

/** Moves a skin condition one step towards flawless. */
export function improveSkinCondition(skin: Character['skinCondition']): Character['skinCondition'] {
  const index = SKIN_STEPS.indexOf(skin);
  return index > 0 ? SKIN_STEPS[index - 1] : skin;
}

/**
 * Reads the operative's condition and reports what kind of care they need.
 * The roster panel and the Rest Zone both build on this so a character flagged
 * as "Нужен уход" is routed to the same treatment everywhere.
 */
export function assessCareNeeds(character: Character): CareAssessment {
  const needs: CareNeed[] = [];
  const critical = character.healthLevel === 'Critical';

  if (critical || character.healthLevel === 'Poor') {
    needs.push({ kind: 'medical', label: 'Медицинская помощь' });
  } else if (character.healthLevel === 'Fair') {
    needs.push({ kind: 'medical', label: 'Плановый осмотр' });
  }

  if (character.exhaustionLevel === 'Burned Out' || character.exhaustionLevel === 'Exhausted') {
    needs.push({ kind: 'rest', label: 'Отдых и восстановление' });
  } else if (character.exhaustionLevel === 'Tired') {
    needs.push({ kind: 'rest', label: 'Желателен отдых' });
  }

  if (character.skinCondition === 'Irritated' || character.skinCondition === 'Blemished') {
    needs.push({ kind: 'skin', label: 'Уход за кожей' });
  } else if (character.skinCondition === 'Dry') {
    needs.push({ kind: 'skin', label: 'Увлажнение кожи' });
  }

  // The salon cannot heal anybody, and the rest zone has no cosmetologist: worn
  // out or sick personnel go to bed first, pure appearance work goes to the salon.
  const needsBodyCare = needs.some(need => need.kind === 'medical' || need.kind === 'rest');
  const needsSkinCare = needs.some(need => need.kind === 'skin');

  return {
    severity: critical ? 'critical' : needs.length ? 'attention' : 'stable',
    status: critical
      ? 'Требуется срочная помощь'
      : needs.length
        ? 'Нужен уход'
        : 'Состояние стабильное',
    needs,
    recommendedRoute: needsBodyCare ? 'rest_zone' : needsSkinCare ? 'salon' : 'none'
  };
}

/** Salon treatment that best matches what the operative is missing. */
export function recommendedSalonTreatmentId(assessment: CareAssessment): string | null {
  if (assessment.needs.some(need => need.kind === 'skin')) return 't_skin_condition';
  if (assessment.needs.length === 0) return null;
  return 't_hairstyle';
}

export interface RestProgram {
  name: string;
  description: string;
  /** Length of the stay in weeks. */
  weeks: number;
  weeklyCost: number;
  /** Exhaustion points shed every week spent resting. */
  exhaustionRecovery: number;
  /** Health points restored every week spent resting. */
  healthRecovery: number;
  /** Loyalty rebuilt every week spent away from duty. */
  loyaltyRecovery: number;
  /** Submission points a resting operative gains per week without attendants. */
  submissionRecovery: number;
  /** Improves the skin one step during the last week of the stay. */
  skinRecovery: boolean;
}

/** The one course the syndicate runs: no tiering, no shopping around. */
export const REST_PROGRAM: RestProgram = {
  name: 'Полная реабилитация',
  description: 'Курс под наблюдением врачей: снимает усталость, восстанавливает здоровье и кожу.',
  weeks: 4,
  weeklyCost: 1800,
  exhaustionRecovery: 22,
  healthRecovery: 9,
  loyaltyRecovery: 2,
  submissionRecovery: 1,
  skinRecovery: true
};

export interface RestZoneMilestone {
  name: string;
  /** Seat count the zone has reached once it outgrows the previous milestone. */
  seats: number;
  description: string;
}

/**
 * Names for the zone's size, nothing more. Seats are no longer bought as discrete
 * tiers: {@link RestZoneState.seats} grows one place at a time, forever, and the
 * zone borrows the name of the largest milestone it has passed.
 */
export const REST_ZONE_TIERS: RestZoneMilestone[] = [
  { name: 'Тихая комната', seats: 3, description: 'Три места в подвале за складом. Бесплатно, но тесно.' },
  { name: 'Гостевой блок', seats: 5, description: 'Пять мест с отдельными комнатами и нормальным уходом.' },
  { name: 'Санаторий', seats: 8, description: 'Восемь мест, врач на смене и полный пансион.' },
  { name: 'Курортный комплекс', seats: 12, description: 'Двенадцать мест: вся команда синдиката может уйти на отдых сразу.' }
];

/** Places the zone starts with, matching the old free first tier. */
export const REST_ZONE_BASE_SEATS = 3;
/** Price of the first place bought on top of the starting size. */
export const REST_SEAT_BASE_COST = 3000;
/** Every place after the first bought one costs this much more than the previous. */
export const REST_SEAT_COST_GROWTH = 0.08;
/** Weekly bill for a single place. */
export const REST_SEAT_UPKEEP = 150;
/** How many places one posted attendant is expected to look after. */
export const SEATS_PER_ATTENDANT = 4;

/** Submission points one attendant adds per week, before the skill modifier. */
export const REST_ATTENDANT_SUBMISSION = 1;

export interface RestAttendant {
  id: string;
  name: string;
  skill: number;
}

export interface RestPlacement {
  id: string;
  characterId: string;
  characterName: string;
  programName: string;
  weeksTotal: number;
  weeksRemaining: number;
  /** Venue the operative is sent back to once the program ends. */
  returnVenue: Character['assignedVenue'];
  admittedWeek: number;
}

export interface RestZoneState {
  /** Places the zone holds. Starts at {@link REST_ZONE_BASE_SEATS} and grows by purchase with no upper bound. */
  seats: number;
  /** Employee ids posted to the zone; each one raises submission while their charges rest. */
  attendantIds: string[];
  placements: RestPlacement[];
  /** Completed stays, kept for the syndicate's records. */
  totalWeeksHosted: number;
  totalSpent: number;
}

export interface RestWeekResult {
  state: RestZoneState;
  roster: Character[];
  logs: string[];
  /** Placements that finished this week. */
  discharged: string[];
}

export interface RestEligibility {
  eligible: boolean;
  reason: string;
}

export interface RestZoneAvailability {
  hospitalPatientIds: string[];
  busyCharacterIds: string[];
}

export function createRestZoneState(): RestZoneState {
  return {
    seats: REST_ZONE_BASE_SEATS,
    attendantIds: [],
    placements: [],
    totalWeeksHosted: 0,
    totalSpent: 0
  };
}

/**
 * Name for the zone's current size: the largest milestone it has reached, or a
 * generated name once the zone has outgrown the last one.
 */
export function restZoneName(seats: number): string {
  let reached = REST_ZONE_TIERS[0];
  for (const tier of REST_ZONE_TIERS) {
    if (seats >= tier.seats) reached = tier;
  }
  if (seats <= reached.seats) return reached.name;
  return `${reached.name} ${romanNumeral(seats - reached.seats)}`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function romanNumeral(step: number): string {
  return ROMAN[step - 1] ?? `+${step}`;
}

/** Places the zone holds. */
export function restZoneCapacity(state: RestZoneState): number {
  return state.seats;
}

/**
 * Price of the next place. Each purchase raises the price of the one after it,
 * so an unbounded zone still costs more the further it grows.
 */
export function nextRestSeatCost(state: RestZoneState): number {
  const extraSeats = Math.max(0, state.seats - REST_ZONE_BASE_SEATS);
  return Math.round(REST_SEAT_BASE_COST * Math.pow(1 + REST_SEAT_COST_GROWTH, extraSeats));
}

/** Weekly cost of keeping the zone running at its current size. */
export function restZoneWeeklyUpkeep(state: RestZoneState): number {
  return state.seats * REST_SEAT_UPKEEP;
}

export interface RestZoneSeatQuote {
  cost: number;
  affordable: boolean;
  seatsAfter: number;
}

/** Price of the next place, or null when it cannot be afforded yet. */
export function quoteRestSeat(state: RestZoneState, funds: number): RestZoneSeatQuote {
  const cost = nextRestSeatCost(state);
  return { cost, affordable: funds >= cost, seatsAfter: state.seats + 1 };
}

/** How many attendants the zone wants for its current number of places. */
export function recommendedAttendantCount(seats: number): number {
  return Math.max(1, Math.ceil(seats / SEATS_PER_ATTENDANT));
}

/** Attendants posted to the zone that are still on the payroll. */
export function activeAttendants(state: RestZoneState, employees: RestAttendant[]): RestAttendant[] {
  return employees.filter(employee => state.attendantIds.includes(employee.id));
}

/** True when the employee is already posted to the zone. */
export function isAttendant(state: RestZoneState, employeeId: string): boolean {
  return state.attendantIds.includes(employeeId);
}

/**
 * Submission points a resting operative gains each week from the posted
 * attendants. Each attendant contributes a flat point plus a share of their skill,
 * so a senior attendant disciplines a charge more than a rookie.
 */
export function attendantSubmissionGain(attendants: RestAttendant[]): number {
  if (attendants.length === 0) return 0;
  const skillBonus = attendants.reduce((sum, attendant) => sum + Math.floor(attendant.skill / 50), 0);
  return attendants.length * REST_ATTENDANT_SUBMISSION + skillBonus;
}

/** Full price of a stay, charged up front when the operative is admitted. */
export function restProgramCost(): number {
  return REST_PROGRAM.weeks * REST_PROGRAM.weeklyCost;
}

export function freeRestSlots(state: RestZoneState): number {
  return Math.max(0, restZoneCapacity(state) - state.placements.length);
}

export function restingCharacterIds(state: RestZoneState): string[] {
  return state.placements.map(placement => placement.characterId);
}

export function findPlacement(state: RestZoneState, characterId: string): RestPlacement | undefined {
  return state.placements.find(placement => placement.characterId === characterId);
}

/**
 * Checks whether an operative can be sent away: they must need care, still be
 * on the roster rather than in a ward or in the field, and there must be a free
 * place in the zone.
 */
export function restEligibility(
  character: Character,
  state: RestZoneState,
  availability: RestZoneAvailability
): RestEligibility {
  if (availability.hospitalPatientIds.includes(character.id)) {
    return { eligible: false, reason: `${character.name} лежит в больнице — сначала выписка.` };
  }
  if (availability.busyCharacterIds.includes(character.id)) {
    return { eligible: false, reason: `${character.name} сейчас в поле — отдых отменяется.` };
  }
  if (findPlacement(state, character.id)) {
    return { eligible: false, reason: `${character.name} уже на отдыхе в зоне восстановления.` };
  }
  if (character.pregnancy?.status === 'hospitalized') {
    return { eligible: false, reason: `${character.name} в родовом отделении — нужен уход, а не отпуск.` };
  }
  if (assessCareNeeds(character).severity === 'stable') {
    return { eligible: false, reason: `${character.name} чувствует себя хорошо, отдых не требуется.` };
  }
  if (freeRestSlots(state) <= 0) {
    return { eligible: false, reason: 'В зоне отдыха нет свободных мест.' };
  }
  return { eligible: true, reason: '' };
}

export function admitToRest(character: Character, week: number): RestPlacement {
  return {
    id: 'rest_' + Math.random().toString(36).substring(2, 9),
    characterId: character.id,
    characterName: character.name,
    programName: REST_PROGRAM.name,
    weeksTotal: REST_PROGRAM.weeks,
    weeksRemaining: REST_PROGRAM.weeks,
    returnVenue: character.assignedVenue ?? 'trade',
    admittedWeek: week
  };
}

/**
 * Auto-admits exhausted operatives to the rest zone when attendants are posted.
 * Each attendant can process one admission per week, preferring the worst cases.
 */
function autoAdmitExhausted(
  state: RestZoneState,
  roster: Character[],
  attendants: RestAttendant[],
  availability: RestZoneAvailability,
  week: number,
  logs: string[]
): { roster: Character[]; placements: RestPlacement[] } {
  if (attendants.length === 0) return { roster, placements: [] };

  const freeSlots = freeRestSlots(state);
  if (freeSlots <= 0) return { roster, placements: [] };

  const admissions = Math.min(freeSlots, attendants.length);
  const restingIds = new Set(state.placements.map(p => p.characterId));
  const busyIds = new Set(availability.busyCharacterIds);
  const hospitalIds = new Set(availability.hospitalPatientIds);

  const candidates = roster
    .filter(c => !restingIds.has(c.id) && !busyIds.has(c.id) && !hospitalIds.has(c.id))
    .filter(c => c.pregnancy?.status !== 'hospitalized')
    .filter(c => assessCareNeeds(c).needs.some(n => n.kind === 'rest'))
    .sort((a, b) => {
      const aSevere = a.exhaustionLevel === 'Burned Out' ? 3 : a.exhaustionLevel === 'Exhausted' ? 2 : 1;
      const bSevere = b.exhaustionLevel === 'Burned Out' ? 3 : b.exhaustionLevel === 'Exhausted' ? 2 : 1;
      return bSevere - aSevere || b.exactExhaustion - a.exactExhaustion;
    })
    .slice(0, admissions);

  const newPlacements: RestPlacement[] = [];
  const updatedRoster = roster.map(character => {
    const candidate = candidates.find(c => c.id === character.id);
    if (!candidate) return character;

    const placement = admitToRest(character, week);
    newPlacements.push(placement);
    const attendant = attendants[newPlacements.length - 1];
    logs.push(`ЗОНА ОТДЫХА: ${attendant.name} отправляет ${character.name} на программу восстановления (усталость: ${character.exhaustionLevel}, ${character.exactExhaustion}/100).`);
    return character;
  });

  return { roster: updatedRoster, placements: newPlacements };
}

/**
 * Runs one week of the rest zone: resting operatives recover instead of piling
 * up exhaustion at their venue, posted attendants work on their submission while
 * they recover, and finished stays send them back to duty.
 * Attendants also automatically admit exhausted operatives when places are free.
 */
export function advanceRestZoneWeek(
  state: RestZoneState,
  roster: Character[],
  attendants: RestAttendant[] = [],
  availability: RestZoneAvailability = { hospitalPatientIds: [], busyCharacterIds: [] },
  week = 0
): RestWeekResult {
  const logs: string[] = [];
  const discharged: string[] = [];
  let hostedWeeks = 0;
  const submissionGain = attendantSubmissionGain(attendants);

  const { roster: rosterAfterAdmissions, placements: newPlacements } = autoAdmitExhausted(
    state, roster, attendants, availability, week, logs
  );

  const restingRoster = rosterAfterAdmissions.map(character => {
    const placement = findPlacement(state, character.id);
    if (!placement) return character;
    hostedWeeks += 1;
    const finishing = placement.weeksRemaining <= 1;
    const exactExhaustion = Math.max(0, character.exactExhaustion - REST_PROGRAM.exhaustionRecovery);
    const exactHealth = Math.min(100, character.exactHealth + REST_PROGRAM.healthRecovery);
    const skinCondition = finishing && REST_PROGRAM.skinRecovery
      ? improveSkinCondition(character.skinCondition)
      : character.skinCondition;
    return {
      ...character,
      exactExhaustion,
      exhaustionLevel: exhaustionFromExact(exactExhaustion),
      exactHealth,
      healthLevel: healthFromExact(exactHealth),
      loyalty: Math.min(100, character.loyalty + REST_PROGRAM.loyaltyRecovery),
      // A posted attendant disciplines the rest harder than the bare programme:
      // with nobody on the post the charge only drifts by the base amount.
    submission: Math.min(100, (character.submission ?? 0) + Math.max(REST_PROGRAM.submissionRecovery, submissionGain)),
      skinCondition
    };
  });

  const placements: RestPlacement[] = [];
  const rosterIds = new Set(roster.map(character => character.id));
  state.placements.forEach(placement => {
    // An operative can leave the syndicate while away (sold, lost, dismissed);
    // the zone releases the place instead of holding it forever.
    if (!rosterIds.has(placement.characterId)) {
      logs.push(`ЗОНА ОТДЫХА: ${placement.characterName} покидает зону отдыха — персонал покинул синдикат.`);
      return;
    }
    const weeksRemaining = placement.weeksRemaining - 1;
    if (weeksRemaining <= 0) {
      discharged.push(placement.characterName);
      logs.push(`REST ZONE: ${placement.characterName} завершил программу «${placement.programName}» (${placement.weeksTotal} нед.) и вернулся к службе.`);
    } else {
      placements.push({ ...placement, weeksRemaining });
    }
  });

  // Add new auto-admitted placements
  placements.push(...newPlacements);

  return {
    state: {
      seats: state.seats,
      attendantIds: state.attendantIds,
      placements,
      totalWeeksHosted: state.totalWeeksHosted + hostedWeeks,
      totalSpent: state.totalSpent
    },
    roster: restingRoster,
    logs,
    discharged
  };
}

/**
 * Rebuilds a saved zone: converts the old fixed tier into purchased seats, keeps
 * only attendants still on the payroll, rewrites every stay to the current
 * program, and trims the list to the places the saved zone actually holds. Saves
 * written before seats existed start with the free starting size.
 */
export function normalizeRestZone(raw: unknown, roster: Character[], employees: RestAttendant[] = []): RestZoneState {
  const base = createRestZoneState();
  if (!raw || typeof raw !== 'object') return base;
  const stored = raw as Partial<RestZoneState> & { level?: number };
  const rosterIds = new Set(roster.map(character => character.id));
  const seats = Math.max(
    REST_ZONE_BASE_SEATS,
    Math.floor(Number(stored.seats) || 0) || tierSeats(Number(stored.level))
  );
  const employeeIds = new Set(employees.map(employee => employee.id));
  const weeksTotal = Math.max(1, REST_PROGRAM.weeks);
  const attendantIds = Array.isArray(stored.attendantIds)
    ? stored.attendantIds.filter((id): id is string => typeof id === 'string' && employeeIds.has(id))
    : [];
  const placements = Array.isArray(stored.placements)
    ? stored.placements.filter(placement =>
      placement
      && typeof placement.characterId === 'string'
      && rosterIds.has(placement.characterId))
      .map(placement => ({
        ...placement,
        programName: REST_PROGRAM.name,
        weeksTotal,
        weeksRemaining: Math.max(1, Math.min(weeksTotal, Math.floor(Number(placement.weeksRemaining) || weeksTotal)))
      }))
      .slice(0, seats)
    : [];

  return {
    seats,
    attendantIds,
    placements,
    totalWeeksHosted: Math.max(0, Math.floor(Number(stored.totalWeeksHosted) || 0)),
    totalSpent: Math.max(0, Math.floor(Number(stored.totalSpent) || 0))
  };
}

/** Places the old tier-based save had bought, so old campaigns keep their size. */
function tierSeats(seats: unknown): number {
  const level = Math.floor(Number(seats) || 0);
  const tier = REST_ZONE_TIERS[level - 1];
  return tier ? tier.seats : REST_ZONE_BASE_SEATS;
}