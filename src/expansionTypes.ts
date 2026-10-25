export type BuildingId =
  | 'school'
  | 'self_development_center'
  | 'clinic'
  | 'hospital'
  | 'caravan_depot'
  | 'guard_post'
  | 'ceo_office'
  | 'legal_dept'
  | 'bdsm_room'
  | 'auction_house';

export type EmployeeSpecialty =
  | 'teacher'
  | 'coach'
  | 'clinician'
  | 'nurse'
  | 'midwife'
  | 'psychologist'
  | 'escort'
  | 'guard'
  | 'secretary'
  | 'lawyer'
  | 'attendant'
  /** BDSM Room staff — a woman («госпожа») trains and keeps the house's captives in line. */
  | 'mistress'
  /** BDSM Room staff — a man («мастер») trains and keeps the house's captives in line. */
  | 'master'
  /** BDSM Room staff — the cleaner («уборщик/уборщица») keeps the room in order. */
  | 'janitor'
  | 'auctioneer'
  | 'appraiser'
  /** Strip club staff — the DJ sets the music and show rhythm. */
  | 'dj'
  /** Strip club staff — the administrator runs the floor and the bookings. */
  | 'administrator'
  /** Global market staff — the financier runs market analysis and deal financing. */
  | 'financier';

/** Sex of an employee; used to gate the gender-locked BDSM Room posts. */
export type EmployeeGender = 'women' | 'men';
export type EmployeeStatus = 'active' | 'leave';
export type BuildingOperationalStatus = 'unbuilt' | 'unstaffed' | 'operating';
export type ExpansionEventCategory = 'education' | 'wellness' | 'operations' | 'opportunity';

export interface EmployeeCandidate {
  id: string;
  name: string;
  specialty: EmployeeSpecialty;
  /** Sex of the candidate, gating gender-locked posts (every specialty but the BDSM pair ignores it). */
  gender: EmployeeGender;
  skill: number; // 1-100
  experience: number; // progress toward the next skill point, 0-99
  morale: number; // 0-100
  weeklyWage: number;
  /** Optional portrait image URL for display in the hiring UI. */
  image?: string;
  /** Optional 3D portrait model URL for the hiring preview. */
  model3d?: string;
}

export interface Employee extends EmployeeCandidate {
  status: EmployeeStatus;
  assignedBuildingId: BuildingId | null;
  hiredWeek: number;
  /** Campaign week the current contract expires; undefined means permanent. */
  contractEndWeek?: number;
  /** Consecutive weeks the employee has worked with high morale. */
  goodWeeksStreak?: number;
}

export interface AuxiliaryBuildingState {
  id: BuildingId;
  level: number; // 0 means not built
  /** Slot-indexed posts; a null entry marks a vacated slot the weekly rollover emptied. */
  assignedEmployeeIds: (string | null)[];
}

export interface BuildingWeeklyEffects {
  employeeTrainingBonus: number;
  employeeMoraleBonus: number;
  rosterHealthRecovery: number;
  /** Hired guards posted at guard facilities, driving the captive escape factor. */
  guardStrength: number;
  /** Escort crew contributed to road missions (caravans, capture squads), one entry per assigned escort. */
  escortCrew: EscortContribution[];
  /** Weekly exhaustion relief granted to the CEO by the office staff. */
  leadershipRelief: number;
  /** Percentage points shaved off slave-buyer contract scandal risk. */
  scandalRiskReduction: number;
  /** Percentage points added to the sale price by an assigned auctioneer. */
  auctioneerSaleBonus: number;
  /** Percentage points shaved off the weekly road ambush roll by the caravan depot. */
  raidRiskReduction: number;
  /** Percentage points added to the ambush fight chance by the caravan depot. */
  raidVictoryBonus: number;
  /** Care points contributed by nurses posted at the hospital. */
  nurseBonus: number;
  /** Care points contributed by midwives posted at the hospital. */
  midwifeBonus: number;
  /**
   * Percentage points shaved off the weekly captive-escape risk by the BDSM Room's
   * posted mistress/master, on top of guards and trade operatives.
   */
  bdsmEscapeReduction: number;
  /** Submission gained each week by captives held at the house under that instructor. */
  bdsmTraining: number;
  operationalBuildingIds: BuildingId[];
}

export interface EscortContribution {
  name: string;
  skill: number;
  /** Employee morale, reused as crew loyalty for raid resolution. */
  loyalty: number;
}

export interface ExpansionEventCondition {
  minWeek?: number;
  maxWeek?: number;
  minFunds?: number;
  buildingId?: BuildingId;
  minBuildingLevel?: number;
  employeeSpecialty?: EmployeeSpecialty;
}

export type ExpansionEventEffect =
  | { type: 'funds'; delta: number }
  | { type: 'reputation'; delta: number }
  | { type: 'employeeMorale'; delta: number; specialty?: EmployeeSpecialty }
  | { type: 'employeeExperience'; delta: number; specialty?: EmployeeSpecialty }
  | { type: 'buildingLevel'; buildingId: BuildingId; delta: number };

export interface ExpansionEventChoice {
  id: string;
  text: string;
  resultMessage: string;
  effects: ExpansionEventEffect[];
}

export interface ExpansionEvent {
  kind: 'expansion';
  id: string;
  title: string;
  description: string;
  category: ExpansionEventCategory;
  conditions: ExpansionEventCondition[];
  choices: ExpansionEventChoice[];
}

export interface ExpansionEventContext {
  week: number;
  funds: number;
  employees: Employee[];
  auxiliaryBuildings: AuxiliaryBuildingState[];
}
