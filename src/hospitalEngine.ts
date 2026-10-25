import type { Character, Dependent, DependentGender, PregnancyState } from './gameEngine';
import { FIRST_NAMES, LAST_NAMES } from './gameEngine';
import { healthFromExact } from './buildingsEngine';

/**
 * Hospital engine.
 *
 * The syndicate runs its own maternity ward. Pregnancy runs for a full
 * {@link GESTATION_DAYS} (20 weeks); when a mother reaches term she is admitted
 * to a free bed — an employee escorts her over and the week tick notifies the
 * player — and delivers there a week later.
 *
 * Wards are permanent property bought through a black-market broker. Medical
 * equipment is a consumable stock: every delivery burns sterile kits, analgesia
 * and infant-care sets, plus a resuscitation kit when the birth goes wrong.
 * Running out of stock is survivable but expensive in outcomes.
 *
 Quality of care comes from three places: the ward the mother lands in, the
 * consumables actually in stock, and the nurses and midwives staffed at the
 * Hospital building.
 *
 * The ward is not only a maternity ward. A roster member whose health has fallen
 * into the bad range is walked into a bed by a member of the medical staff and
 * heals a slice every week until they are fit again — or, with no bed free,
 * keeps waiting for one.
 *
 * A pregnancy is watched long before its term. The medical staff score every
 * pregnant member on her own condition — health, exhaustion, how late she is,
 * her age, and whether the depot actually holds the drugs the case needs — and
 * when the score crosses {@link PREGNANCY_RISK_ADMIT} they take her off the
 * floor into an observation bed, whatever week it is. How long she holds the
 * bed and whether the pregnancy survives it depend on the ward tier, the staff
 * on duty and the consumables in stock, so an empty cupboard can turn a
 * treatable threat into a lost child.
 */

export const GESTATION_DAYS = 140;
export const DAYS_PER_WEEK = 7;
export const CONCEPTION_CHANCE_PER_ACTIVE_WEEK = 0.05;
/** Company property is transferred to the roster at sixteen. */
export const COMPANY_PROPERTY_AGE_DAYS = 16 * 365;
/** Health at or below which the medical staff hospitalise a roster member. */
export const TREATMENT_HEALTH_THRESHOLD = 40;
/** At or below this the case is severe and wants the resuscitation kit. */
export const CRITICAL_TREATMENT_HEALTH = 15;
/** Health a patient is expected to be well on by, once the stay is over. */
export const TREATMENT_TARGET_HEALTH = 85;
/** Longest stay a treatment patient may hold a bed for. */
export const TREATMENT_MAX_WEEKS = 4;
/** Health at or below which a pregnancy counts as a risky case. */
export const PREGNANCY_RISK_HEALTH = 45;
/** Exhaustion at or above which a pregnancy counts as a risky case. */
export const PREGNANCY_RISK_EXHAUSTION = 75;
/** Risk score at or above which the medical staff take her into observation. */
export const PREGNANCY_RISK_ADMIT = 0.45;
/** Age from which a pregnancy is treated as high-risk on its own. */
export const PREGNANCY_RISK_AGE = 38;
/** Longest observation stay a threatened pregnancy may hold a bed for. */
export const OBSERVATION_MAX_WEEKS = 3;

export type HospitalWardId = 'ward_standard' | 'ward_comfort' | 'ward_surgical' | 'ward_icu';
export type HospitalEquipmentId = 'eq_sterile' | 'eq_analgesia' | 'eq_infant' | 'eq_emergency';
export type EquipmentTiming = 'always' | 'complication';

export interface HospitalWardDefinition {
  id: HospitalWardId;
  name: string;
  /** Patients a single ward holds. */
  beds: number;
  /** Care quality contributed by this ward tier. */
  quality: number;
  cost: number;
  weeklyUpkeep: number;
  /** Hospital level required before this ward type can be bought. */
  requiredHospitalLevel: number;
  description: string;
}

export interface HospitalEquipmentDefinition {
  id: HospitalEquipmentId;
  name: string;
  cost: number;
  /** Success points lost when a delivery happens without one unit in stock. */
  missingPenalty: number;
  /** Units burned per delivery. */
  perDelivery: number;
  timing: EquipmentTiming;
  description: string;
}

export const HOSPITAL_WARDS: HospitalWardDefinition[] = [
  {
    id: 'ward_standard',
    name: 'Родильная палата',
    beds: 2,
    quality: 1,
    cost: 10000,
    weeklyUpkeep: 500,
    requiredHospitalLevel: 1,
    description: 'Два места, базовый уход. Основа роддома.'
  },
  {
    id: 'ward_comfort',
    name: 'Приватная палата',
    beds: 1,
    quality: 2,
    cost: 22000,
    weeklyUpkeep: 1200,
    requiredHospitalLevel: 1,
    description: 'Одно место, отдельная койка, заметно лучше уход.'
  },
  {
    id: 'ward_surgical',
    name: 'Операционная палата',
    beds: 1,
    quality: 3,
    cost: 45000,
    weeklyUpkeep: 2400,
    requiredHospitalLevel: 2,
    description: 'Единственное место, где можно принять осложнённые роды.'
  },
  {
    id: 'ward_icu',
    name: 'Реанимационная палата',
    beds: 1,
    quality: 4,
    cost: 75000,
    weeklyUpkeep: 4200,
    requiredHospitalLevel: 3,
    description: 'Тяжёлая медицина. Лучший исход при любых родах.'
  }
];

export const HOSPITAL_EQUIPMENT: HospitalEquipmentDefinition[] = [
  {
    id: 'eq_sterile',
    name: 'Стерильный хирургический набор',
    cost: 1200,
    missingPenalty: 15,
    perDelivery: 1,
    timing: 'always',
    description: 'Расходуется на каждый приём. Без него работают «как получится».'
  },
  {
    id: 'eq_analgesia',
    name: 'Анестезия и обезболивание',
    cost: 2000,
    missingPenalty: 8,
    perDelivery: 1,
    timing: 'always',
    description: 'Обезболивание рожениц, снижает нагрузку на ослабленных.'
  },
  {
    id: 'eq_infant',
    name: 'Набор ухода за новорождённым',
    cost: 1500,
    missingPenalty: 12,
    perDelivery: 1,
    timing: 'always',
    description: 'Стерильные пелёнки и уход за младенцем.'
  },
  {
    id: 'eq_emergency',
    name: 'Реанимационный набор',
    cost: 6000,
    missingPenalty: 20,
    perDelivery: 1,
    timing: 'complication',
    description: 'Тратится только при осложнениях. Крайне желателен.'
  }
];

/** Weekly chance a black-market shipment is flagged by an inspector. */
export const PURCHASE_INTERCEPTION_CHANCE = 0.08;
/** Share of the spend lost when a shipment is flagged. */
export const INTERCEPTION_LOSS_FRACTION = 0.35;
export const INTERCEPTION_REPUTATION_PENALTY = 2;

export type HospitalAdmission = 'birth' | 'treatment' | 'observation';

export interface HospitalPatient {
  characterId: string;
  characterName: string;
  wardId: HospitalWardId;
  /**
   * Why the bed is held. Absent in saves written before treatment stays existed,
   * so an unlabelled bed is always a maternity bed.
   */
  admission?: HospitalAdmission;
  /** True when the birth needs an operating theatre — rolled at admission. */
  complicated: boolean;
  /** Weeks left in the bed: the delivery week, then recovery. */
  weeksRemaining: number;
  delivered: boolean;
  admittedWeek: number;
  /** Health a treatment patient regains per week, fixed when the stay is booked. */
  weeklyGain?: number;
  /** Consumables the stay needed but the depot did not hold. */
  missingItemIds?: HospitalEquipmentId[];
  /** Chance the pregnancy survives an observation stay, in percent. */
  survivalChance?: number;
  /** Risk score the stay was booked on, 0-1. */
  riskScore?: number;
}

/** True when the bed is taken by a patient being treated for their health. */
export function isTreatmentStay(patient: Pick<HospitalPatient, 'admission'>): boolean {
  return patient.admission === 'treatment';
}

/** True when the bed is taken by a pregnancy the staff are watching before term. */
export function isObservationStay(patient: Pick<HospitalPatient, 'admission'>): boolean {
  return patient.admission === 'observation';
}

export type HospitalLedgerTone = 'admission' | 'birth' | 'loss' | 'purchase' | 'shortage' | 'discharge' | 'staffing';

export interface HospitalLedgerEntry {
  week: number;
  message: string;
  tone: HospitalLedgerTone;
}

export interface HospitalState {
  wardCounts: Record<string, number>;
  equipment: Record<string, number>;
  patients: HospitalPatient[];
  ledger: HospitalLedgerEntry[];
}

/** Builds a ledger row for a purchase or event made outside the week tick. */
export function createLedgerEntry(
  week: number,
  message: string,
  tone: HospitalLedgerTone
): HospitalLedgerEntry {
  return { week, message, tone };
}

export interface HospitalStaffEffects {
  nurses: number;
  midwives: number;
  nurseBonus: number;
  midwifeBonus: number;
  /** Employees posted to the hospital, whoever escorts a patient to the ward. */
  escortNames?: string[];
}

export interface HospitalTickOptions {
  week: number;
  staff: HospitalStaffEffects;
  hospitalLevel: number;
  /** Notification the player must see: who was taken to which ward. */
  onNotify?: (text: string) => void;
  random?: () => number;
  /**
   * Operatives already off the floor in the rest zone. They are healing there,
   * so a bad week of health must not book them a second bed.
   */
  restingCharacterIds?: Iterable<string>;
}

export interface HospitalTickResult {
  roster: Character[];
  dependents: Dependent[];
  hospital: HospitalState;
  /** Ward upkeep charged this week, in money. */
  upkeep: number;
  logs: string[];
}

export function createHospitalState(): HospitalState {
  return {
    wardCounts: { ward_standard: 0, ward_comfort: 0, ward_surgical: 0, ward_icu: 0 },
    equipment: { eq_sterile: 0, eq_analgesia: 0, eq_infant: 0, eq_emergency: 0 },
    patients: [],
    ledger: []
  };
}

export function getWardDefinition(id: string): HospitalWardDefinition | undefined {
  return HOSPITAL_WARDS.find(ward => ward.id === id);
}

export function getEquipmentDefinition(id: string): HospitalEquipmentDefinition | undefined {
  return HOSPITAL_EQUIPMENT.find(item => item.id === id);
}

export function wardCount(state: HospitalState, id: HospitalWardId): number {
  return Math.max(0, Math.floor(Number(state.wardCounts?.[id]) || 0));
}

export function equipmentStock(stock: Record<string, number>, id: HospitalEquipmentId): number {
  return Math.max(0, Math.floor(Number(stock?.[id]) || 0));
}

/** Total beds the syndicate currently owns. */
export function totalBeds(state: HospitalState): number {
  return HOSPITAL_WARDS.reduce((sum, ward) => sum + ward.beds * wardCount(state, ward.id), 0);
}

export function bedsInUse(state: HospitalState): number {
  return state.patients.length;
}

export function bedsInWard(state: HospitalState, id: HospitalWardId): number {
  return state.patients.filter(patient => patient.wardId === id).length;
}

/** Weekly upkeep of every ward owned. */
export function weeklyUpkeep(state: HospitalState): number {
  return HOSPITAL_WARDS.reduce(
    (sum, ward) => sum + ward.weeklyUpkeep * wardCount(state, ward.id),
    0
  );
}

export interface PurchaseQuote {
  unitCost: number;
  total: number;
  affordable: boolean;
  locked: boolean;
  lockReason: string;
}

export function quoteWards(
  id: HospitalWardId,
  quantity: number,
  funds: number,
  hospitalLevel: number
): PurchaseQuote {
  const ward = getWardDefinition(id);
  if (!ward) return { unitCost: 0, total: 0, affordable: false, locked: true, lockReason: 'Неизвестная палата' };
  const total = ward.cost * Math.max(1, quantity);
  const locked = hospitalLevel < ward.requiredHospitalLevel;
  return {
    unitCost: ward.cost,
    total,
    affordable: funds >= total,
    locked,
    lockReason: locked ? `Нужен уровень больницы ${ward.requiredHospitalLevel}` : ''
  };
}

export function quoteEquipment(
  id: HospitalEquipmentId,
  quantity: number,
  funds: number
): PurchaseQuote {
  const item = getEquipmentDefinition(id);
  if (!item) return { unitCost: 0, total: 0, affordable: false, locked: false, lockReason: '' };
  const total = item.cost * Math.max(1, quantity);
  return { unitCost: item.cost, total, affordable: funds >= total, locked: false, lockReason: '' };
}

export interface InterceptionResult {
  intercepted: boolean;
  /** Money lost on top of the goods (broker skim, bribe, fine). */
  loss: number;
}

/** Rolls the black-market interception on a purchase. */
export function rollInterception(spend: number, random: () => number = Math.random): InterceptionResult {
  if (random() >= PURCHASE_INTERCEPTION_CHANCE) return { intercepted: false, loss: 0 };
  return { intercepted: true, loss: Math.round(spend * INTERCEPTION_LOSS_FRACTION) };
}

function createNewborn(mother: Character, week: number, random: () => number): Dependent {
  const gender: DependentGender = random() < 0.5 ? 'female' : 'male';
  const firstNames = gender === 'female' ? FIRST_NAMES.women : FIRST_NAMES.men;
  const firstName = firstNames[Math.floor(random() * firstNames.length)];
  const familyName = mother.name.trim().split(/\s+/).at(-1) || LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
  return {
    id: `dependent_${Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36)}`,
    name: `${firstName} ${familyName}`,
    gender,
    guardianCharacterId: mother.id,
    guardianName: mother.name,
    regionId: mother.region,
    ageDays: 0,
    bornWeek: week
  };
}

/**
 * Assigns a free bed to a mother who reached term, preferring the best ward she
 * can still get. Returns null when every bed is taken.
 */
export function assignFreeWard(
  state: Pick<HospitalState, 'wardCounts' | 'patients'>,
  complicated: boolean
): HospitalWardId | null {
  const preference: HospitalWardId[] = complicated
    ? ['ward_icu', 'ward_surgical', 'ward_comfort', 'ward_standard']
    : ['ward_comfort', 'ward_surgical', 'ward_icu', 'ward_standard'];
  for (const id of preference) {
    const capacity = wardCount(state as HospitalState, id) * (getWardDefinition(id)?.beds ?? 0);
    const used = state.patients.filter(patient => patient.wardId === id).length;
    if (capacity > used) return id;
  }
  return null;
}

/**
 * Chance that the delivery goes wrong, driven by the mother's own condition.
 * An exhausted or unwell mother is far likelier to complicate.
 */
export function complicationChance(
  mother: Character,
  analgesiaInStock: boolean,
  random: () => number = Math.random
): boolean {
  const health = Math.max(0, Math.min(100, mother.exactHealth ?? 70));
  const frailty = (100 - health) / 100;
  const painRelief = analgesiaInStock ? 0 : 0.05;
  return random() < Math.min(0.6, 0.12 + frailty * 0.25 + painRelief);
}

/** What care a mother in the given bed actually receives. */
export interface CareAssessment {
  ward: HospitalWardDefinition | undefined;
  quality: number;
  missingItems: HospitalEquipmentDefinition[];
  equipmentPenalty: number;
  complications: boolean;
  successChance: number;
}

/** Works out the delivery odds from ward tier, stock on hand and staffed staff. */
export function assessDelivery(
  stock: Record<string, number>,
  wardId: HospitalWardId,
  complicated: boolean,
  staff: HospitalStaffEffects
): CareAssessment {
  const ward = getWardDefinition(wardId);
  const quality = ward?.quality ?? 0;

  const missingItems = HOSPITAL_EQUIPMENT.filter(item => {
    const required = item.timing === 'always' || complicated;
    return required && equipmentStock(stock, item.id) < item.perDelivery;
  });
  const equipmentPenalty = Math.min(
    55,
    missingItems.reduce((sum, item) => sum + item.missingPenalty, 0)
  );

  const careScore = quality * 8 + staff.nurseBonus + staff.midwifeBonus;
  const difficulty = 12 + (complicated ? 25 : 0);
  const successChance = Math.max(5, Math.min(95, Math.round(72 + careScore - difficulty - equipmentPenalty)));

  return { ward, quality, missingItems, equipmentPenalty, complications: complicated, successChance };
}

/** Burns the consumables one delivery requires. */
export function consumeEquipment(
  stock: Record<string, number>,
  assessment: CareAssessment
): Record<string, number> {
  return consumeCareEquipment(stock, assessment.complications);
}

/** Burns every consumable a case of this complexity needs. */
export function consumeCareEquipment(stock: Record<string, number>, complications: boolean): Record<string, number> {
  const next = { ...stock };
  for (const item of HOSPITAL_EQUIPMENT) {
    const required = item.timing === 'always' || complications;
    if (!required) continue;
    next[item.id] = Math.max(0, equipmentStock(stock, item.id) - item.perDelivery);
  }
  return next;
}

/**
 * True when a roster member is in such bad shape that the medical staff take
 * them into a ward rather than let them keep working through it.
 */
export function needsHospitalTreatment(character: Pick<Character, 'exactHealth'>): boolean {
  const health = Math.max(0, Math.min(100, character.exactHealth ?? 100));
  return health <= TREATMENT_HEALTH_THRESHOLD;
}

/** Health the ward and the nurses on duty restore in one week. */
export function weeklyTreatmentGain(
  ward: HospitalWardDefinition | undefined,
  staff: HospitalStaffEffects
): number {
  return Math.max(4, 8 + (ward?.quality ?? 0) * 4 + Math.floor(staff.nurseBonus / 2));
}

/**
 * Weeks the stay needs to close the gap to {@link TREATMENT_TARGET_HEALTH}.
 * A weak ward stretches the stay to its cap and still leaves the patient short.
 */
export function treatmentWeeks(health: number, weeklyGain: number): number {
  const deficiency = TREATMENT_TARGET_HEALTH - Math.max(0, Math.min(100, health));
  const weeks = Math.ceil(deficiency / Math.max(1, weeklyGain));
  return Math.max(1, Math.min(TREATMENT_MAX_WEEKS, weeks));
}

export interface TreatmentAssessment {
  ward: HospitalWardDefinition | undefined;
  /** Consumables the stay needs but the depot does not hold. */
  missingItems: HospitalEquipmentDefinition[];
  /** Health restored per week while the patient holds the bed. */
  weeklyGain: number;
  weeks: number;
}

/** Works out how a treatment stay will run before the bed is booked. */
export function assessTreatment(
  stock: Record<string, number>,
  wardId: HospitalWardId,
  staff: HospitalStaffEffects,
  health: number,
  critical: boolean
): TreatmentAssessment {
  const ward = getWardDefinition(wardId);
  const missingItems = HOSPITAL_EQUIPMENT.filter(item => {
    const required = item.timing === 'always' || critical;
    return required && equipmentStock(stock, item.id) < item.perDelivery;
  });
  // Treating on whatever happens to be in the cupboard heals far slower.
  const shortage = missingItems.reduce((sum, item) => sum + item.missingPenalty, 0);
  const weeklyGain = Math.max(2, weeklyTreatmentGain(ward, staff) - shortage);
  return { ward, missingItems, weeklyGain, weeks: treatmentWeeks(health, weeklyGain) };
}

/**
 * Risk score of a pregnancy, from the mother's own condition and what the depot
 * actually holds. Zero is a healthy term baby waiting its date; one is a case
 * the ward has to be watching every week.
 */
export interface PregnancyRisk {
  score: number;
  reasons: string[];
}

/**
 * Scores a pregnancy. Every case carries some risk as the term runs out, so the
 * score grows with the weeks; poor health, exhaustion, maternal age and a depot
 * short of analgesia or newborn kits push it up sharply.
 */
export function assessPregnancyRisk(
  mother: Pick<Character, 'exactHealth' | 'exactExhaustion' | 'age' | 'pregnancy'>,
  stock: Record<string, number>
): PregnancyRisk {
  const health = Math.max(0, Math.min(100, mother.exactHealth ?? 70));
  const exhaustion = Math.max(0, Math.min(100, mother.exactExhaustion ?? 40));
  const daysPregnant = Math.max(0, Math.min(GESTATION_DAYS, mother.pregnancy?.daysPregnant ?? 0));
  const reasons: string[] = [];

  let score = (daysPregnant / GESTATION_DAYS) * 0.35;

  if (health <= PREGNANCY_RISK_HEALTH) {
    score += ((PREGNANCY_RISK_HEALTH - health) / PREGNANCY_RISK_HEALTH) * 0.45;
    reasons.push(`здоровье ${health} из 100`);
  }

  if (exhaustion >= PREGNANCY_RISK_EXHAUSTION) {
    score += ((exhaustion - PREGNANCY_RISK_EXHAUSTION) / (100 - PREGNANCY_RISK_EXHAUSTION)) * 0.3;
    reasons.push(`усталость ${exhaustion} из 100`);
  }

  if ((mother.age ?? 0) >= PREGNANCY_RISK_AGE) {
    score += 0.15;
    reasons.push(`возраст ${mother.age}`);
  }

  if (equipmentStock(stock, 'eq_analgesia') <= 0) {
    score += 0.12;
    reasons.push('нет обезболивания на складе');
  }
  if (equipmentStock(stock, 'eq_infant') <= 0) {
    score += 0.1;
    reasons.push('нет набора ухода за новорождённым');
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

/** True when the medical staff take a pregnancy into a bed before term. */
export function needsPregnancyObservation(
  mother: Pick<Character, 'exactHealth' | 'exactExhaustion' | 'age' | 'pregnancy'>,
  stock: Record<string, number>
): mother is Pick<Character, 'exactHealth' | 'exactExhaustion' | 'age' | 'pregnancy'> & { pregnancy: PregnancyState } {
  if (mother.pregnancy?.status !== 'pregnant') return false;
  if (mother.pregnancy.daysPregnant >= GESTATION_DAYS) return false;
  return assessPregnancyRisk(mother, stock).score >= PREGNANCY_RISK_ADMIT;
}

export interface ObservationAssessment {
  ward: HospitalWardDefinition | undefined;
  missingItems: HospitalEquipmentDefinition[];
  /** Health restored per week while the pregnancy is watched. */
  weeklyGain: number;
  /** Weeks the mother holds the bed for. */
  weeks: number;
  /** Chance the pregnancy survives the stay, in percent. */
  survivalChance: number;
}

/**
 * Works out how a threatened pregnancy runs: how long the mother stays, what the
 * stay gives her back, and the odds the child is still there at the end of it.
 */
export function assessObservation(
  stock: Record<string, number>,
  wardId: HospitalWardId,
  staff: HospitalStaffEffects,
  risk: PregnancyRisk
): ObservationAssessment {
  const ward = getWardDefinition(wardId);
  const missingItems = HOSPITAL_EQUIPMENT.filter(item =>
    (item.timing === 'always' || item.id === 'eq_infant')
    && equipmentStock(stock, item.id) < item.perDelivery
  );
  const shortage = Math.min(40, missingItems.reduce((sum, item) => sum + item.missingPenalty, 0));
  const quality = ward?.quality ?? 0;
  const careScore = quality * 8 + staff.nurseBonus + staff.midwifeBonus;
  // The riskier the case, the harder it is to hold on to the pregnancy.
  const survivalChance = Math.max(
    15,
    Math.min(95, Math.round(94 - risk.score * 55 + careScore - shortage))
  );
  const weeklyGain = Math.max(3, 6 + quality * 3 + Math.floor(staff.nurseBonus / 2));
  const weeks = Math.max(1, Math.min(OBSERVATION_MAX_WEEKS, 1 + Math.ceil(risk.score * 2)));
  return { ward, missingItems, weeklyGain, weeks, survivalChance };
}

/** Picks one of the employees posted to the hospital to run the escort. */
export function pickEscort(
  staff: HospitalStaffEffects,
  random: () => number = Math.random
): string | null {
  const pool = (staff.escortNames ?? []).filter(name => Boolean(name?.trim()));
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)] ?? pool[0];
}

/**
 * Clause naming who runs the escort. Wording avoids verb agreement so a roster
 * member of any gender, escorted by an employee of any gender, reads correctly.
 */
function escortClause(staff: HospitalStaffEffects, random: () => number): string {
  const name = pickEscort(staff, random);
  return name ? `сопровождает сотрудник ${name}` : 'сопровождает дежурный сотрудник';
}

/** Weeks of recovery after delivery, shortened by midwives and ward tier. */
export function recoveryWeeks(staff: HospitalStaffEffects, ward: HospitalWardDefinition | undefined): number {
  const quality = ward?.quality ?? 0;
  return Math.max(1, Math.min(4, 1 + Math.floor(staff.midwifeBonus / 10) + Math.max(0, quality - 2)));
}

export interface TreatmentBooking {
  patient: HospitalPatient;
  wardName: string;
}

/**
 * Books a treatment bed for a roster member: picks the free ward that matches
 * the severity, prices the stay and burns the consumables it needs. Returns null
 * when every bed is taken, so callers can queue the case instead.
 */
export function bookTreatmentStay(
  state: Pick<HospitalState, 'wardCounts' | 'patients' | 'equipment'>,
  character: Pick<Character, 'id' | 'name' | 'exactHealth'>,
  staff: HospitalStaffEffects,
  week: number
): TreatmentBooking | null {
  const health = Math.max(0, Math.min(100, character.exactHealth ?? 100));
  const critical = health <= CRITICAL_TREATMENT_HEALTH;
  const wardId = assignFreeWard(state, critical);
  if (!wardId) return null;

  const assessment = assessTreatment(state.equipment, wardId, staff, health, critical);
  return {
    wardName: assessment.ward?.name ?? 'палата',
    patient: {
      characterId: character.id,
      characterName: character.name,
      wardId,
      admission: 'treatment',
      complicated: critical,
      weeksRemaining: assessment.weeks,
      delivered: false,
      admittedWeek: week,
      weeklyGain: assessment.weeklyGain,
      missingItemIds: assessment.missingItems.map(item => item.id)
    }
  };
}

/**
 * Runs the hospital for one campaign week: delivers the mothers whose week in
 * the ward is up, discharges the recovered, admits everyone who reached term as
 * beds allow, and reports the ward upkeep.
 */
export function advanceHospitalWeek(
  roster: Character[],
  dependents: Dependent[],
  state: HospitalState,
  options: HospitalTickOptions
): HospitalTickResult {
  const random = options.random ?? Math.random;
  const restingIds = new Set(options.restingCharacterIds ?? []);
  const logs: string[] = [];
  const ledger: HospitalLedgerEntry[] = [];
  const stillAdmitted: HospitalPatient[] = [];
  const newborns: Dependent[] = [];
  const byId = new Map(roster.map(character => [character.id, character]));
  // Local stock so several cases in one week cannot spend the same unit.
  let stock: Record<string, number> = { ...state.equipment };
  /** Characters rewritten by delivery/recovery/treatment, applied when the roster maps. */
  const rewritten = new Map<string, Character>();
  const hasMedicalStaff = (options.staff.nurses ?? 0) > 0 || (options.staff.midwives ?? 0) > 0;

  for (const patient of state.patients) {
    const occupant = byId.get(patient.characterId);
    if (!occupant) continue; // the patient left the roster while admitted

    // Treatment stay: health comes back by a slice every week, then discharge.
    if (isTreatmentStay(patient)) {
      const gain = Math.max(2, Math.floor(patient.weeklyGain ?? 6));
      const healed: Character = {
        ...(rewritten.get(occupant.id) ?? occupant),
        exactHealth: Math.min(100, (rewritten.get(occupant.id) ?? occupant).exactHealth + gain)
      };
      healed.healthLevel = healthFromExact(healed.exactHealth);
      rewritten.set(occupant.id, healed);

      if (patient.weeksRemaining > 1) {
        stillAdmitted.push({ ...patient, weeksRemaining: patient.weeksRemaining - 1 });
        continue;
      }

      const wardName = getWardDefinition(patient.wardId)?.name ?? 'палата';
      const shortfall = (patient.missingItemIds ?? []).length > 0
        ? ` Не хватило оснащения: ${(patient.missingItemIds ?? [])
          .map(id => getEquipmentDefinition(id)?.name ?? id)
          .join(', ')}.`
        : '';
      const outcome = healed.exactHealth >= 60
        ? (occupant.gender === 'women' ? 'выздоровела' : 'выздоровел')
        : 'выписан(а) в тяжёлом состоянии';
      const message = `${patient.characterName} ${outcome} после лечения в палате «${wardName}» (здоровье ${healed.exactHealth} из 100).${shortfall}`;
      logs.push(message);
      ledger.push({ week: options.week, message, tone: 'discharge' });
      continue;
    }

    // Observation stay: a pregnancy the staff pulled off the floor before term.
    // Health comes back by a slice every week; on the last week the case is
    // either held together or lost.
    if (isObservationStay(patient)) {
      const base = rewritten.get(occupant.id) ?? occupant;
      const gain = Math.max(3, Math.floor(patient.weeklyGain ?? 6));
      const watched: Character = {
        ...base,
        exactHealth: Math.min(100, base.exactHealth + gain),
        exactExhaustion: Math.max(0, base.exactExhaustion - 20)
      };
      watched.healthLevel = healthFromExact(watched.exactHealth);
      rewritten.set(occupant.id, watched);

      if (patient.weeksRemaining > 1) {
        stillAdmitted.push({ ...patient, weeksRemaining: patient.weeksRemaining - 1 });
        continue;
      }

      const wardName = getWardDefinition(patient.wardId)?.name ?? 'палата';
      const shortfall = (patient.missingItemIds ?? []).length > 0
        ? ` Не хватило оснащения: ${(patient.missingItemIds ?? [])
          .map(id => getEquipmentDefinition(id)?.name ?? id)
          .join(', ')}.`
        : '';
      const { pregnancy: _cleared, ...clean } = watched;
      void _cleared;

      if (random() * 100 < Math.max(0, Math.min(100, patient.survivalChance ?? 60))) {
        // The pregnancy holds. She goes back to work still pregnant.
        const { hospitalAdmission: _reason, ...pregnancy } = watched.pregnancy ?? {
          status: 'pregnant' as const,
          daysPregnant: GESTATION_DAYS,
          hospitalWeeksRemaining: 0
        };
        void _reason;
        rewritten.set(occupant.id, {
          ...clean,
          loyalty: Math.min(100, clean.loyalty + 3),
          pregnancy: {
            status: 'pregnant' as const,
            daysPregnant: Math.max(0, Math.min(GESTATION_DAYS, pregnancy.daysPregnant)),
            hospitalWeeksRemaining: 0
          }
        });
        const message = `Наблюдение в палате «${wardName}»: ${patient.characterName} выписана беременной, срок ${Math.round((watched.pregnancy?.daysPregnant ?? 0) / DAYS_PER_WEEK)} нед., угроза прошла (шанс ${patient.survivalChance}%).${shortfall}`;
        logs.push(message);
        ledger.push({ week: options.week, message, tone: 'discharge' });
        continue;
      }

      // The case is lost: the pregnancy ends and the mother pays for it.
      rewritten.set(occupant.id, {
        ...clean,
        exactHealth: Math.max(10, clean.exactHealth - 20),
        healthLevel: healthFromExact(Math.max(10, clean.exactHealth - 20)),
        loyalty: Math.max(10, clean.loyalty - 12),
        exactExhaustion: Math.min(100, clean.exactExhaustion + 20)
      });
      const lossMessage = `Наблюдение в палате «${wardName}» пошло не так (шанс ${patient.survivalChance}%): ${patient.characterName} потеряла беременность на ${Math.round((watched.pregnancy?.daysPregnant ?? 0) / DAYS_PER_WEEK)} неделе.${shortfall}`;
      logs.push(lossMessage);
      ledger.push({ week: options.week, message: lossMessage, tone: 'loss' });
      continue;
    }

    // From here on the bed belongs to a maternity case.
    const mother = occupant;

    // Recovery week: count down, then discharge.
    if (patient.delivered) {
      if (patient.weeksRemaining > 1) {
        stillAdmitted.push({ ...patient, weeksRemaining: patient.weeksRemaining - 1 });
      } else {
        const discharged: Character = {
          ...(rewritten.get(mother.id) ?? mother),
          exactHealth: Math.min(100, (rewritten.get(mother.id) ?? mother).exactHealth + 8),
          healthLevel: 'Good',
          assignedTask: undefined
        };
        delete discharged.assignedTask;
        rewritten.set(mother.id, discharged);
        const message = `${patient.characterName} выписана из палаты «${getWardDefinition(patient.wardId)?.name ?? 'палата'}».`;
        logs.push(message);
        ledger.push({ week: options.week, message, tone: 'discharge' });
      }
      continue;
    }

    // Still travelling to term.
    if (patient.weeksRemaining > 1) {
      stillAdmitted.push({ ...patient, weeksRemaining: patient.weeksRemaining - 1 });
      continue;
    }

    const assessment = assessDelivery(stock, patient.wardId, patient.complicated, options.staff);
    const success = random() * 100 < assessment.successChance;
    stock = consumeEquipment(stock, assessment);
    const wardName = assessment.ward?.name ?? 'палата';

    if (success) {
      const newborn = createNewborn(mother, options.week, random);
      newborns.push(newborn);
      const { pregnancy: _cleared, ...clean } = mother;
      void _cleared;
      rewritten.set(mother.id, {
        ...clean,
        exactHealth: Math.min(100, Math.max(40, mother.exactHealth + 20 + options.staff.nurseBonus * 2)),
        healthLevel: 'Good',
        loyalty: Math.min(100, mother.loyalty + 5),
        exactExhaustion: Math.max(0, mother.exactExhaustion - 20)
      });
      const message = `Роды в палате «${wardName}»: ${mother.name} родила ${newborn.gender === 'female' ? 'девочку' : 'мальчика'} ${newborn.name}. Исход был ${assessment.successChance}% (${patient.complicated ? 'осложнённые роды' : 'нормальные роды'}).`;
      logs.push(message);
      ledger.push({ week: options.week, message, tone: 'birth' });
      stillAdmitted.push({
        ...patient,
        delivered: true,
        weeksRemaining: recoveryWeeks(options.staff, assessment.ward)
      });
      continue;
    }

    // Failure: usually the child is lost, sometimes the mother pays in her body.
    const childLost = random() < 0.6;
    const { pregnancy: _cleared, ...clean } = mother;
    void _cleared;
    rewritten.set(mother.id, {
      ...clean,
      exactHealth: childLost ? Math.max(15, mother.exactHealth - 25) : 30,
      healthLevel: childLost ? 'Fair' : 'Critical',
      loyalty: Math.max(10, mother.loyalty - 10),
      exactExhaustion: Math.min(100, mother.exactExhaustion + 25)
    });
    const shortfall = assessment.missingItems.length > 0
      ? ` Не хватило оснащения: ${assessment.missingItems.map(item => item.name).join(', ')}.`
      : '';
    const message = `Роды в палате «${wardName}» пошли не так (шанс исхода ${assessment.successChance}%): ${childLost
      ? `${mother.name} потеряла ребёнка.`
      : `${mother.name} выжила, но её состояние критическое.`}${shortfall}`;
    logs.push(message);
    ledger.push({ week: options.week, message, tone: 'loss' });
  }

  // Admissions: mothers who reached term, as beds allow.
  const bedState: Pick<HospitalState, 'wardCounts' | 'patients'> = { wardCounts: state.wardCounts, patients: stillAdmitted };
  const admitted = new Set(stillAdmitted.map(patient => patient.characterId));

  const nextRoster = roster.map(character => {
    const updated = rewritten.get(character.id);
    if (updated) return updated;
    const pregnancy = character.pregnancy;

    if (pregnancy?.status === 'hospitalized') {
      if (admitted.has(character.id)) return character;
      // Booked as hospitalized but no bed is on file (an older save): put her
      // back in the queue so she is admitted again instead of stalling forever.
      return { ...character, pregnancy: { status: 'pregnant' as const, daysPregnant: GESTATION_DAYS, hospitalWeeksRemaining: 0 } };
    }

    if (pregnancy?.status !== 'pregnant' || pregnancy.daysPregnant < GESTATION_DAYS) return character;
    if (admitted.has(character.id)) return character;

    const complicated = complicationChance(character, equipmentStock(stock, 'eq_analgesia') > 0, random);
    const wardId = assignFreeWard(bedState, complicated);
    if (!wardId) {
      const message = `${character.name} доносила до ${GESTATION_DAYS} дней, но свободных палат нет — роженица ждёт места.`;
      logs.push(message);
      ledger.push({ week: options.week, message, tone: 'shortage' });
      return { ...character, pregnancy: { ...pregnancy, daysPregnant: GESTATION_DAYS } };
    }

    stillAdmitted.push({
      characterId: character.id,
      characterName: character.name,
      wardId,
      admission: 'birth',
      complicated,
      weeksRemaining: 1,
      delivered: false,
      admittedWeek: options.week
    });
    admitted.add(character.id);

    const wardName = getWardDefinition(wardId)?.name ?? 'палата';
    const escort = `В палату «${wardName}» больницы на роды забирают ${character.name} — ${escortClause(options.staff, random)}.`;
    logs.push(escort);
    ledger.push({ week: options.week, message: escort, tone: 'admission' });
    const escortNotice = `В палату «${wardName}» больницы на роды забирают ${character.name}${complicated ? ', осложнённые роды, нужна операционная' : ''}. ${escortClause(options.staff, random)}.`;
    options.onNotify?.(escortNotice);
    return {
      ...character,
      pregnancy: { status: 'hospitalized' as const, daysPregnant: GESTATION_DAYS, hospitalWeeksRemaining: 1, wardId }
    };
  });

  // Observation admissions: the medical staff score every pregnancy still on the
  // floor and take the risky ones into a bed before term, whatever week it is.
  // This runs after the term mothers so a mother due this week keeps her bed, and
  // before the treatment queue so a threatened pregnancy outranks a sore back.
  const riskyQueue = nextRoster.filter(c =>
    !admitted.has(c.id)
    && !c.assignedTask
    && !restingIds.has(c.id)
    && needsPregnancyObservation(c, stock)
  );
  if (!hasMedicalStaff && riskyQueue.length > 0) {
    logs.push(`БОЛЬНИЦА: Нет дежурных медсестер или акушерок — наблюдение за беременными приостановлено. В очереди: ${riskyQueue.map(c => c.name).join(', ')}.`);
  }
  const watchedRoster = nextRoster.map(character => {
    if (admitted.has(character.id)) return character;
    if (!needsPregnancyObservation(character, stock)) return character;
    // No medical staff on duty: nobody can watch the case.
    if (!hasMedicalStaff) return character;
    // Away on a mission or already healing in the rest zone: no need for a bed.
    if (character.assignedTask || restingIds.has(character.id)) return character;

    const risk = assessPregnancyRisk(character, stock);
    // A riskier case goes to the higher wards, so a threatened pregnancy can
    // reach the surgical theatre or intensive care if one is free.
    const wardId = assignFreeWard(bedState, risk.score >= 0.6);
    if (!wardId) {
      const message = `${character.name} под наблюдением (риск ${Math.round(risk.score * 100)}%: ${risk.reasons.join(', ') || 'поздний срок'}), но свободных палат нет — ждёт места.`;
      logs.push(message);
      ledger.push({ week: options.week, message, tone: 'shortage' });
      return character;
    }

    const assessment = assessObservation(stock, wardId, options.staff, risk);
    stock = consumeCareEquipment(stock, risk.score >= 0.6);

    stillAdmitted.push({
      characterId: character.id,
      characterName: character.name,
      wardId,
      admission: 'observation',
      complicated: risk.score >= 0.6,
      weeksRemaining: assessment.weeks,
      delivered: false,
      admittedWeek: options.week,
      weeklyGain: assessment.weeklyGain,
      missingItemIds: assessment.missingItems.map(item => item.id),
      survivalChance: assessment.survivalChance,
      riskScore: risk.score
    });
    admitted.add(character.id);

    const wardName = assessment.ward?.name ?? 'палата';
    const detail = risk.reasons.length > 0 ? ` (${risk.reasons.join(', ')})` : '';
    const escort = `В палату «${wardName}» на наблюдение забирают ${character.name}, срок ${Math.round(character.pregnancy.daysPregnant / DAYS_PER_WEEK)} нед., риск ${Math.round(risk.score * 100)}%${detail}, сохранение беременности ${assessment.survivalChance}% — ${escortClause(options.staff, random)}.`;
    logs.push(escort);
    ledger.push({ week: options.week, message: escort, tone: 'admission' });
    options.onNotify?.(escort);
    return {
      ...character,
      pregnancy: {
        ...character.pregnancy,
        hospitalWeeksRemaining: assessment.weeks,
        wardId,
        hospitalAdmission: 'observation' as const
      }
    };
  });

  // Treatment admissions: a roster member in bad health is walked into a bed by a
  // member of the medical staff, as long as the wards still have room and staff
  // are on duty. Mothers booked above already hold a bed, so they never
  // double-book the same week.
  const candidatesNeedingTreatment = nextRoster.filter(c =>
    !admitted.has(c.id) && needsHospitalTreatment(c) && !c.assignedTask && !restingIds.has(c.id)
  );
  if (!hasMedicalStaff && candidatesNeedingTreatment.length > 0) {
    logs.push(`БОЛЬНИЦА: Нет дежурных медсестер или акушерок — лечение персонала приостановлено. В очереди: ${candidatesNeedingTreatment.map(c => c.name).join(', ')}.`);
  }
  const finalRoster = watchedRoster.map(character => {
    if (admitted.has(character.id)) return character;
    if (!needsHospitalTreatment(character)) return character;
    // No medical staff on duty: treatment admissions are suspended.
    if (!hasMedicalStaff) return character;
    // Away on a mission or already healing in the rest zone: no need for a bed.
    if (character.assignedTask || restingIds.has(character.id)) return character;

const booking = bookTreatmentStay(
      { wardCounts: state.wardCounts, patients: stillAdmitted, equipment: stock },
      character,
      options.staff,
      options.week
    );
    if (!booking) {
      const message = `${character.name} плохое здоровье (${character.exactHealth}), но свободных палат нет — ждёт места.`;
      logs.push(message);
      ledger.push({ week: options.week, message, tone: 'shortage' });
      return character;
    }
    stock = consumeCareEquipment(stock, booking.patient.complicated);

    stillAdmitted.push(booking.patient);
    admitted.add(character.id);

    const message = `В палату «${booking.wardName}» на лечение забирают ${character.name} (здоровье ${character.exactHealth}, ${booking.patient.weeksRemaining} нед.) — ${escortClause(options.staff, random)}.`;
    logs.push(message);
    ledger.push({ week: options.week, message, tone: 'admission' });
    options.onNotify?.(message);
    return character;
  });

  const upkeep = weeklyUpkeep(state);
  return {
    roster: finalRoster,
    dependents: [...dependents, ...newborns],
    hospital: {
      ...state,
      equipment: stock,
      patients: stillAdmitted,
      ledger: [...ledger, ...state.ledger].slice(0, 12)
    },
    upkeep,
    logs
  };
}

/**
 * Rebuilds the bed list for characters left mid-stay by an older save, so a
 * loaded campaign never loses an admitted mother or double-books a bed.
 */
export function reconcilePatients(state: HospitalState, roster: Character[]): HospitalState {
  const known = new Set(state.patients.map(patient => patient.characterId));
  const orphans = roster.filter(character =>
    character.pregnancy?.status === 'hospitalized' && !known.has(character.id)
  );
  if (orphans.length === 0) return state;

  const patients = [...state.patients];
  for (const mother of orphans) {
    const bedState: Pick<HospitalState, 'wardCounts' | 'patients'> = { wardCounts: state.wardCounts, patients };
    const wardId = (mother.pregnancy?.wardId as HospitalWardId | undefined)
      ?? assignFreeWard(bedState, false);
    if (!wardId) continue;
    patients.push({
      characterId: mother.id,
      characterName: mother.name,
      wardId,
      admission: 'birth',
      complicated: false,
      weeksRemaining: mother.pregnancy?.hospitalWeeksRemaining || 1,
      delivered: false,
      admittedWeek: 0
    });
  }
  return { ...state, patients };
}
