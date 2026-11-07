import type { BankruptcyCase, BankruptcyInitiator, BankruptcyPath, BankruptcyProcedure } from './bankruptcyEngine';
import type { BeautySalonState } from './beautySalonEngine';
import { createEmptyAuctionHouse, normalizeAuctionHouseState, type AuctionHouseState } from './auctionHouseEngine';
import { SAMPLE_CONTRACTS, type ClientContract } from './contractsEngine';
import { createInitialBuildings, getBuildingDefinition, totalPostCount } from './buildingsEngine';
import type { CampaignState, Caravan, Character, Dependent, LoanApplication, PregnancyState, WeeklyFinanceReport } from './gameEngine';
import { generateCharacter, pickAge, pickCountry, pickCity } from './gameEngine';
import { BASE_EMPLOYEE_SLOTS, createEmployeeCandidates } from './employeesEngine';
import { generateSlaveContract, generateCaptiveLotOffer, type CaptiveLotOffer, type SlaveBuyerContract, type StandingMap, type TradeSupplyContract } from './slaveContractsEngine';
import type { Employee, EmployeeCandidate, EmployeeGender, EmployeeSpecialty, AuxiliaryBuildingState, ExpansionEvent } from './expansionTypes';
import type { CaptureOperation } from './captureOpsEngine';
import type { HospitalEquipmentId, HospitalState } from './hospitalEngine';
import { createHospitalState, COMPANY_PROPERTY_AGE_DAYS, GESTATION_DAYS, reconcilePatients } from './hospitalEngine';
import type {
  MetaProgressState,
  PrestigeState
} from './metaProgressEngine';
import { ACHIEVEMENTS, createInitialMetaProgress } from './metaProgressEngine';
import type { RestZoneState } from './restZoneEngine';
import { createRestZoneState, normalizeRestZone } from './restZoneEngine';
import type { RequestVenueId } from './administratorEngine';
import type { PleasureHouseUpgradeId } from './pleasureHouseEngine';
import type { StripClubUpgradeId } from './stripClubEngine';
import {
  MARKET_IMPROVEMENT_TRACKS,
  type MarketImprovementId,
  type MarketImprovementRequest
} from './marketImprovementsEngine';
import { formatMoney } from './currency';
import { createDefaultMezzanineView, normalizeMezzanineViewState, type MezzanineViewState } from './mezzanineViewState';
import { createCampaignScript, normalizeCampaignScript, type CampaignScriptState } from './campaignScript';
import { createWarehouseState, normalizeWarehouseState, type WarehouseState } from './warehouseEngine';
import { createBoilerHouseState, normalizeBoilerHouseState, type BoilerHouseState } from './boilerHouseEngine';
import { normalizeCityPlanSave, type CityPlanSave } from './cityPlanState';
import {
  createCityEconomyState,
  normalizeCityEconomyState,
  normalizeCityHubOpenedAt,
  type CityEconomyState
} from './cityEconomyState';
import {
  createInitialQuestStates,
  normalizeQuests,
  type QuestState
} from './quests';

export interface ManagedCampaignState extends CampaignState {
  beautySalon: BeautySalonState;
  exhaustionUpgrades: Record<'pleasure_house' | 'strip_club' | 'beauty_salon', number>;
  pleasureHouseUpgrades: Record<PleasureHouseUpgradeId, number>;
  stripClubUpgrades: Record<StripClubUpgradeId, number>;
  contracts: ClientContract[];
  slaveContracts: SlaveBuyerContract[];
  reservedMarketCharacterIds: string[];
  dependents: Dependent[];
  buyerStandings: StandingMap;
  /** Standing slave-supply contracts won by heavy caravan traffic to a region. */
  tradeSupplyContracts: TradeSupplyContract[];
  captiveLots: CaptiveLotOffer[];
  reservedCaptiveLotIds: string[];
  employees: Employee[];
  employeeCandidates: EmployeeCandidate[];
  auxiliaryBuildings: AuxiliaryBuildingState[];
  seenExpansionEventIds: string[];
  pendingExpansionEvents?: ExpansionEvent[];
  captureOperations: CaptureOperation[];
  hospital: HospitalState;
  restZone: RestZoneState;
  auctionHouse: AuctionHouseState;
  /** Achievements, lifetime stats, prestige level and the campaign goal status. */
  metaProgress: MetaProgressState;
  /** Full finance reports for every completed week, oldest first. */
  weeklyReports: WeeklyFinanceReport[];
  /** Current capacity for each venue. Base is 100. */
  venueCapacity: Record<'pleasure_house' | 'strip_club' | 'beauty_salon' | 'auction_house' | 'bdsm_room', number>;
  /** Active requests/proposals from venue administrators. */
  venueRequests: Record<RequestVenueId, {
    requestId: string;
    type: 'hire' | 'upgrade' | 'expansion';
    description: string;
    cost: number;
    benefit: string;
    priority: 'Low' | 'Medium' | 'High';
    /** Machine-readable effect target: upgrade track, hire specialty or 'seat'. */
    target?: string;
  } | null>;
  /** Current levels of the global market improvement tracks. */
  marketImprovements: Record<MarketImprovementId, number>;
  /** Active weekly proposal from the market administrator or financier. */
  marketRequest: MarketImprovementRequest | null;
  /** Last mezzanine map view, restored when the player returns to the hub. */
  mezzanine: MezzanineViewState;
  /** One active city-builder plan for this campaign, stored sparsely. */
  cityPlan: CityPlanSave | null;
  /** Last applied weekly report of the city economy. */
  cityEconomy: CityEconomyState;
  /** Week the mezzanine hub was first opened; null until then. */
  cityHubOpenedAt: number | null;
  /** Warehouse automatic mezzanine state (levels, capacity, automation). */
  warehouse: WarehouseState;
  /** Котельная: котлы, топливо и температура теплового контура. */
  boilerHouse: BoilerHouseState;
  /** Which act of the campaign script the run is in. */
  campaignScript: CampaignScriptState;
  /** Active quest states (progress and completion per quest). */
  quests: QuestState[];
}

export interface InitialCampaignOptions {
  campaignName?: string;
  ceoName?: string;
  ceoGender?: Character['gender'];
  ceoImage?: string;
  funds?: number;
  week?: number;
  fresh?: boolean;
}

const createStartingRoster = (ceoName: string, week: number, ceoGender?: Character['gender']): Character[] => {
  const ceo = generateCharacter('03_western_europe', ceoGender);
  ceo.name = ceoName;
  ceo.role = 'Chief Executive Officer';
  return [
    { ...ceo, acquiredWeek: week },
    { ...generateCharacter('04_eastern_europe'), name: 'Дмитрий Новак', role: 'Logistics Director', acquiredWeek: week }
  ];
};

const ALL_REGION_IDS = [
  '01_north_america', '02_south_america', '03_western_europe', '04_eastern_europe',
  '05_middle_east', '06_north_africa', '07_west_africa', '08_central_africa',
  '09_east_south_africa', '10_central_asia', '11_east_asia', '12_south_asia',
  '13_southeast_asia', '14_australia_oceania', '15_roma', '16_jewish_diaspora', '17_pacific_islands'
];

export function createInitialCampaign(options: InitialCampaignOptions = {}): ManagedCampaignState {
  const campaignName = options.campaignName ?? 'Глобальный синдикат «Эмпориум»';
  const ceoName = options.ceoName ?? 'Елена Вэнс (CEO)';
  const ceoGender = options.ceoGender;
  const week = options.week ?? 12;
  const fresh = options.fresh ?? false;
  const roster = createStartingRoster(ceoName, week, ceoGender);
  if (options.ceoImage) roster[0].image = options.ceoImage;

  return {
    version: 5,
    slot: 1,
    campaignName,
    week,
    funds: options.funds ?? 125000,
    reputation: fresh ? 80 : 85,
    isBankrupt: false,
    isReceivership: false,
    bankruptcyCase: null,
    activeLoan: null,
    lastWeeklyReport: null,
    roster,
    marketPool: ALL_REGION_IDS.map(regionId => generateCharacter(regionId)),
    reservedMarketCharacterIds: [],
    dependents: [],
     caravans: fresh ? [] : [{
       id: 'caravan_1',
       name: 'Экспресс «Шёлк и специи»',
       originRegion: 'Западная Европа и Скандинавия',
       destRegion: 'Восточная Азия',
       leaderName: ceoName,
       leaderId: roster[0]?.id,
       investment: 20000,
       potentialProfit: 35000,
       weeksTotal: 3,
       weeksRemaining: 1,
       status: 'traveling',
       raidsTriggered: 0,
       dispatchedWeek: week
     }],
    captureOperations: [],
    hospital: createHospitalState(),
    employees: [],
    employeeCandidates: createEmployeeCandidates(),
    hiringSlots: BASE_EMPLOYEE_SLOTS,
    auxiliaryBuildings: createInitialBuildings(),
    seenExpansionEventIds: [],
    metaProgress: createInitialMetaProgress(),
    weeklyReports: [],
    beautySalon: {
      level: 1,
      managerId: null,
      managerTraitId: 'mt_master_stylist',
      supplies: 100,
      scheduledTreatments: [],
      totalRevenue: 0
    },
    exhaustionUpgrades: { pleasure_house: 0, strip_club: 0, beauty_salon: 0 },
    pleasureHouseUpgrades: { bdsm_services: 0, fetish_services: 0, alcohol_service: 0, room_upgrades: 0 },
    stripClubUpgrades: { client_capacity: 0, dancer_capacity: 0, vip_zones: 0, food_alcohol: 0, interior_music: 0 },
    restZone: createRestZoneState(),
    contracts: cloneSampleContracts(),
    slaveContracts: [generateSlaveContract('market')],
    buyerStandings: {},
    tradeSupplyContracts: [],
    captiveLots: [generateCaptiveLotOffer()],
    reservedCaptiveLotIds: [],
    auctionHouse: createEmptyAuctionHouse(),
    venueCapacity: {
      pleasure_house: 100,
      strip_club: 100,
      beauty_salon: 100,
      auction_house: 100,
      bdsm_room: 100
    },
    venueRequests: {
      pleasure_house: null,
      strip_club: null,
      beauty_salon: null,
      auction_house: null,
      bdsm_room: null,
      rest_zone: null
    },
    marketImprovements: {
      buyer_network: 0,
      market_research: 0,
      logistics: 0,
      risk_management: 0,
      trade_financing: 0
    },
    marketRequest: null,
    mezzanine: createDefaultMezzanineView(),
    cityPlan: null,
    cityEconomy: createCityEconomyState(),
    cityHubOpenedAt: null,
    warehouse: createWarehouseState(),
    boilerHouse: createBoilerHouseState(),
    campaignScript: createCampaignScript(week),
    log: [
      `Неделя ${week}: кампания успешно запущена.`,
      fresh
        ? `Кампания ${campaignName} начата под руководством CEO ${ceoName} с ${formatMoney((options.funds ?? 125000))}.`
        : 'Добро пожаловать в «Эмпориум», веб-версия. Объекты и система сотрудников готовы.'
    ],
    marketRefreshDone: false,
    marketDemand: {},
    regionalStanding: {},
    purchasedUpgrades: [],
    cityTerritoriesOwned: 1,
    quests: createInitialQuestStates(week)
  } as ManagedCampaignState;
}

function cloneSampleContracts(): ClientContract[] {
  return SAMPLE_CONTRACTS.map((contract: ClientContract) => ({ ...contract, assignedOperativeIds: [...(contract.assignedOperativeIds ?? [])] }));
}

const BANKRUPTCY_INITIATORS: BankruptcyInitiator[] = ['debtor', 'authorized_bodies'];
const BANKRUPTCY_PATHS: BankruptcyPath[] = ['court', 'bank_board'];
const BANKRUPTCY_PROCEDURES: BankruptcyProcedure[] = ['financial_recovery', 'external_management', 'settlement_agreement'];

function normalizeBankruptcyCase(raw: unknown): BankruptcyCase | null {
  if (!isRecord(raw)) return null;
  const initiator = BANKRUPTCY_INITIATORS.includes(raw.initiator as BankruptcyInitiator)
    ? (raw.initiator as BankruptcyInitiator)
    : 'debtor';
  const path = BANKRUPTCY_PATHS.includes(raw.path as BankruptcyPath)
    ? (raw.path as BankruptcyPath)
    : 'court';
  const procedure = BANKRUPTCY_PROCEDURES.includes(raw.procedure as BankruptcyProcedure)
    ? (raw.procedure as BankruptcyProcedure)
    : 'financial_recovery';
  return {
    id: typeof raw.id === 'string' ? raw.id : `bankruptcy_${Math.floor(Number(raw.filedWeek) || 1)}_1`,
    initiator,
    path,
    procedure,
    filedWeek: Math.max(1, Math.floor(Number(raw.filedWeek) || 1)),
    weeksElapsed: Math.max(0, Math.floor(Number(raw.weeksElapsed) || 0)),
    totalWeeks: Math.max(1, Math.floor(Number(raw.totalWeeks) || 1)),
    status: raw.status === 'resolved' ? 'resolved' : 'active',
    outcomeNote: typeof raw.outcomeNote === 'string' ? raw.outcomeNote : null
  };
}

function normalizeLoan(raw: unknown): LoanApplication | null {
  if (!raw || typeof raw !== 'object') return null;
  const loan = raw as Partial<LoanApplication>;
  const amount = Number(loan.amount) || 0;
  const termWeeks = Math.max(1, Number(loan.termWeeks) || 1);
  const interestRate = Number(loan.interestRate) || 0;
  const totalOwed = Math.round(amount * (1 + interestRate));
  return {
    amount,
    termWeeks,
    repaymentType: loan.repaymentType === 'income_share' ? 'income_share' : 'fixed',
    interestRate,
    remainingPrincipal: Number.isFinite(loan.remainingPrincipal) ? Number(loan.remainingPrincipal) : totalOwed,
    weeksPaid: Number.isFinite(loan.weeksPaid) ? Number(loan.weeksPaid) : 0,
    weeklyPayment: Number.isFinite(loan.weeklyPayment) ? Number(loan.weeklyPayment) : Math.ceil(totalOwed / termWeeks)
  };
}

function normalizeWeeklyReport(raw: unknown): WeeklyFinanceReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const report = raw as Partial<WeeklyFinanceReport>;
  const revenue: Partial<WeeklyFinanceReport['revenue']> = report.revenue && typeof report.revenue === 'object' ? report.revenue : {};
  const expenses: Partial<WeeklyFinanceReport['expenses']> = report.expenses && typeof report.expenses === 'object' ? report.expenses : {};
  const num = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const revenueSum = num(revenue.venue) + num(revenue.caravans) + num(revenue.captureOps) + num(revenue.contracts) + num(revenue.salon) + num(revenue.city) + num(revenue.boiler);
  const expenseSum = num(expenses.wages) + num(expenses.hospital) + num(expenses.restZone) + num(expenses.staffSlots) + num(expenses.warehouse) + num(expenses.city) + num(expenses.boiler);
  return {
    week: Math.max(1, Math.floor(num(report.week))),
    revenue: {
      venue: num(revenue.venue),
      caravans: num(revenue.caravans),
      captureOps: num(revenue.captureOps),
      contracts: num(revenue.contracts),
      salon: num(revenue.salon),
      city: num(revenue.city),
      boiler: num(revenue.boiler)
    },
    expenses: {
      wages: num(expenses.wages),
      hospital: num(expenses.hospital),
      restZone: num(expenses.restZone),
      staffSlots: num(expenses.staffSlots),
      loanPayment: num(expenses.loanPayment),
      warehouse: num(expenses.warehouse),
      city: num(expenses.city),
      boiler: num(expenses.boiler)
    },
    netIncome: num(report.netIncome) || revenueSum - expenseSum,
    treasuryAfter: num(report.treasuryAfter)
  };
}

const META_STAT_KEYS = [
  'totalRevenue', 'totalExpenses', 'totalNetIncome', 'peakFunds', 'peakWeek',
  'auctionsCompleted', 'auctionBestSale', 'caravansDispatched', 'caravansCompleted',
  'caravansLost', 'raidsSurvived', 'captureOpsCompleted', 'slavesAcquired',
  'employeesHired', 'buildingsConstructed', 'loansTaken', 'loansRepaid', 'births'
] as const;

function normalizeMetaProgress(raw: unknown): MetaProgressState {
  const base = createInitialMetaProgress();
  if (!isRecord(raw)) return base;

  const achievements: Record<string, number> = {};
  const knownIds = new Set<string>(ACHIEVEMENTS.map(def => def.id));
  const rawAchievements = isRecord(raw.achievements) ? raw.achievements : {};
  for (const [id, value] of Object.entries(rawAchievements)) {
    const week = Math.floor(Number(value));
    if (knownIds.has(id) && Number.isFinite(week) && week > 0) achievements[id] = week;
  }

  const rawStats = isRecord(raw.stats) ? raw.stats : {};
  const stats = { ...base.stats };
  for (const key of META_STAT_KEYS) {
    const parsed = Math.floor(Number(rawStats[key]));
    if (Number.isFinite(parsed) && parsed > 0) stats[key] = parsed;
  }

  const rawPrestige = isRecord(raw.prestige) ? raw.prestige : {};
  const prestige: PrestigeState = {
    level: Math.max(0, Math.floor(Number(rawPrestige.level)) || 0),
    victories: Math.max(0, Math.floor(Number(rawPrestige.victories)) || 0)
  };

  const goalStatus = raw.goalStatus === 'victory' || raw.goalStatus === 'defeat'
    ? raw.goalStatus
    : 'ongoing';
  const endingWeek = Math.floor(Number(raw.endingWeek));

  return {
    achievements: achievements as MetaProgressState['achievements'],
    stats,
    prestige,
    goalStatus,
    endingWeek: Number.isFinite(endingWeek) && endingWeek > 0 ? endingWeek : null
  };
}

/**
 * Migrates the weekly report history. Saves written before the history
 * existed keep only the last report; it becomes the first entry so the
 * finance charts have at least one data point.
 */
function normalizeWeeklyReports(raw: unknown, lastReport: unknown): WeeklyFinanceReport[] {
  const reports: WeeklyFinanceReport[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const report = normalizeWeeklyReport(entry);
      if (report) reports.push(report);
    }
  }
  if (reports.length === 0) {
    const last = normalizeWeeklyReport(lastReport);
    if (last) reports.push(last);
  }
  return reports.slice(-WEEKLY_REPORTS_LIMIT);
}

function normalizeHospital(raw: unknown, roster: Character[]): HospitalState {
  const base = createHospitalState();
  if (!isRecord(raw)) return base;

  const wardCounts = { ...base.wardCounts };
  for (const [id, value] of Object.entries(isRecord(raw.wardCounts) ? raw.wardCounts : {})) {
    if (id in wardCounts) wardCounts[id] = Math.max(0, Math.floor(Number(value) || 0));
  }
  const equipment = { ...base.equipment };
  for (const [id, value] of Object.entries(isRecord(raw.equipment) ? raw.equipment : {})) {
    if (id in equipment) equipment[id] = Math.max(0, Math.floor(Number(value) || 0));
  }
  const patients = Array.isArray(raw.patients)
    ? (raw.patients as HospitalState['patients']).filter(patient =>
      isRecord(patient) && typeof patient.characterId === 'string' && typeof patient.wardId === 'string')
    .map(patient => ({
      characterId: patient.characterId,
      characterName: typeof patient.characterName === 'string' ? patient.characterName : 'Неизвестно',
      wardId: patient.wardId,
      // Beds written before treatment stays existed are maternity beds.
      admission: patient.admission === 'treatment'
        ? 'treatment' as const
        : patient.admission === 'observation'
          ? 'observation' as const
          : 'birth' as const,
      complicated: Boolean(patient.complicated),
      weeksRemaining: Math.max(1, Math.floor(Number(patient.weeksRemaining) || 1)),
      delivered: Boolean(patient.delivered),
      admittedWeek: Math.max(0, Math.floor(Number(patient.admittedWeek) || 0)),
      weeklyGain: Number.isFinite(Number(patient.weeklyGain))
        ? Math.max(0, Math.floor(Number(patient.weeklyGain)))
        : undefined,
      missingItemIds: Array.isArray(patient.missingItemIds)
        ? patient.missingItemIds.filter((id): id is HospitalEquipmentId => typeof id === 'string')
        : undefined,
      survivalChance: Number.isFinite(Number(patient.survivalChance))
        ? Math.max(0, Math.min(100, Math.floor(Number(patient.survivalChance))))
        : undefined,
      riskScore: Number.isFinite(Number(patient.riskScore))
        ? Math.max(0, Math.min(1, Number(patient.riskScore)))
        : undefined
    }))
    : [];
  const ledger = Array.isArray(raw.ledger)
    ? (raw.ledger as HospitalState['ledger']).filter(entry =>
      isRecord(entry) && typeof entry.message === 'string').slice(0, 12)
    : [];

  // Mothers left mid-stay by an older save still need a bed on file.
  return reconcilePatients({ wardCounts, equipment, patients, ledger }, roster);
}

function normalizeCharacter(character: Character, fallbackWeek = 1): Character {
  const normalized: Character = {
    ...character,
    country: character.country ?? pickCountry(character.region),
    city: character.city ?? pickCity(character.region),
    age: character.age ?? pickAge(),
    submission: character.submission ?? 50,
    // Saves written before purchase weeks existed fall back to the start of the
    // campaign, so legacy staff sort as the oldest members of the company.
    acquiredWeek: Math.max(1, Math.floor(Number(character.acquiredWeek) || fallbackWeek || 1)),
    pleasureStats: character.pleasureStats ?? { vaginalCount: 0, analCount: 0, totalEarnings: 0 },
    // Learning & conditioning stats added with the School / Correction Centre release.
    fear: clampStat(character.fear, 0),
    assimilation: clampStat(character.assimilation, 0),
    libido: clampStat(character.libido, 60),
    teachingSkill: clampStat(character.teachingSkill, Math.round((character.skill ?? 50) * 0.6)),
    wounds: Array.isArray(character.wounds)
      ? character.wounds
          .filter(wound => wound && typeof wound === 'object' && typeof wound.location === 'string')
          .slice(0, 2)
          .map((wound, index) => ({
            id: typeof wound.id === 'string' ? wound.id : `wound_legacy_${index}`,
            location: wound.location,
            severity: clampStat(wound.severity, 20),
            receivedWeek: Math.max(1, Math.floor(Number(wound.receivedWeek) || fallbackWeek || 1))
          }))
      : []
  };
  const pregnancy = character.pregnancy as PregnancyState | undefined;
  const validPregnancy = character.isSlave === true
    && character.gender === 'women'
    && character.age >= 18
    && pregnancy
    && (pregnancy.status === 'pregnant' || pregnancy.status === 'hospitalized');

  if (validPregnancy) {
    // A full term is twenty weeks. A mother already booked into a ward keeps her
    // hospitalization; anyone at term but not in a bed waits for one.
    const daysPregnant = Math.max(0, Math.min(GESTATION_DAYS, Math.floor(Number(pregnancy.daysPregnant) || 0)));
    normalized.pregnancy = pregnancy.status === 'hospitalized'
      ? {
        status: 'hospitalized',
        daysPregnant,
        hospitalWeeksRemaining: Math.max(1, Math.floor(Number(pregnancy.hospitalWeeksRemaining) || 1)),
        wardId: typeof pregnancy.wardId === 'string' ? pregnancy.wardId : undefined
      }
      : {
        status: 'pregnant',
        daysPregnant,
        hospitalWeeksRemaining: 0,
        // A mother booked in for observation keeps the ward and the reason on file.
        hospitalAdmission: pregnancy.hospitalAdmission === 'observation' ? 'observation' : undefined,
        wardId: pregnancy.hospitalAdmission === 'observation' && typeof pregnancy.wardId === 'string'
          ? pregnancy.wardId
          : undefined
      };
  } else {
    delete normalized.pregnancy;
  }
  return normalized;
}

/**
 * Normalizes a saved caravan. Legacy saves stored a boolean "raid already fired"
 * flag; that has become a per-caravan ambush count.
 */
function normalizeCaravan(caravan: Caravan): Caravan {
  const weeksTotal = Math.max(1, Math.floor(Number(caravan.weeksTotal) || 3));
  const legacyRaidFlag = (caravan as Caravan & { raidResolved?: boolean }).raidResolved;
  const raidsTriggered = Math.floor(Number(caravan.raidsTriggered ?? (legacyRaidFlag ? 1 : 0)));
  const endWeek = Number(caravan.endWeek);
  return {
    ...caravan,
    weeksTotal,
    weeksRemaining: Math.max(0, Math.min(weeksTotal, Math.floor(Number(caravan.weeksRemaining) || 0))),
    status: caravan.status === 'completed' || caravan.status === 'raided' || caravan.status === 'lost' ? caravan.status : 'traveling',
    raidsTriggered: Number.isFinite(raidsTriggered) && raidsTriggered > 0 ? raidsTriggered : 0,
    endWeek: Number.isFinite(endWeek) && endWeek > 0 ? endWeek : (caravan.status === 'completed' || caravan.status === 'raided' || caravan.status === 'lost' ? undefined : caravan.endWeek),
    dispatchedWeek: Number(caravan.dispatchedWeek) > 0 ? Math.floor(Number(caravan.dispatchedWeek)) : caravan.dispatchedWeek
  };
}

function normalizeDependent(value: unknown): Dependent | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.guardianCharacterId !== 'string'
    || typeof value.regionId !== 'string'
    || (value.gender !== 'female' && value.gender !== 'male')) return null;

  return {
    id: value.id,
    name: value.name,
    gender: value.gender,
    guardianCharacterId: value.guardianCharacterId,
    guardianName: typeof value.guardianName === 'string' ? value.guardianName : 'Неизвестный опекун',
    regionId: value.regionId,
    ageDays: Math.max(0, Math.min(COMPANY_PROPERTY_AGE_DAYS - 1, Math.floor(Number(value.ageDays) || 0))),
    bornWeek: Math.max(1, Math.floor(Number(value.bornWeek) || 1))
  };
}

const EMPLOYEE_SPECIALTY_IDS = ['teacher', 'coach', 'clinician', 'nurse', 'midwife', 'psychologist', 'escort', 'guard', 'secretary', 'lawyer', 'attendant', 'mistress', 'master', 'janitor', 'auctioneer', 'appraiser', 'dj', 'administrator', 'financier'] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

/** Clamps a possibly-missing numeric save field to an integer 0-100 range. */
const clampStat = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

/** How many weeks of finance history are kept in the save. */
const WEEKLY_REPORTS_LIMIT = 104;

function isEmployeeCandidate(value: unknown): value is EmployeeCandidate {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && EMPLOYEE_SPECIALTY_IDS.includes(value.specialty as typeof EMPLOYEE_SPECIALTY_IDS[number]);
}

/**
 * Sex of an employee, inferred for saves written before the field existed: the
 * gender-locked BDSM roles imply their own sex, everyone else falls back to men.
 */
function normalizeEmployeeGender(value: unknown, specialty: EmployeeSpecialty): EmployeeGender {
  if (value === 'women' || value === 'men') return value;
  if (specialty === 'mistress') return 'women';
  if (specialty === 'master') return 'men';
  return 'men';
}

function normalizeCandidate(candidate: EmployeeCandidate): EmployeeCandidate {
  return {
    ...candidate,
    gender: normalizeEmployeeGender(candidate.gender, candidate.specialty),
    skill: Math.max(1, Math.min(100, Math.floor(Number(candidate.skill) || 1))),
    experience: Math.max(0, Math.min(99, Math.floor(Number(candidate.experience) || 0))),
    morale: Math.max(0, Math.min(100, Math.floor(Number(candidate.morale) || 0))),
    weeklyWage: Math.max(0, Math.floor(Number(candidate.weeklyWage) || 0))
  };
}

function isEmployee(value: unknown): value is Employee {
  return isEmployeeCandidate(value)
    && isRecord(value)
    && (value.status === 'active' || value.status === 'leave')
    && (value.assignedBuildingId === null || value.assignedBuildingId === 'school' || value.assignedBuildingId === 'self_development_center' || value.assignedBuildingId === 'clinic' || value.assignedBuildingId === 'hospital' || value.assignedBuildingId === 'caravan_depot' || value.assignedBuildingId === 'guard_post' || value.assignedBuildingId === 'ceo_office' || value.assignedBuildingId === 'legal_dept' || value.assignedBuildingId === 'bdsm_room' || value.assignedBuildingId === 'auction_house')
    && typeof value.hiredWeek === 'number';
}

function normalizeEmployee(employee: Employee): Employee {
  return {
    ...normalizeCandidate(employee),
    status: employee.status,
    assignedBuildingId: employee.assignedBuildingId,
    hiredWeek: Math.max(1, Math.floor(Number(employee.hiredWeek) || 1))
  };
}

const SUPPLY_QUALITIES = ['low', 'medium', 'high'] as const;

/**
 * Normalizes a stored regional supply contract into the current buy-side shape.
 *
 * Saves written before the buy-side rewrite hold the old sell-side fields
 * (`deliveredThisWeek`, `totalDelivered`, `totalPaid`, `minQuality`) and none of
 * the purchase fields, so every numeric field is coerced here and any contract
 * that cannot be salvaged is dropped rather than rendered as `undefined`/`NaN`.
 */
function normalizeTradeSupplyContract(raw: Partial<TradeSupplyContract>): TradeSupplyContract | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const regionId = typeof raw.regionId === 'string' ? raw.regionId : '';
  const regionName = typeof raw.regionName === 'string' ? raw.regionName : 'Неизвестный регион';
  const quality = SUPPLY_QUALITIES.includes(raw.quality as typeof SUPPLY_QUALITIES[number])
    ? (raw.quality as TradeSupplyContract['quality'])
    : 'low';
  const num = (value: unknown, fallback: number) => {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    id: raw.id,
    channel: 'market',
    regionId,
    regionName,
    buyerName: typeof raw.buyerName === 'string' ? raw.buyerName : 'Региональный торговый дом',
    title: typeof raw.title === 'string' ? raw.title : `Поставка рабов из региона: ${regionName}`,
    description: typeof raw.description === 'string' ? raw.description : '',
    caravansDelivered: num(raw.caravansDelivered, 0),
    pricePerHead: num(raw.pricePerHead, 0),
    weeklyQuantity: Math.max(1, num(raw.weeklyQuantity, 1)),
    quality,
    // A save without the flag predates signing; treat it as already signed so an
    // in-flight contract keeps working instead of locking the player out.
    signed: raw.signed !== false,
    startWeek: num(raw.startWeek, 1),
    termWeeks: Math.max(1, num(raw.termWeeks, 1)),
    weeksRemaining: Math.max(0, num(raw.weeksRemaining, 0)),
    purchasedThisWeek: Math.max(0, num(raw.purchasedThisWeek, 0)),
    totalPurchased: Math.max(0, num(raw.totalPurchased, 0)),
    totalSpent: Math.max(0, num(raw.totalSpent, 0)),
    status: raw.status === 'completed' ? 'completed' : 'active'
  };
}

function normalizeMarketRequest(raw: unknown): MarketImprovementRequest | null {
  if (!isRecord(raw) || typeof raw.track !== 'string') return null;
  const track = raw.track as MarketImprovementId;
  if (!(track in MARKET_IMPROVEMENT_TRACKS)) return null;
  const author = raw.author === 'financier' ? 'financier' : 'administrator';
  return {
    requestId: typeof raw.requestId === 'string' ? raw.requestId : `market_${track}_1`,
    type: 'upgrade',
    track,
    author,
    authorName: typeof raw.authorName === 'string' ? raw.authorName : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    cost: Math.max(0, Math.floor(Number(raw.cost) || 0)),
    benefit: typeof raw.benefit === 'string' ? raw.benefit : '',
    priority: raw.priority === 'High' || raw.priority === 'Medium' || raw.priority === 'Low' ? raw.priority : 'Low'
  };
}

export function migrateCampaignState(raw: unknown): ManagedCampaignState {
  if (!raw || typeof raw !== 'object') throw new Error('Данные сохранения не являются объектом кампании.');
  const parsed = raw as Partial<ManagedCampaignState> & Record<string, unknown>;
  const defaults = createInitialCampaign({ fresh: true, week: Number(parsed.week) || 1 });
  const rawEmployees = Array.isArray(parsed.employees) ? parsed.employees : [];
  const employees = rawEmployees.filter(isEmployee).map(normalizeEmployee);
  const rawCandidates = Array.isArray(parsed.employeeCandidates) ? parsed.employeeCandidates : [];
  const candidates = rawCandidates.filter(isEmployeeCandidate).map(normalizeCandidate);
  const savedBuildings = Array.isArray(parsed.auxiliaryBuildings) ? parsed.auxiliaryBuildings : [];
  const buildings = createInitialBuildings().map(defaultBuilding => {
    const stored = savedBuildings.find(item => item && typeof item === 'object' && (item as AuxiliaryBuildingState).id === defaultBuilding.id) as (Partial<AuxiliaryBuildingState> & { assignedEmployeeId?: unknown }) | undefined;
    if (!stored) return defaultBuilding;
    const rawAssignedIds = Array.isArray(stored.assignedEmployeeIds)
      ? stored.assignedEmployeeIds
      : typeof stored.assignedEmployeeId === 'string' ? [stored.assignedEmployeeId] : [];
    const assignedEmployeeIds = rawAssignedIds
      .filter((id): id is string => typeof id === 'string' && employees.some(employee => employee.id === id))
      .slice(0, totalPostCount(getBuildingDefinition(defaultBuilding.id)));
    return {
      ...defaultBuilding,
      level: Math.max(0, Math.min(getBuildingDefinition(defaultBuilding.id).maxLevel, Math.floor(Number(stored.level) || 0))),
      assignedEmployeeIds
    };
  });
  const storedContracts = Array.isArray(parsed.contracts) ? parsed.contracts as ClientContract[] : cloneSampleContracts();
  const savedWeek = Math.max(1, Math.floor(Number(parsed.week) || 1));
  const roster = Array.isArray(parsed.roster) ? parsed.roster.map(character => normalizeCharacter(character, 1)) : [];
  // Saves written before headcount was purchasable have no slot field, so they
  // start on the free positions. The headcount floor keeps a roster that outgrew
  // its slots (a lowered cap in an older build) loadable instead of over cap.
  const hiringSlots = Math.max(
    BASE_EMPLOYEE_SLOTS,
    Math.floor(Number(parsed.hiringSlots) || BASE_EMPLOYEE_SLOTS),
    employees.length
  );

  return {
    ...defaults,
    ...parsed,
    version: 5,
    week: savedWeek,
    funds: Number(parsed.funds) || 0,
    reputation: Number(parsed.reputation) || 0,
    isBankrupt: Boolean(parsed.isBankrupt),
    isReceivership: Boolean(parsed.isReceivership),
    bankruptcyCase: normalizeBankruptcyCase(parsed.bankruptcyCase),
    roster,
    // Market candidates have not been bought yet, so they carry no purchase week
    // until the player acquires them.
    marketPool: Array.isArray(parsed.marketPool)
      ? parsed.marketPool.map(candidate => {
        const normalizedCandidate: Character = normalizeCharacter(candidate, savedWeek);
        delete normalizedCandidate.acquiredWeek;
        return normalizedCandidate;
      })
      : [],
    reservedMarketCharacterIds: Array.isArray(parsed.reservedMarketCharacterIds)
      ? parsed.reservedMarketCharacterIds.filter((id): id is string => typeof id === 'string')
      : [],
    dependents: Array.isArray(parsed.dependents)
      ? parsed.dependents.map(normalizeDependent).filter((dependent): dependent is Dependent => dependent !== null)
      : [],
    caravans: Array.isArray(parsed.caravans) ? parsed.caravans.map(normalizeCaravan) : [],
    captureOperations: Array.isArray(parsed.captureOperations)
      ? (parsed.captureOperations as CaptureOperation[]).filter(op => isRecord(op) && typeof op.id === 'string')
      : [],
    hospital: normalizeHospital(parsed.hospital, roster),
    activeLoan: normalizeLoan(parsed.activeLoan),
    lastWeeklyReport: normalizeWeeklyReport(parsed.lastWeeklyReport),
    metaProgress: normalizeMetaProgress(parsed.metaProgress),
    weeklyReports: normalizeWeeklyReports(parsed.weeklyReports, parsed.lastWeeklyReport),
    employees,
    employeeCandidates: Array.isArray(parsed.employeeCandidates) ? candidates : createEmployeeCandidates(),
    hiringSlots,
    auxiliaryBuildings: buildings,
    seenExpansionEventIds: Array.isArray(parsed.seenExpansionEventIds) ? parsed.seenExpansionEventIds.filter((id): id is string => typeof id === 'string') : [],
    pendingExpansionEvents: Array.isArray(parsed.pendingExpansionEvents) ? parsed.pendingExpansionEvents : [],
    beautySalon: {
      ...defaults.beautySalon,
      ...(parsed.beautySalon as Partial<BeautySalonState> | undefined),
      scheduledTreatments: Array.isArray((parsed.beautySalon as BeautySalonState | undefined)?.scheduledTreatments)
        ? (parsed.beautySalon as BeautySalonState).scheduledTreatments
        : []
    },
    exhaustionUpgrades: { ...defaults.exhaustionUpgrades, ...(parsed.exhaustionUpgrades as Partial<ManagedCampaignState['exhaustionUpgrades']> | undefined) },
    pleasureHouseUpgrades: { ...defaults.pleasureHouseUpgrades, ...(parsed.pleasureHouseUpgrades as Partial<ManagedCampaignState['pleasureHouseUpgrades']> | undefined) },
    stripClubUpgrades: { ...defaults.stripClubUpgrades, ...(parsed.stripClubUpgrades as Partial<ManagedCampaignState['stripClubUpgrades']> | undefined) },
    restZone: normalizeRestZone(parsed.restZone, roster, employees),
    contracts: storedContracts.map(contract => ({ ...contract, assignedOperativeIds: contract.assignedOperativeIds || [] })),
    slaveContracts: Array.isArray(parsed.slaveContracts) ? parsed.slaveContracts : [],
    buyerStandings: parsed.buyerStandings && typeof parsed.buyerStandings === 'object' ? parsed.buyerStandings : {},
    tradeSupplyContracts: Array.isArray(parsed.tradeSupplyContracts)
      ? (parsed.tradeSupplyContracts as Partial<TradeSupplyContract>[])
        .map(normalizeTradeSupplyContract)
        .filter((contract): contract is TradeSupplyContract => contract !== null)
      : [],
    captiveLots: Array.isArray(parsed.captiveLots) ? parsed.captiveLots : [],
    reservedCaptiveLotIds: Array.isArray(parsed.reservedCaptiveLotIds)
      ? parsed.reservedCaptiveLotIds.filter((id): id is string => typeof id === 'string')
      : [],
    auctionHouse: normalizeAuctionHouseState(parsed.auctionHouse),
    venueRequests: {
      ...defaults.venueRequests,
      ...(parsed.venueRequests as Partial<ManagedCampaignState['venueRequests']> | undefined)
    },
    marketImprovements: {
      ...defaults.marketImprovements,
      ...(parsed.marketImprovements as Partial<ManagedCampaignState['marketImprovements']> | undefined)
    },
    marketRequest: normalizeMarketRequest(parsed.marketRequest),
    mezzanine: normalizeMezzanineViewState(parsed.mezzanine),
    cityPlan: normalizeCityPlanSave(parsed.cityPlan),
    cityEconomy: normalizeCityEconomyState(parsed.cityEconomy),
    cityHubOpenedAt: normalizeCityHubOpenedAt(
      parsed.cityHubOpenedAt,
      normalizeMezzanineViewState(parsed.mezzanine).selectedRegionId,
      savedWeek
    ),
    warehouse: normalizeWarehouseState(parsed.warehouse),
    boilerHouse: normalizeBoilerHouseState(parsed.boilerHouse),
    campaignScript: normalizeCampaignScript(parsed.campaignScript, savedWeek),
    cityTerritoriesOwned: Math.max(1, Math.floor(Number(parsed.cityTerritoriesOwned) || 1)),
    quests: normalizeQuests(parsed.quests, savedWeek),
    log: Array.isArray(parsed.log) ? parsed.log.filter((entry): entry is string => typeof entry === 'string') : []
  } as ManagedCampaignState;
}

export function readCampaignFromStorage(slotNum = 1): ManagedCampaignState | null {
  const saved = localStorage.getItem(`emporium_save_slot_${slotNum}`) || (slotNum === 1 ? localStorage.getItem('emporium_save_06') : null);
  if (!saved) return null;
  return migrateCampaignState(JSON.parse(saved));
}
