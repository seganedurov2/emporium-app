import type { Character } from './gameEngine';
import type { Employee } from './expansionTypes';
import type { HospitalState } from './hospitalEngine';
import { bookTreatmentStay } from './hospitalEngine';
import type { RestZoneState } from './restZoneEngine';
import { admitToRest, freeRestSlots } from './restZoneEngine';
import type { HospitalStaffEffects } from './hospitalEngine';

/**
 * Hospital psychologist.
 *
 * The ward only ever books who is physically broken: health in the bad range or
 * a pregnancy the staff cannot wait on. Nobody was looking at the roster from
 * the other side — at who was worn down, close to walking out, or already gone
 * in the head. That is the psychologist's post at the hospital.
 *
 * Every posted psychologist reviews the worst cases on the floor and pushes each
 * one down one of three routes, worst state first:
 *
 * - **уволить** — the operative is spent for good: loyalty at the floor on top of
 *   health or exhaustion in the red. Retaining them only costs the syndicate a
 *   wage, so the psychologist signs them off the payroll.
 * - **палата** — the body needs a bed. The psychologist books the stay through
 *   the ward, so it burns the same beds and consumables the nurses book.
 * - **отдых** — the body is intact, the head is not. The zone programme takes
 *   them for the standard course and they come back next season.
 *
 * A psychologist reviews {@link PSYCHOLOGIST_CASES_PER_WEEK} cases a week each.
 * Skill moves every threshold: a senior psychologist catches a burnout earlier,
 * admits a patient sooner and is surer of a hopeless case before signing anyone
 * off, so a weak hire makes blunter and later calls.
 */

/** Roster cases one psychologist works through in a week. */
export const PSYCHOLOGIST_CASES_PER_WEEK = 1;
/** Loyalty at or below which a hopeless case is signed off the payroll. */
export const PSYCHOLOGIST_FIRE_LOYALTY = 20;
/** Health at or below which a case is hopeless once loyalty has bottomed out. */
export const PSYCHOLOGIST_FIRE_HEALTH = 15;
/** Exhaustion at or below which a case is hopeless once loyalty has bottomed out. */
export const PSYCHOLOGIST_FIRE_EXHAUSTION = 10;
/** Health at or below which the psychologist books a bed. */
export const PSYCHOLOGIST_WARD_HEALTH = 55;
/** Exhaustion at or above which the psychologist sends the operative to rest. */
export const PSYCHOLOGIST_REST_EXHAUSTION = 60;
/** Skill points that move every threshold by one step. */
export const PSYCHOLOGIST_SKILL_STEP = 25;

export type PsychologistRoute = 'fire' | 'ward' | 'rest';

export interface Psychologist {
  name: string;
  skill: number;
  morale: number;
}

/** Roster members posted to the hospital who hold the psychologist post. */
export function hospitalPsychologists(employees: Employee[]): Psychologist[] {
  return employees
    .filter(employee =>
      employee.status === 'active'
      && employee.specialty === 'psychologist'
      && employee.assignedBuildingId === 'hospital'
    )
    .map(employee => ({ name: employee.name, skill: employee.skill, morale: employee.morale }));
}

/** How many cases this week's roster of psychologists gets through. */
export function weeklyCaseCapacity(psychologists: Psychologist[]): number {
  return psychologists.length * PSYCHOLOGIST_CASES_PER_WEEK;
}

export interface PsychologistThresholds {
  fireLoyalty: number;
  fireHealth: number;
  fireExhaustion: number;
  wardHealth: number;
  restExhaustion: number;
}

/**
 * Thresholds for one psychologist. Skill is spent in
 * {@link PSYCHOLOGIST_SKILL_STEP} chunks, each widening what the psychologist
 * catches early and tightening what counts as hopeless.
 */
export function psychologistThresholds(skill: number): PsychologistThresholds {
  const steps = Math.floor(Math.max(0, Math.min(100, skill)) / PSYCHOLOGIST_SKILL_STEP);
  return {
    fireLoyalty: Math.max(5, PSYCHOLOGIST_FIRE_LOYALTY - steps * 2),
    fireHealth: Math.min(25, PSYCHOLOGIST_FIRE_HEALTH + steps * 2),
    fireExhaustion: Math.max(2, PSYCHOLOGIST_FIRE_EXHAUSTION + steps * 3),
    wardHealth: Math.min(90, PSYCHOLOGIST_WARD_HEALTH + steps * 5),
    restExhaustion: Math.max(35, PSYCHOLOGIST_REST_EXHAUSTION - steps * 5)
  };
}

export interface PsychologistVerdict {
  characterId: string;
  characterName: string;
  route: PsychologistRoute;
  reasons: string[];
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

/** Severity rank used to pick who gets worked on first. */
function caseSeverity(character: Character, thresholds: PsychologistThresholds): number {
  const health = clamp(character.exactHealth ?? 100);
  const exhaustion = clamp(character.exactExhaustion ?? 0);
  const loyalty = clamp(character.loyalty ?? 100);
  const ruined = health <= thresholds.fireHealth || exhaustion >= 100 - thresholds.fireExhaustion;
  const misery = Math.max(100 - health, exhaustion);
  return (ruined ? 400 : 0) + Math.max(0, thresholds.fireLoyalty - loyalty) * 2 + misery;
}

/**
 * Decides what to do with one operative: fire them, put them in a bed, or send
 * them to the rest programme. Returns null when they are none of the above.
 */
export function assessPsychologistCase(
  character: Pick<Character, 'id' | 'name' | 'exactHealth' | 'exactExhaustion' | 'loyalty'>,
  thresholds: PsychologistThresholds
): PsychologistVerdict | null {
  const health = clamp(character.exactHealth ?? 100);
  const exhaustion = clamp(character.exactExhaustion ?? 0);
  const loyalty = clamp(character.loyalty ?? 100);
  const reasons: string[] = [];

  // Loyalty at the floor on top of a body that is going too: nothing left to save.
  const ruined = health <= thresholds.fireHealth || exhaustion >= 100 - thresholds.fireExhaustion;
  if (loyalty <= thresholds.fireLoyalty && ruined) {
    reasons.push(`лояльность ${loyalty} из 100`);
    reasons.push(health <= thresholds.fireHealth ? `здоровье ${health} из 100` : `выгорание ${exhaustion} из 100`);
    return { characterId: character.id, characterName: character.name, route: 'fire', reasons };
  }

  if (health <= thresholds.wardHealth) {
    reasons.push(`здоровье ${health} из 100`);
    return { characterId: character.id, characterName: character.name, route: 'ward', reasons };
  }

  if (exhaustion >= thresholds.restExhaustion) {
    reasons.push(`усталость ${exhaustion} из 100`);
    return { characterId: character.id, characterName: character.name, route: 'rest', reasons };
  }

  return null;
}

export interface PsychologistWeekOptions {
  week: number;
  roster: Character[];
  hospital: HospitalState;
  restZone: RestZoneState;
  psychologists: Psychologist[];
  staff: HospitalStaffEffects;
  /** Operatives away on a mission: nobody reviews them. */
  busyCharacterIds?: Iterable<string>;
  /** Notification the player must see for every decision taken. */
  onNotify?: (text: string) => void;
}

export interface PsychologistWeekResult {
  roster: Character[];
  hospital: HospitalState;
  restZone: RestZoneState;
  logs: string[];
  /** Operatives signed off the payroll this week. */
  fired: string[];
}

/**
 * Runs the psychologist post for one campaign week: reviews the worst cases and
 * fires, hospitalises or rests them as the roster and the free capacity allow.
 * Cases with nowhere to go are left on the floor and reviewed again next week.
 */
export function advancePsychologistWeek(options: PsychologistWeekOptions): PsychologistWeekResult {
  const logs: string[] = [];
  const fired: string[] = [];
  if (options.psychologists.length === 0) {
    return { roster: options.roster, hospital: options.hospital, restZone: options.restZone, logs, fired };
  }

  const busy = new Set(options.busyCharacterIds ?? []);
  const resting = new Set(options.restZone.placements.map(placement => placement.characterId));
  const inWard = new Set(options.hospital.patients.map(patient => patient.characterId));

  // Every psychologist brings their own eye to the same queue: the roster is
  // sorted once by how bad each case is, then case N goes to the Nth psychologist
  // on duty, most experienced first.
const onDuty = [...options.psychologists].sort((a, b) => b.skill - a.skill);
  const capacity = weeklyCaseCapacity(onDuty);
  // A rookie psychologist reviews the roster more bluntly than a senior one, so
  // the queue is ranked by the keenest eye on duty.
  const thresholds = onDuty.length > 0 ? psychologistThresholds(onDuty[0].skill) : psychologistThresholds(0);
  const order = [...options.roster]
    .filter(character =>
      !busy.has(character.id)
      && !resting.has(character.id)
      && !inWard.has(character.id)
      && character.pregnancy?.status !== 'hospitalized'
      && character.role !== 'Chief Executive Officer'
      && !character.assignedTask
    )
    .sort((a, b) => caseSeverity(b, thresholds) - caseSeverity(a, thresholds));

  let hospital = options.hospital;
  let restZone = options.restZone;
  let roster = options.roster;
  let ledger = options.hospital.ledger;
  let caseIndex = 0;
  const dropFromRoster = new Set<string>();

  for (const character of order) {
    if (caseIndex >= capacity) break;
    const psychologist = onDuty[Math.min(caseIndex, onDuty.length - 1)];
    if (!psychologist) break;
    const verdict = assessPsychologistCase(character, psychologistThresholds(psychologist.skill));
    if (!verdict) continue;

    // The case only counts against the week once a route was actually carried
    // out: a case with no free bed or seat is retried next week.
    const detail = verdict.reasons.join(', ');

    if (verdict.route === 'fire') {
      const message = `ПСИХОЛОГ: ${psychologist.name} снимает ${character.name} с работы (${detail}) — на него больше не рассчитывают.`;
      dropFromRoster.add(character.id);
      fired.push(character.name);
      caseIndex += 1;
      logs.push(message);
      ledger = [{ week: options.week, message, tone: 'staffing' as const }, ...ledger].slice(0, 12);
      options.onNotify?.(message);
      continue;
    }

    if (verdict.route === 'ward') {
      const booking = bookTreatmentStay(hospital, character, options.staff, options.week);
      if (!booking) continue;
      hospital = { ...hospital, patients: [...hospital.patients, booking.patient] };
      const message = `ПСИХОЛОГ: ${psychologist.name} отправляет ${character.name} в палату «${booking.wardName}» (${detail}), лечение ${booking.patient.weeksRemaining} нед.`;
      caseIndex += 1;
      logs.push(message);
      ledger = [{ week: options.week, message, tone: 'admission' as const }, ...ledger].slice(0, 12);
      options.onNotify?.(message);
      continue;
    }

    if (freeRestSlots(restZone) <= 0) continue;
    const placement = admitToRest(character, options.week);
    caseIndex += 1;
    restZone = { ...restZone, placements: [...restZone.placements, placement] };
    const message = `ПСИХОЛОГ: ${psychologist.name} отправляет ${character.name} в зону отдыха (${detail}).`;
    logs.push(message);
    options.onNotify?.(message);
  }

  roster = roster.filter(character => !dropFromRoster.has(character.id));

  return {
    roster,
    hospital: { ...hospital, ledger },
    restZone,
    logs,
    fired
  };
}