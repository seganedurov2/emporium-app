import type {
  AuxiliaryBuildingState,
  BuildingWeeklyEffects,
  Employee,
  EmployeeCandidate,
  EmployeeGender,
  EmployeeSpecialty
} from './expansionTypes';
import { BUILDING_DEFINITIONS } from './buildingsEngine';
import { assetUrl } from './assetUrl';
import {
  DEFAULT_PORTRAIT_FOLDER,
  pickPortraitFileNumber,
  pickPortraitModelPath,
  type PortraitSex
} from './portraitAssets';

/**
 * Найм и управление сотрудниками синдиката.
 *
 * Структура повторяет PLEASURE_HOUSE_UPGRADES:
 * специальности хранятся в Record (а не массиве), явный список ID —
 * в EMPLOYEE_SPECIALTY_IDS, а вычисления вынесены в чистые функции.
 */

export const BASE_EMPLOYEE_SLOTS = 12;
/** Price of the first position bought on top of {@link BASE_EMPLOYEE_SLOTS}. */
export const HIRING_SLOT_BASE_COST = 6000;
/** Every position after the first bought one costs this much more than the previous. */
export const HIRING_SLOT_COST_GROWTH = 0.10;
/** Weekly bill for one bought position, whether it is filled or not. */
export const HIRING_SLOT_UPKEEP = 150;

export const EMPLOYEE_CANDIDATE_CAP = 5;
export const EXPERIENCE_PER_SKILL_POINT = 100;

/** Price of the next staff position. */
export function nextHiringSlotCost(hiringSlots: number): number {
  const extraSlots = Math.max(0, hiringSlots - BASE_EMPLOYEE_SLOTS);
  return Math.round(HIRING_SLOT_BASE_COST * Math.pow(1 + HIRING_SLOT_COST_GROWTH, extraSlots));
}

/** Weekly cost of keeping the bought positions open. Free positions cost nothing. */
export function hiringSlotUpkeep(hiringSlots: number): number {
  return Math.max(0, hiringSlots - BASE_EMPLOYEE_SLOTS) * HIRING_SLOT_UPKEEP;
}

export interface HiringSlotQuote {
  cost: number;
  affordable: boolean;
  slotsAfter: number;
  /** Weekly bill the purchase adds. */
  upkeep: number;
}

/** Price of the next position, or null when it cannot be afforded yet. */
export function quoteHiringSlot(hiringSlots: number, funds: number): HiringSlotQuote {
  const cost = nextHiringSlotCost(hiringSlots);
  return { cost, affordable: funds >= cost, slotsAfter: hiringSlots + 1, upkeep: HIRING_SLOT_UPKEEP };
}

export interface EmployeeSpecialtyDefinition {
  id: EmployeeSpecialty;
  label: string;
  role: string;
  wageRange: [number, number];
  /**
   * When set, only candidates of this sex can take (or be posted to) the role.
   * The BDSM Room pairs a woman («госпожа») with a man («мастер»); every other
   * specialty leaves this undefined and is open to anyone.
   */
  requiredGender?: EmployeeGender;
}

export const EMPLOYEE_SPECIALTIES: Record<EmployeeSpecialty, EmployeeSpecialtyDefinition> = {
  teacher: { id: 'teacher', label: 'Преподавание', role: 'Преподаватель', wageRange: [650, 1250] },
  coach: { id: 'coach', label: 'Саморазвитие', role: 'Коуч', wageRange: [700, 1350] },
  clinician: { id: 'clinician', label: 'Медицина', role: 'Медицинский специалист', wageRange: [850, 1600] },
  nurse: { id: 'nurse', label: 'Медсестра', role: 'Медсестра', wageRange: [900, 1750] },
  midwife: { id: 'midwife', label: 'Акушерство', role: 'Акушерка', wageRange: [1150, 2150] },
  psychologist: { id: 'psychologist', label: 'Психология', role: 'Психолог', wageRange: [1000, 1900] },
  escort: { id: 'escort', label: 'Сопровождение', role: 'Сопровождающий каравана', wageRange: [900, 1700] },
  guard: { id: 'guard', label: 'Охрана', role: 'Охранник', wageRange: [750, 1450] },
  secretary: { id: 'secretary', label: 'Секретариат', role: 'Секретарь', wageRange: [800, 1500] },
  lawyer: { id: 'lawyer', label: 'Право', role: 'Юрист', wageRange: [1200, 2400] },
  attendant: { id: 'attendant', label: 'Зона отдыха', role: 'Смотритель зоны отдыха', wageRange: [600, 1200] },
  mistress: { id: 'mistress', label: 'Госпожа', role: 'Госпожа (БДСМ-комната)', wageRange: [1100, 2200], requiredGender: 'women' },
  master: { id: 'master', label: 'Мастер', role: 'Мастер (БДСМ-комната)', wageRange: [1100, 2200], requiredGender: 'men' },
  janitor: { id: 'janitor', label: 'Уборка', role: 'Уборщик (БДСМ-комната)', wageRange: [500, 950] },
  auctioneer: { id: 'auctioneer', label: 'Аукционный дом', role: 'Аукционист', wageRange: [1000, 2000] },
  appraiser: { id: 'appraiser', label: 'Оценка товаров', role: 'Оценщик товаров', wageRange: [900, 1800] },
  dj: { id: 'dj', label: 'Диджей', role: 'Диджей (стрип-клуб)', wageRange: [850, 1650] },
  administrator: { id: 'administrator', label: 'Администрирование', role: 'Администратор (стрип-клуб)', wageRange: [950, 1850] },
  financier: { id: 'financier', label: 'Финансы', role: 'Финансист рынка', wageRange: [1100, 2100] }
};

export const EMPLOYEE_SPECIALTY_IDS: EmployeeSpecialty[] = [
  'teacher',
  'coach',
  'clinician',
  'nurse',
  'midwife',
  'psychologist',
  'escort',
  'guard',
  'secretary',
  'lawyer',
  'attendant',
  'mistress',
  'master',
  'janitor',
  'auctioneer',
  'appraiser',
  'dj',
  'administrator',
  'financier'
];

/** Definition by id, for O(1) lookups of wage, gender and label data. */
export function specialtyDefinitionOf(specialty: EmployeeSpecialty): EmployeeSpecialtyDefinition {
  return EMPLOYEE_SPECIALTIES[specialty];
}

/** Sex a specialty demands, or undefined when it is open to anyone. */
export function requiredGenderForSpecialty(specialty: EmployeeSpecialty): EmployeeGender | undefined {
  return EMPLOYEE_SPECIALTIES[specialty].requiredGender;
}

/** Whether an employee/candidate may hold a specialty-gated post. */
export function fitsSpecialty(
  specialty: EmployeeSpecialty,
  gender: EmployeeGender | undefined
): boolean {
  const required = requiredGenderForSpecialty(specialty);
  if (!required) return true;
  return gender === required;
}

/** Wage range for a specialty, indexed by its id. */
export function specialtyWageRange(specialty: EmployeeSpecialty): [number, number] {
  return EMPLOYEE_SPECIALTIES[specialty].wageRange;
}

/**
 * Midpoint of a specialty's wage range, rounded to the nearest pay grade
 * (multiple of 50). Pure: depends only on the specialty definition.
 */
export function midSpecialtyWage(specialty: EmployeeSpecialty): number {
  const [min, max] = EMPLOYEE_SPECIALTIES[specialty].wageRange;
  return Math.round(((min + max) / 2) / 50) * 50;
}

const FEMALE_FIRST_NAMES = ['Мария', 'София', 'Анна', 'Ирина', 'Елена', 'Ольга', 'Дарья', 'Ксения', 'Вера', 'Полина'];
const MALE_FIRST_NAMES = ['Алексей', 'Даниил', 'Михаил', 'Тимур', 'Давид', 'Игорь', 'Пётр', 'Артём', 'Роман', 'Никита'];
const LAST_NAMES = ['Орлов', 'Волков', 'Морозова', 'Соколова', 'Власов', 'Ким', 'Новак', 'Ковалёв', 'Сантос', 'Феррейра'];

const createId = () => `emp_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Specialties the syndicate currently has an unfilled post for. Candidate rolls
 * cycle through these first so hiring always surfaces the role the player can
 * actually assign; once every post is filled the pool falls back to a round-robin
 * over all specialties. The rest zone is not a building, so its attendants are
 * counted from the zone's own posting list.
 */
export function getVacantSpecialties(
  buildings: AuxiliaryBuildingState[] = [],
  employees: Employee[] = [],
  restZoneAttendantIds: string[] = [],
  recommendedAttendants = 0
): EmployeeSpecialty[] {
  const vacant: EmployeeSpecialty[] = [];
  for (const definition of BUILDING_DEFINITIONS) {
    const building = buildings.find(item => item.id === definition.id);
    if (!building || building.level <= 0) continue;
    const assignedIds = new Set(building.assignedEmployeeIds);
    const posted = (specialty: EmployeeSpecialty) => employees.some(employee =>
      employee.status === 'active'
      && assignedIds.has(employee.id)
      && employee.assignedBuildingId === definition.id
      && employee.specialty === specialty
    );
    // A post that accepts several specialties (the hospital wants both a nurse
    // and a midwife; the BDSM Room wants both a госпожа and a мастер) surfaces one
    // vacancy per *role*, not N copies of the first. Each role the building takes
    // that is not yet posted is a vacancy, capped at the required headcount.
    const accepted = definition.compatibleSpecialties;
    let missing = definition.requiredEmployees;
    for (const specialty of accepted) {
      if (missing <= 0) break;
      // Filling every role once covers the required headcount for these posts.
      if (posted(specialty)) continue;
      vacant.push(specialty);
      missing -= 1;
    }
    // If the building still needs bodies beyond one per role, round-robin the rest.
    let index = 0;
    while (missing > 0) {
      const specialty = accepted[index % accepted.length];
      if (posted(specialty) || vacant.filter(item => item === specialty).length > 0) {
        index += 1;
        if (index > accepted.length * definition.requiredEmployees) break;
        continue;
      }
      vacant.push(specialty);
      missing -= 1;
      index += 1;
    }
    // Optional posts (the hospital psychologist) are vacancies too, but a
    // building missing only these still runs, so they never come in pairs.
    for (const specialty of definition.optionalSpecialties ?? []) {
      if (!posted(specialty)) vacant.push(specialty);
    }
  }
  const missingAttendants = Math.max(0, recommendedAttendants - restZoneAttendantIds.length);
  for (let index = 0; index < missingAttendants; index++) {
    vacant.push('attendant');
  }
  return [
    ...vacant.filter(specialty => specialty === 'auctioneer'),
    ...vacant.filter(specialty => specialty === 'appraiser'),
    ...vacant.filter(specialty => specialty !== 'auctioneer' && specialty !== 'appraiser')
  ];
}

/** Employees hired for the rest zone who are free to be posted there. */
export function getAttendantCandidates(employees: Employee[], postedIds: string[]): Employee[] {
  return employees.filter(employee =>
    employee.status === 'active' && employee.specialty === 'attendant' && !postedIds.includes(employee.id));
}

/**
 * Builds the specialty sequence for a candidate slot list: every vacant post
 * comes first, then the full roster rotated by the week so the tail of the list
 * still varies. A single vacancy therefore yields one guaranteed hire instead
 * of flooding the whole pool with the same role.
 */
export function createEmployeeCandidates(
  count = EMPLOYEE_CANDIDATE_CAP,
  prioritySpecialties: EmployeeSpecialty[] = [],
  rotationOffset = 0
): EmployeeCandidate[] {
  const total = EMPLOYEE_SPECIALTY_IDS.length;
  const offset = ((rotationOffset % total) + total) % total;
  const rotation = [
    ...EMPLOYEE_SPECIALTY_IDS.slice(offset),
    ...EMPLOYEE_SPECIALTY_IDS.slice(0, offset)
  ];
  const sequence = [...prioritySpecialties, ...rotation];

  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const specialty = sequence[index % sequence.length];
    const definition = specialtyDefinitionOf(specialty);
    // A gender-locked role (госпожа / мастер) rolls its own sex; the rest are open.
    const gender: EmployeeGender = definition.requiredGender
      ?? (Math.random() < 0.5 ? 'women' : 'men');
    const skill = Math.floor(Math.random() * 36) + 35;
    const wageSpan = definition.wageRange[1] - definition.wageRange[0];
    const weeklyWage = Math.round((definition.wageRange[0] + (skill - 35) / 65 * wageSpan) / 50) * 50;
    const firstNames = gender === 'women' ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
    const folderName = DEFAULT_PORTRAIT_FOLDER;
    const subFolder: PortraitSex = gender;
    const fileNum = pickPortraitFileNumber(folderName, subFolder).toString().padStart(3, '0');
    const genderCode = gender === 'women' ? 'w' : 'm';
    const image = assetUrl(`/portraits/${folderName}/${subFolder}/portrait03${genderCode}_${fileNum}.webp`);
    const modelPath = pickPortraitModelPath(folderName, '03', subFolder);
    const model3d = modelPath ? assetUrl(modelPath) : undefined;
    return {
      id: createId(),
      name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
      specialty,
      gender,
      skill,
      experience: Math.floor(Math.random() * 60),
      morale: Math.floor(Math.random() * 21) + 70,
      weeklyWage,
      image,
      model3d
    };
  });
}

export function refreshEmployeeCandidates(
  candidates: EmployeeCandidate[],
  week: number,
  cap = EMPLOYEE_CANDIDATE_CAP,
  prioritySpecialties: EmployeeSpecialty[] = []
): EmployeeCandidate[] {
  const missing = Math.max(0, cap - candidates.length);
  if (!missing) return candidates;
  return [...candidates, ...createEmployeeCandidates(missing, prioritySpecialties, Math.abs(Math.trunc(week)))];
}

/** Makes newly opened vacancies visible even if the candidate pool is full. */
export function ensureEmployeeCandidatesForVacancies(
  candidates: EmployeeCandidate[],
  prioritySpecialties: EmployeeSpecialty[],
  week: number,
  cap = EMPLOYEE_CANDIDATE_CAP
): EmployeeCandidate[] {
  const auctionPriorities = prioritySpecialties.filter(specialty => specialty === 'auctioneer' || specialty === 'appraiser');
  const otherPriorities = prioritySpecialties.filter(specialty => specialty !== 'auctioneer' && specialty !== 'appraiser');
  const priorities = [...new Set([...auctionPriorities, ...otherPriorities])].slice(0, cap);
  const next = candidates.slice(0, cap);
  let seed = Math.abs(Math.trunc(week));
  for (const [priorityIndex, specialty] of priorities.entries()) {
    if (next.some(candidate => candidate.specialty === specialty)) continue;
    const candidate = createEmployeeCandidates(1, [specialty], seed++)[0];
    let replaceIndex = -1;
    let lowestPriority = priorityIndex;
    for (let index = 0; index < next.length; index++) {
      const candidatePriority = priorities.indexOf(next[index].specialty);
      const rank = candidatePriority < 0 ? Number.POSITIVE_INFINITY : candidatePriority;
      if (rank > lowestPriority) {
        lowestPriority = rank;
        replaceIndex = index;
      }
    }
    if (replaceIndex >= 0) next[replaceIndex] = candidate;
    else if (next.length < cap) next.push(candidate);
  }
  return next;
}

/**
 * Replaces the whole candidate pool with a fresh batch. `refreshEmployeeCandidates`
 * only fills empty slots, so a pool that already sits at the cap never changes on
 * its own; the "Обновить список" action needs a full reroll to show new faces.
 */
export function rerollEmployeeCandidates(
  cap = EMPLOYEE_CANDIDATE_CAP,
  prioritySpecialties: EmployeeSpecialty[] = [],
  rotationOffset = 0
): EmployeeCandidate[] {
  return createEmployeeCandidates(cap, prioritySpecialties, rotationOffset);
}

export function makeHiredEmployee(candidate: EmployeeCandidate, week: number): Employee {
  return {
    ...candidate,
    status: 'active',
    assignedBuildingId: null,
    hiredWeek: week,
    // Employees sign a twelve-week contract by default; permanent staff omit it.
    contractEndWeek: week + DEFAULT_CONTRACT_WEEKS,
    goodWeeksStreak: 0
  };
}

/** Weeks a fresh employee contract runs before renewal is due. */
export const DEFAULT_CONTRACT_WEEKS = 12;

/** Morale an employee must hold to earn a renewal offer without renegotiation. */
export const CONTRACT_RENEWAL_MORALE = 60;

/** Weeks the contract is extended when the employee is happy enough to stay. */
export const CONTRACT_RENEWAL_WEEKS = 12;

/**
 * How many employees' contracts expire this week. Purely informational — the
 * renewal itself is applied by {@link advanceEmployeesWeek}.
 */
export function contractsExpiringThisWeek(employees: Employee[], week: number): Employee[] {
  return employees.filter(
    employee =>
      employee.status === 'active' &&
      typeof employee.contractEndWeek === 'number' &&
      employee.contractEndWeek <= week
  );
}

/**
 * Resolves one employee's contract at week's end. Employees who kept their
 * morale up are renewed automatically; the rest lapse and are returned as
 * `expired` so the caller can drop them from the roster.
 */
export function resolveEmployeeContract(
  employee: Employee,
  week: number
): { employee: Employee; expired: boolean; log: string | null } {
  if (typeof employee.contractEndWeek !== 'number' || employee.contractEndWeek > week) {
    return { employee, expired: false, log: null };
  }

  if (employee.morale >= CONTRACT_RENEWAL_MORALE) {
    return {
      employee: { ...employee, contractEndWeek: week + CONTRACT_RENEWAL_WEEKS },
      expired: false,
      log: `${employee.name} продлил(а) контракт на ${CONTRACT_RENEWAL_WEEKS} недель (мораль ${employee.morale}).`
    };
  }

  return {
    employee,
    expired: true,
    log: `${employee.name} не продлил(а) контракт — низкая мораль (${employee.morale}).`
  };
}

export function getEmployeeWages(employees: Employee[]): number {
  return employees.reduce((sum, employee) => sum + (employee.status === 'active' ? employee.weeklyWage : 0), 0);
}

export interface EmployeeWeekResult {
  employees: Employee[];
  wagesPaid: number;
  logs: string[];
  /** Ids of employees whose contract lapsed this week; the caller must drop them. */
  expiredEmployeeIds: string[];
  /** Contracts automatically extended because morale stayed high enough. */
  renewedContracts: number;
  /** Contracts that lapsed because morale dropped below the renewal threshold. */
  expiredContracts: number;
}

export function advanceEmployeesWeek(
  employees: Employee[],
  effects: Pick<BuildingWeeklyEffects, 'employeeTrainingBonus' | 'employeeMoraleBonus'>,
  week = 0
): EmployeeWeekResult {
  let wagesPaid = 0;
  const logs: string[] = [];
  const expiredEmployeeIds: string[] = [];
  let renewedContracts = 0;
  let expiredContracts = 0;

  const advanced = employees.map(employee => {
    if (employee.status !== 'active') return employee;
    wagesPaid += employee.weeklyWage;

    const assignedBonus = employee.assignedBuildingId ? 2 : 0;
    const gainedExperience = assignedBonus + effects.employeeTrainingBonus;
    let experience = employee.experience + gainedExperience;
    let skill = employee.skill;
    let skillIncreased = false;
    while (experience >= EXPERIENCE_PER_SKILL_POINT && skill < 100) {
      experience -= EXPERIENCE_PER_SKILL_POINT;
      skill += 1;
      skillIncreased = true;
    }
    if (skill >= 100) experience = 0;
    if (skillIncreased) logs.push(`${employee.name} improved ${employee.specialty} skill to ${skill}.`);

    const moraleDelta = (employee.assignedBuildingId ? 1 : -1) + effects.employeeMoraleBonus;
    const morale = Math.max(0, Math.min(100, employee.morale + moraleDelta));
    const goodWeeksStreak = morale >= CONTRACT_RENEWAL_MORALE
      ? Math.min(100, (employee.goodWeeksStreak ?? 0) + 1)
      : 0;
    return { ...employee, experience, skill, morale, goodWeeksStreak };
  });

  const updated = advanced.flatMap(employee => {
    if (employee.status !== 'active') return [employee];
    const resolution = resolveEmployeeContract(employee, week);
    if (resolution.log) logs.push(resolution.log);
    if (resolution.expired) {
      expiredContracts += 1;
      expiredEmployeeIds.push(employee.id);
      return [];
    }
    if (resolution.employee.contractEndWeek !== employee.contractEndWeek) renewedContracts += 1;
    return [resolution.employee];
  });

  return { employees: updated, wagesPaid, logs, expiredEmployeeIds, renewedContracts, expiredContracts };
}
