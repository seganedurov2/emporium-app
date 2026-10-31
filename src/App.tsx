import { useState, useEffect, useRef, useMemo } from 'react';
import { formatMoney, formatSignedMoney, getBtcRate } from './currency';
import { useBtcRate } from './useBtcRate';
import { updateRegionalMarketAfterPurchase } from './marketEconomyEngine';
import { calculateVenueSynergies, type SynergyResult } from './synergyEngine';
import type { Platform } from './terminology';
import {
  Users, Calendar, Bitcoin, Award,


  ArrowRight, Play, AlertCircle, Truck, Sparkles, CreditCard, Maximize2, X, HeartPulse,
  FolderOpen, PlusCircle, Trash2, Save, ArrowLeft, Shield, Warehouse, ArrowUpDown,
  Menu, ChevronLeft, ChevronRight, Target, Trophy, Crown, Gavel, Settings
} from 'lucide-react';
import type { Character, Caravan, LoanApplication, WeeklyFinanceReport } from './gameEngine';
import { createGoodsLot, getAuctionHouseStaff, sellAuctionLot as sellAuctionLotEngine, createCharacterLot, buildValuationAnnouncements, valuationMismatch, requestCharacterSaleConsent, cancelCharacterSaleConsent, hasPendingSaleConsent, AUCTION_HOUSE_ADMINISTRATOR } from './auctionHouseEngine';
import type { AuctionLot } from './auctionHouseEngine';
import { advancePregnancyWeek } from './pregnancyEngine';
import { DependentsPanel } from './components/roster/DependentsPanel';
import { PleasureHousePrisonersTable } from './components/roster/PleasureHousePrisonersTable';
import { TraitChatExplorer } from './components/roster/TraitChatExplorer';
import { PleasureHouseTab } from './components/roster/PleasureHouseTab';
import { REGIONS, calculateAttractiveness, generateSlaveCharacter } from './gameEngine';
import type { GameEvent, EventChoice } from './eventsEngine';
import { getRandomEventWithAuction } from './eventsEngine';
import type { BuildingId, EmployeeSpecialty, ExpansionEvent, ExpansionEventChoice } from './expansionTypes';
import { chooseExpansionEvent, applyExpansionEventChoice } from './expansionEventsEngine';
import { applyClinicRecovery, calculateBuildingWeeklyEffects, getBuildingActionCost, getBuildingDefinition, healthFromExact, specialtiesForSlot, totalPostCount } from './buildingsEngine';
import { advanceEmployeesWeek, createEmployeeCandidates, EMPLOYEE_CANDIDATE_CAP, ensureEmployeeCandidatesForVacancies, hiringSlotUpkeep, makeHiredEmployee, quoteHiringSlot, refreshEmployeeCandidates, rerollEmployeeCandidates, getVacantSpecialties, fitsSpecialty, requiredGenderForSpecialty, specialtyDefinitionOf, CONTRACT_RENEWAL_WEEKS } from './employeesEngine';
import { buildChiefDoctorReport } from './chiefDoctorEngine';
import { calculateStaffing } from './staffingCalculator';
import { createInitialCampaign, migrateCampaignState, readCampaignFromStorage, type ManagedCampaignState } from './saveState';
import type { MezzanineViewState } from './mezzanineViewState';
import {
  generateVenueRequests,
  stripClubAssignmentError,
  venueLabel as administratorVenueLabel,
  type RequestVenueId,
  type VenueAdministratorRequest
} from './administratorEngine';
import { FacilitiesStaffTab } from './components/facilitiesStaff/FacilitiesStaffTab';
import { StaffTable } from './components/facilitiesStaff/StaffTable';
import { HiringTab } from './components/hiring/HiringTab';
import { AuctionHouseTab } from './components/auctionHouse/AuctionHouseTab';
import { CaptiveLotsMarketPanel } from './components/slaveMarket/CaptiveLotsMarketPanel';
import { SupplyContractsPanel } from './components/slaveMarket/SupplyContractsPanel';
import { GlobalMarketTab } from './components/market/GlobalMarketTab';
import type { ActiveRaid, RaidResolutionAction } from './caravanRaidsEngine';
import {
  trySpawnRaid, trySpawnCaptureRaid, resolveRaid, buildCapturedSlaves,
  raidChanceForRoute, regionNameToId, dangerForRegion
} from './caravanRaidsEngine';
import type { CaptureOperation, CaptureTargetQuality } from './captureOpsEngine';
import {
  CAPTURE_OPERATION_WEEKS, MAX_CAPTURE_SQUAD, MIN_CAPTURE_SQUAD,
  captureChanceFor, captureTaskId, clearCaptureTask, committedCaptureSpend,
  createCaptureOperation, generateCodename, isOnCaptureOp, recommendedBudget,
  resolveCaptureArrival, routeDanger
} from './captureOpsEngine';
import type { HospitalEquipmentId, HospitalWardId } from './hospitalEngine';
import {
  GESTATION_DAYS, HOSPITAL_EQUIPMENT, INTERCEPTION_REPUTATION_PENALTY,
  advanceHospitalWeek, assessPregnancyRisk, createLedgerEntry as hospitalLedgerEntry, getWardDefinition,
  isObservationStay, isTreatmentStay, needsHospitalTreatment, needsPregnancyObservation, quoteEquipment, quoteWards, rollInterception
} from './hospitalEngine';
import {
  SCHOOL_COURSE_BY_ID,
  cancelEnrolment as cancelSchoolEnrolmentInEngine,
  enrollStudent as enrollStudentInEngine,
  type SchoolCourseId,
  type TeacherProfile as SchoolTeacherProfile
} from './schoolEngine';
import {
  cancelCorrectionEnrolment,
  enrollInCorrection,
  type CorrectionCourseId,
  type CorrectionIntensity
} from './correctionEngine';
import { applyTraitOperation, type TraitId, type TraitOperation } from './selfDevelopmentEngine';
import { HospitalTab } from './components/hospital/HospitalTab';
import { SecurityServiceTab } from './components/security/SecurityServiceTab';
import { BDSMRoomTab } from './components/bdsm/BDSMRoomTab';
import type { Psychologist } from './psychologistEngine';
import {
  advancePsychologistWeek, hospitalPsychologists
} from './psychologistEngine';
import { RestZoneTab } from './components/restZone/RestZoneTab';
import { SALON_LEVELS, MANAGER_TRAITS, TREATMENTS } from './beautySalonEngine';
import type { ScheduledTreatment } from './beautySalonEngine';
import {
  REST_PROGRAM, admitToRest, advanceRestZoneWeek, assessCareNeeds, recommendedSalonTreatmentId,
  nextRestSeatCost, recommendedAttendantCount, restEligibility, restProgramCost, restZoneWeeklyUpkeep
} from './restZoneEngine';
import { EXHAUSTION_UPGRADES, weeklyHealthWear } from './exhaustionEngine';
import {
  PLEASURE_HOUSE_UPGRADES,
  PLEASURE_HOUSE_UPGRADE_IDS,
  pleasureHouseExhaustionBump,
  pleasureHouseRevenueMultiplier,
  type PleasureHouseUpgradeId
} from './pleasureHouseEngine';
import {
  STRIP_CLUB_UPGRADES,
  stripClubExhaustionBump,
  stripClubRevenueMultiplier,
  type StripClubUpgradeId
} from './stripClubEngine';
import { StripClubTab } from './components/stripClub/StripClubTab';
import { SchoolKindergartenTab } from './components/school/SchoolKindergartenTab';
import { SchoolTab } from './components/school/SchoolTab';
import { CorrectionCenterTab } from './components/correction/CorrectionCenterTab';
import { SelfDevelopmentTab } from './components/selfDevelopment/SelfDevelopmentTab';
import { MezzanineTab } from './components/mezzanine/MezzanineTab';

import type { ClientContract } from './contractsEngine';
import { generateContract } from './contractsEngine';
import type { SlaveBuyerContract, SlaveContractChannel, StandingMap, CaptiveLotOffer, TradeSupplyContract } from './slaveContractsEngine';
import {
  generateSlaveContract, deliverSlaves, eligibleSlaves,
  assessSlaveUnrest, rollSlaveEscapes, applySlaveBreaking, lifetimeSlaveRevenue,
  getStanding, applyStandingOutcome, isBuyerLocked,
  maxOrdersForStanding, standingTier, effectiveRiskPercent, marketValueOf,
  detectCaravanSupplyTriggers, generateTradeSupplyContract, buyFromSupplyContract,
  signTradeSupplyContract, applyBdsmTraining
} from './slaveContractsEngine';
import { exportGameSave, importGameSave } from './saveImportExport';
import {
  MARKET_IMPROVEMENT_TRACKS,
  generateMarketImprovementRequest,
  marketImprovementEffects,
  type MarketImprovementRequest
} from './marketImprovementsEngine';
import { triggerWeeklyMarketRefresh } from './marketRefreshLogic';
import type { AppTab } from './appNavigation';
import { APP_NAVIGATION } from './appNavigation';
import { buildActivityFeed } from './components/header/notificationFeed';
import { NotificationCenter } from './components/header/NotificationCenter';
import { AuthScreen } from './components/auth/AuthScreen';
import { FileUpload } from './components/ui/FileUpload';
import { SettingsModal } from './components/settings/SettingsModal';
import { loadSettings, saveSettings, type AppSettings } from './settings';
import { setPortrait3dEnabled } from './portrait3dFlag';
import { setOrientationLock } from './telegram';
import { assetUrl } from './assetUrl';
import { ceoPortraitFileNames } from './portraitAssets';
import { BeautySalonTab } from './components/salon/BeautySalonTab';
import { VenueBanner, VENUE_APPEARANCES } from './components/venue';
import {
  ACHIEVEMENT_BY_ID,
  applyWeeklyStats,
  buildSnapshot,
  checkCampaignGoal,
  createEmptyLifetimeStats,
  evaluateAchievements,
  loadGameRecords,
  loadLeaderboard,
  prestigeRevenueMultiplier,
  prestigeStartingFunds,
  recordCampaignResult,
  registerAuctionSale,
  registerBuildingConstructed,
  registerCaravanDispatched,
  registerLoanRepaid,
  registerLoanTaken,
  saveGameRecords,
  saveLeaderboard,
  updateGameRecords,
  type GameRecords,
  type LeaderboardEntry
} from './metaProgressEngine';
import { AchievementsPanel } from './components/meta/AchievementsPanel';
import { LeaderboardPanel } from './components/meta/LeaderboardPanel';
import { CampaignGoalPanel } from './components/meta/CampaignGoalPanel';
import { CampaignEndingModal } from './components/meta/CampaignEndingModal';
import { FinanceHistoryPanel } from './components/finances/FinanceHistoryPanel';
import { OfficeFloorPlan } from './components/office/OfficeFloorPlan';
import {
  BANK_BOARD_PROCEDURE,
  COURT_PROCEDURES,
  INITIATOR_LABELS,
  PATH_LABELS,
  advanceBankruptcyWeek,
  fileBankruptcyCase,
  getProcedureDefinition,
  type BankruptcyInitiator,
  type BankruptcyPath,
  type BankruptcyProcedure
} from './bankruptcyEngine';

const rollChance = (probability: number) => Math.random() < probability;
const rollPercent = (percent: number) => Math.random() * 100 < percent;
const rollInt = (max: number) => Math.floor(Math.random() * max);

export interface SaveSlotInfo {
  slotNumber: number;
  campaignName: string;
  week: number;
  funds: number;
  timestamp: string;
  exists: boolean;
}

const getSlotKey = (slotNum: number) => `emporium_save_slot_${slotNum}`;

/** How many capture squads can be in the field at the same time. */
const MAX_ACTIVE_CAPTURE_OPS = 3;

/** Upper bound on unresolved ambushes waiting for the player in one week. */
const MAX_QUEUED_RAIDS = 3;

/** Fatigue an operative sheds per week while left «без работы». */
const OFF_DUTY_EXHAUSTION_RECOVERY = 8;

/** Venues that put an operative on the floor; `unassigned` deliberately does not. */
const worksVenue = (venue: Character['assignedVenue']): boolean =>
  Boolean(venue) && venue !== 'unassigned';

const VENUE_LABELS: Record<NonNullable<Character['assignedVenue']>, string> = {
  trade: 'Торговая сеть',
  beauty_salon: 'Салон красоты',
  strip_club: 'Стрип-клуб',
  pleasure_house: 'Дом удовольствия',
  security: 'Служба безопасности',
  bdsm_room: 'БДСМ-комната',
  auction_house: 'Аукционный дом',
  unassigned: 'Без работы'
};

const GENDER_LABELS: Record<Character['gender'], string> = {
  women: 'Женщина',
  men: 'Мужчина',
  trans: 'Трансгендер'
};

const HEALTH_LABELS: Record<Character['healthLevel'], string> = {
  Pristine: 'Отличное',
  Good: 'Хорошее',
  Fair: 'Среднее',
  Poor: 'Плохое',
  Critical: 'Критическое'
};

const EXHAUSTION_LABELS: Record<Character['exhaustionLevel'], string> = {
  Rested: 'Отдохнувший',
  Tired: 'Уставший',
  Exhausted: 'Истощённый',
  'Burned Out': 'Выгоревший'
};

const ROLE_LABELS: Record<string, string> = {
  'Master Operative': 'Ведущий агент',
  'Senior Agent': 'Старший агент',
  'Logistics Expert': 'Специалист по логистике',
  'Negotiator': 'Переговорщик',
  'Security Chief': 'Начальник безопасности',
  'Accountant': 'Бухгалтер',
  'Chief Executive Officer': 'Главный исполнительный директор',
  'Logistics Director': 'Директор по логистике'
};

/** Переводит роль сотрудника; неизвестные значения (пленники, дети) не трогаем. */
const roleLabel = (role: string): string => {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  const childMatch = /^Company Property \(child of (.+)\)$/.exec(role);
  if (childMatch) return `Собственность компании (ребёнок: ${childMatch[1]})`;
  return role;
};

const venueLabel = (venue: Character['assignedVenue']): string => VENUE_LABELS[venue ?? 'trade'];

type RosterSortId = 'none' | 'name' | 'age' | 'gender' | 'health' | 'exhaustion' | 'earnings' | 'pregnancy' | 'idle' | 'purchase' | 'value';

/** Порядок групп при сортировке по полу: женщины, мужчины, трансгендеры. */
const GENDER_SORT_ORDER: Character['gender'][] = ['women', 'men', 'trans'];

const genderSortRank = (gender: Character['gender']): number => {
  const index = GENDER_SORT_ORDER.indexOf(gender);
  return index === -1 ? GENDER_SORT_ORDER.length : index;
};

/** Order shown in the selector; `descending` is the direction each mode starts in. */
const ROSTER_SORT_OPTIONS: { id: RosterSortId; label: string; descending: boolean }[] = [
  { id: 'none', label: 'Без сортировки', descending: false },
  { id: 'value', label: 'Стоимость на рынке', descending: true },
  { id: 'pregnancy', label: 'Беременность', descending: true },
  { id: 'health', label: 'Здоровье', descending: true },
  { id: 'earnings', label: 'Заработок', descending: true },
  { id: 'purchase', label: 'Неделя покупки', descending: true },
  { id: 'name', label: 'Имя по алфавиту', descending: false },
  { id: 'gender', label: 'Пол', descending: false },
  { id: 'age', label: 'Возраст', descending: false },
  { id: 'exhaustion', label: 'Усталость', descending: true },
  { id: 'idle', label: 'Без работы', descending: true }
];

const rosterSortById = (id: RosterSortId) =>
  ROSTER_SORT_OPTIONS.find(option => option.id === id) ?? ROSTER_SORT_OPTIONS[0];

/**
 * Числовой ключ сортировки. Для «беременность» это срок беременности (ближе к родам — выше),
 * для «без работы» — флаг отсутствия назначения, поэтому такие сотрудники оказываются наверху,
 * для «неделя покупки» — неделя присоединения к компании (свежие покупки выше при убывании),
 * для «стоимость на рынке» — оценка персонала на премиальном рынке сбыта,
 * для «пол» — ранг гендерной группы (женщины, мужчины, трансгендеры), внутри группы — по имени.
 */
const rosterSortValue = (char: Character, mode: RosterSortId): number => {
  switch (mode) {
    case 'age': return char.age;
    case 'gender': return genderSortRank(char.gender);
    case 'health': return char.exactHealth;
    case 'exhaustion': return char.exactExhaustion;
    case 'earnings': return char.pleasureStats?.totalEarnings ?? 0;
    case 'pregnancy': return char.pregnancy ? char.pregnancy.daysPregnant : -1;
    case 'idle': return worksVenue(char.assignedVenue) ? 0 : 1;
    case 'purchase': return char.acquiredWeek ?? 0;
    case 'value': return marketValueOf(char);
    default: return 0;
  }
};

/** Порядок списка персонала дома удовольствия; направление задаётся тумблером. */
const sortRoster = (roster: Character[], mode: RosterSortId, descending: boolean): Character[] => {
  if (mode === 'none') return roster;
  const direction = descending ? -1 : 1;
  const byName = (a: Character, b: Character) => a.name.localeCompare(b.name, 'ru');
  if (mode === 'name') return [...roster].sort((a, b) => direction * byName(a, b));
  return [...roster].sort((a, b) =>
    direction * (rosterSortValue(a, mode) - rosterSortValue(b, mode)) || byName(a, b)
  );
};

const getSlotInfo = (slotNum: number): SaveSlotInfo => {
  const data = localStorage.getItem(getSlotKey(slotNum)) || (slotNum === 1 ? localStorage.getItem('emporium_save_06') : null);
  if (!data) {
    return { slotNumber: slotNum, campaignName: 'Пустой слот', week: 0, funds: 0, timestamp: '', exists: false };
  }
  try {
    const parsed = JSON.parse(data);
    return {
      slotNumber: slotNum,
      campaignName: parsed.campaignName || 'Синдикат Эмпориум',
      week: parsed.week || 1,
      funds: parsed.funds || 0,
      timestamp: parsed.timestamp || new Date().toLocaleString(),
      exists: true
    };
  } catch {
    return { slotNumber: slotNum, campaignName: 'Повреждённое сохранение', week: 0, funds: 0, timestamp: '', exists: false };
  }
};

const getFemaleSlaveCareSummary = (character: Character) => {
  const assessment = assessCareNeeds(character);

  return {
    status: assessment.status,
    needs: assessment.needs.length
      ? assessment.needs.map(need => need.label)
      : ['Особых потребностей по текущим показателям нет'],
    tone: assessment.severity === 'critical'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : assessment.severity === 'attention'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  };
};

const legacyRosterViewEnabled: boolean = false;

export default function App() {
  useBtcRate();
  const [currentPlatform, setCurrentPlatform] = useState<Platform>(() =>
    new URLSearchParams(window.location.search).get('platform') === 'tiktok' ? 'tiktok' : 'original'
  );
  const [currentScreen, setCurrentScreen] = useState<'main_menu' | 'playing' | 'load_game' | 'new_game'>('main_menu');
  const [showInGameMenu, setShowInGameMenu] = useState(false);


  // New game creator state
  const [newCampaignName, setNewCampaignName] = useState('Глобальный синдикат Эмпориум');
  const [newCeoName, setNewCeoName] = useState('Елена Вэнс');
  const [newCeoGender, setNewCeoGender] = useState<Character['gender']>('women');
  const [newCeoBirthDate, setNewCeoBirthDate] = useState('1985-06-15');
  const [newCeoBirthPlace, setNewCeoBirthPlace] = useState('Вена, Австрия');
  const [newCeoPhoto, setNewCeoPhoto] = useState<string | null>(null);
  const [newCeoPortraitUrl, setNewCeoPortraitUrl] = useState<string | null>(null);
  const [newStartingFunds, setNewStartingFunds] = useState(125000);
  const [mapCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [gameState, setGameState] = useState<ManagedCampaignState>(() => {
    try {
      return readCampaignFromStorage(1) ?? createInitialCampaign();
    } catch (error) {
      console.error('Unable to read saved campaign; starting with a new campaign.', error);
      return createInitialCampaign();
    }
  });

  // Meta-progress: campaign ending modal (victory/defeat) and the
  // local records board, persisted outside the campaign save.
  const [campaignEnding, setCampaignEnding] = useState<{ type: 'victory' | 'defeat'; week: number } | null>(null);
  const [gameRecords, setGameRecords] = useState<GameRecords>(() => loadGameRecords());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());

const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  // Which mezzanine map mode is shown; the game tabs keep their own state, so
  // switching between the мезонин and the campaign never resets either side.
  const [mezzanineView, setMezzanineView] = useState<'mezzanine' | AppTab>('mezzanine');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [activeEvent, setActiveEvent] = useState<GameEvent | ExpansionEvent | null>(null);
  // Ambushes are frequent, so several can land in the same week. The head of the
  // queue is the one shown; resolving it promotes the next.
  const [raidQueue, setRaidQueue] = useState<ActiveRaid[]>([]);
  const activeRaid = raidQueue[0] ?? null;
  const [auction, setAuction] = useState<{ currentBid: number; round: number; lotQuality: 'high' | 'elite'; lotName: string } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Hospital purchase quantities (per line item) and the admission toast queue.
  const [hospitalWardQty, setHospitalWardQty] = useState<Record<string, number>>({});
  const [hospitalEquipQty, setHospitalEquipQty] = useState<Record<string, number>>({});
  const [hospitalNotices, setHospitalNotices] = useState<{ id: number; text: string }[]>([]);
  const hospitalNoticeIdRef = useRef(0);
  const pushHospitalNotice = (text: string) => {
    hospitalNoticeIdRef.current += 1;
    const id = hospitalNoticeIdRef.current;
    setHospitalNotices(prev => [...prev.slice(-3), { id, text }]);
    setTimeout(() => setHospitalNotices(prev => prev.filter(notice => notice.id !== id)), 7000);
  };

  /** Queues freshly rolled ambushes; the modal stack resolves them one by one. */
  const enqueueRaids = (raids: ActiveRaid[]) => {
    if (raids.length === 0) return;
    setRaidQueue(prev => [...prev, ...raids].slice(0, MAX_QUEUED_RAIDS));
  };
  const popRaid = () => setRaidQueue(prev => prev.slice(1));

  // Everything the player has to look at, folded into the four header dropdown sections.
  const activityFeed = buildActivityFeed(gameState, { raids: raidQueue, activeEvent, notices: hospitalNotices });

  // New caravan form state
  const [caravanName, setCaravanName] = useState('Трансконтинентальный маршрут №1');
  const [destRegion, setDestRegion] = useState(REGIONS[10].name);
  const [investment, setInvestment] = useState(25000);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>(gameState.roster[0]?.id || '');

  // New capture operation form state
  const [captureCodename, setCaptureCodename] = useState('Операция «Бархатная ловушка»');
  const [captureRegionId, setCaptureRegionId] = useState(REGIONS[2].id);
  const [captureQuality, setCaptureQuality] = useState<CaptureTargetQuality>('medium');
  const [captureBudget, setCaptureBudget] = useState(15000);
  const [captureSquadIds, setCaptureSquadIds] = useState<string[]>([]);

  // Salon treatment booking modal state
  const [bookingCharacterId, setBookingCharacterId] = useState<string>(gameState.roster[0]?.id || '');
  const [bookingTreatmentId, setBookingTreatmentId] = useState<string>(TREATMENTS[0].id);
  const [bookingIsAuto, setBookingIsAuto] = useState<boolean>(false);
  const [bookingInterval, setBookingInterval] = useState<number>(2);

  // Loan application state
  const [loanAmount, setLoanAmount] = useState<number>(50000);
  const [loanTerm, setLoanTerm] = useState<number>(12);
  const [loanRepaymentType, setLoanRepaymentType] = useState<'fixed' | 'income_share'>('fixed');

  // Bankruptcy filing form (Board of Directors tab)
  const [bankruptcyInitiator, setBankruptcyInitiator] = useState<BankruptcyInitiator>('debtor');
  const [bankruptcyPath, setBankruptcyPath] = useState<BankruptcyPath>('court');
  const [bankruptcyProcedure, setBankruptcyProcedure] = useState<BankruptcyProcedure>('financial_recovery');

  // Сортировка персонала дома удовольствия: выбранный режим и направление по нему.
  const [rosterSortId, setRosterSortId] = useState<RosterSortId>('none');
  const [rosterSortFlipped, setRosterSortFlipped] = useState<Partial<Record<RosterSortId, boolean>>>({});
  const rosterSortDescending = rosterSortFlipped[rosterSortId] ?? rosterSortById(rosterSortId).descending;
  const sortedRoster = sortRoster(gameState.roster, rosterSortId, rosterSortDescending);
  const idleRosterCount = gameState.roster.filter(char => !worksVenue(char.assignedVenue)).length;
  const pregnantRosterCount = gameState.roster.filter(char => Boolean(char.pregnancy)).length;
  const rosterMarketValue = gameState.roster.reduce((sum, char) => sum + marketValueOf(char), 0);
  const auctionHouseStaff = getAuctionHouseStaff(gameState.auxiliaryBuildings, gameState.employees);
  const auctionHouseEffects = calculateBuildingWeeklyEffects(gameState.auxiliaryBuildings, gameState.employees);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('platform') === 'tiktok') {
      setCurrentPlatform('tiktok');
    }
  }, []);

  useEffect(() => {
    if (currentScreen === 'playing') {
      const saveData = {
        ...gameState,
        timestamp: new Date().toLocaleString()
      };
      localStorage.setItem(`emporium_save_slot_${gameState.slot || 1}`, JSON.stringify(saveData));
    }
  }, [gameState, currentScreen]);

  // Applies the screen orientation lock from settings (Telegram Mini App).
  useEffect(() => {
    setOrientationLock(appSettings.orientation);
  }, [appSettings.orientation]);

  // Mirrors the emporium_3d feature flag into the global store
  // consumed by the portrait renderers.
  useEffect(() => {
    setPortrait3dEnabled(appSettings.emporium_3d);
  }, [appSettings.emporium_3d]);

  // Closes the in-game menu and mobile navigation on Escape.
  useEffect(() => {
    if (!showInGameMenu && !isMobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (showInGameMenu) setShowInGameMenu(false);
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showInGameMenu, isMobileMenuOpen]);

  const renderNavigationItems = (collapsed = false, mobile = false) => APP_NAVIGATION.map(tab => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id && mezzanineView === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => {
          setActiveTab(tab.id);
          setMezzanineView(tab.id);
          if (mobile) setIsMobileMenuOpen(false);
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? tab.label : undefined}
        title={collapsed ? tab.label : undefined}
        className={`group flex min-h-11 w-full items-center gap-3 border-l-2 px-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 ${collapsed ? 'justify-center px-2' : ''} ${isActive ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'}`}
      >
        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-500 group-hover:text-slate-200'}`} />
        {!collapsed && <span className="truncate">{tab.label}</span>}
      </button>
    );
  });

  const showNotify = (msg: string) => {
    if (!appSettings.notifications) return;
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    setAppSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const saveGameToSlot = (slotNum: number) => {
    const updatedState = { ...gameState, slot: slotNum, timestamp: new Date().toLocaleString() };
    setGameState(updatedState);
    localStorage.setItem(getSlotKey(slotNum), JSON.stringify(updatedState));
    showNotify(`Игра успешно сохранена в слот ${slotNum}!`);
  };

  const loadGameFromSlot = (slotNum: number) => {
    const data = localStorage.getItem(getSlotKey(slotNum)) || (slotNum === 1 ? localStorage.getItem('emporium_save_06') : null);
    if (!data) {
      showNotify(`Слот ${slotNum} пуст.`);
      return;
    }
    try {
      setGameState(migrateCampaignState(JSON.parse(data)));
      setCurrentScreen('playing');
showNotify(`Кампания загружена из слота ${slotNum}!`);
    } catch {
      showNotify(`Не удалось загрузить слот ${slotNum}.`);
    }
  };

  // Mezzanine map view (0.3.7): the hub reports its region/city/zoom/pan, and
  // the campaign save keeps it so the map comes back where the player left it.
  const handleMezzanineViewChange = (mezzanine: MezzanineViewState) => {
    setGameState(prev => {
      const current = prev.mezzanine;
      if (current
        && current.viewMode === mezzanine.viewMode
        && current.selectedRegionId === mezzanine.selectedRegionId
        && current.selectedCity?.seed === mezzanine.selectedCity?.seed
        && current.gridSize === mezzanine.gridSize
        && current.offset.x === mezzanine.offset.x
        && current.offset.y === mezzanine.offset.y
        && current.citySeed === mezzanine.citySeed) {
        return prev;
      }
      return { ...prev, mezzanine };
    });
  };

  const deleteSlotData = (slotNum: number) => {
    localStorage.removeItem(getSlotKey(slotNum));
    showNotify(`Слот ${slotNum} удалён.`);
    // Force rerender or state refresh
    setGameState({ ...gameState });
  };

  const startNewCampaign = () => {
    const newState = createInitialCampaign({
      campaignName: newCampaignName.trim() || 'Глобальный синдикат Эмпориум',
      ceoName: `${newCeoName.trim() || 'Елена Вэнс'} (${newCeoGender === 'women' ? 'женщина' : newCeoGender === 'men' ? 'мужчина' : 'трансгендер'}, ${newCeoBirthDate}, ${newCeoBirthPlace}) (генеральный директор)`,
      ceoGender: newCeoGender,
      ceoImage: newCeoPhoto ?? newCeoPortraitUrl ?? undefined,
      funds: newStartingFunds,
      week: 1,
      fresh: true
    });

    setGameState(newState);
    if (newCeoPhoto) localStorage.setItem('ceoPhoto', newCeoPhoto);
    localStorage.setItem(getSlotKey(1), JSON.stringify(newState));
    setCurrentScreen('playing');
    setActiveTab('mezzanine');
    setMezzanineView('mezzanine');
    showNotify('Новая кампания началась!');
  };

  /**
   * New Game+: the campaign goal was achieved, so the syndicate
   * restarts with a prestige level — permanent revenue bonus and
   * a richer starting treasury.
   */
  const startPrestigeCampaign = () => {
    const nextLevel = (gameState.metaProgress?.prestige.level ?? 0) + 1;
    const newState = createInitialCampaign({
      campaignName: newCampaignName.trim() || 'Глобальный синдикат Эмпориум',
      ceoName: newCeoName.trim() || 'Елена Вэнс (генеральный директор)',
      funds: prestigeStartingFunds(newStartingFunds, nextLevel),
      week: 1,
      fresh: true
    });
    newState.metaProgress = {
      ...newState.metaProgress,
      prestige: { level: nextLevel, victories: (gameState.metaProgress?.prestige.victories ?? 0) + 1 }
    };
    setGameState(newState);
    localStorage.setItem(getSlotKey(1), JSON.stringify(newState));
    setCurrentScreen('playing');
    setCampaignEnding(null);
    showNotify(`New Game+ начат! Престиж ${nextLevel}: +${Math.round((prestigeRevenueMultiplier(nextLevel) - 1) * 100)}% к доходам.`);
  };

  /** Teachers available for the School: hired employees with the teacher specialty. */
  const schoolTeachers = useMemo<SchoolTeacherProfile[]>(() => {
    return gameState.employees
      .filter(employee => employee.specialty === 'teacher')
      .map(employee => ({
        name: employee.name,
        skill: employee.skill,
        teachingSkill: Math.min(100, Math.round(employee.skill * 0.7 + employee.experience * 0.2)),
        charisma: Math.round(50 + employee.morale * 0.3),
        intelligence: employee.skill
      }));
  }, [gameState.employees]);

  const enrollInSchool = (characterId: string, courseId: SchoolCourseId) => {
    const character = gameState.roster.find(entry => entry.id === characterId);
    if (!character) return;
    const course = SCHOOL_COURSE_BY_ID[courseId];
    if (!course) return;
    setGameState(prev => ({
      ...prev,
      schoolEnrolments: enrollStudentInEngine(prev.schoolEnrolments || [], characterId, courseId, prev.week)
    }));
    showNotify(`${character.name} записан(а) на «${course.name}».`);
  };

  const cancelSchoolEnrolment = (characterId: string) => {
    setGameState(prev => ({
      ...prev,
      schoolEnrolments: cancelSchoolEnrolmentInEngine(prev.schoolEnrolments || [], characterId)
    }));
  };

  const enrollInCorrectionCourse = (
    characterId: string,
    courseId: CorrectionCourseId,
    intensity: CorrectionIntensity
  ) => {
    const character = gameState.roster.find(entry => entry.id === characterId);
    if (!character) return;
    setGameState(prev => ({
      ...prev,
      correctionEnrolments: enrollInCorrection(
        prev.correctionEnrolments || [],
        characterId,
        courseId,
        intensity,
        prev.week
      )
    }));
    showNotify(`${character.name} направлен(а) в Центр коррекции.`);
  };

  const cancelCorrectionCourse = (characterId: string) => {
    setGameState(prev => ({
      ...prev,
      correctionEnrolments: cancelCorrectionEnrolment(prev.correctionEnrolments || [], characterId)
    }));
  };

  const applyTraitPlan = (
    characterId: string,
    plan: { operation: TraitOperation; traitId: TraitId; replacementId?: TraitId }
  ) => {
    const character = gameState.roster.find(entry => entry.id === characterId);
    if (!character) return;
    const result = applyTraitOperation(character, plan);
    if (!result.success) {
      showNotify(result.log);
      return;
    }
    if (gameState.funds < result.cost) {
      showNotify(`Недостаточно средств: требуется ${formatMoney(result.cost)}.`);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - result.cost,
      roster: prev.roster.map(entry => (entry.id === characterId ? result.character : entry))
    }));
    showNotify(result.log);
  };

  const buildOrUpgradeBuilding = (buildingId: BuildingId) => {
    const building = gameState.auxiliaryBuildings.find(item => item.id === buildingId);
    if (!building) return;
    const cost = getBuildingActionCost(building);
    if (cost === null) {
      showNotify('Здание уже достигло максимального уровня.');
      return;
    }
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств: требуется ${formatMoney(cost)}.`);
      return;
    }
    const nextLevel = building.level + 1;
    const definition = getBuildingDefinition(buildingId);
    setGameState(prev => {
      const auxiliaryBuildings = prev.auxiliaryBuildings.map(item => item.id === buildingId ? { ...item, level: nextLevel } : item);
      const prioritySpecialties = getVacantSpecialties(
        auxiliaryBuildings,
        prev.employees,
        prev.restZone.attendantIds,
        recommendedAttendantCount(prev.restZone.seats)
      );
      return {
        ...prev,
        funds: prev.funds - cost,
        auxiliaryBuildings,
        metaProgress: registerBuildingConstructed(prev.metaProgress),
        employeeCandidates: ensureEmployeeCandidatesForVacancies(prev.employeeCandidates, prioritySpecialties, prev.week),
        log: [`${building.level === 0 ? 'Построено' : 'Улучшено'} здание «${definition.name}» до уровня ${nextLevel} за ${formatMoney(cost)}.`, ...prev.log].slice(0, 50)
      };
    });
    showNotify(`${definition.name}: уровень ${nextLevel}.`);
  };

  const assignEmployeeToBuilding = (employeeId: string, buildingId: BuildingId | null, slotIndex = 0) => {
    const building = buildingId ? gameState.auxiliaryBuildings.find(item => item.id === buildingId) : null;
    if (buildingId && (!building || building.level <= 0)) {
      showNotify('Нельзя назначить сотрудника на недоступный пост.');
      return;
    }
    const employee = employeeId ? gameState.employees.find(item => item.id === employeeId) : undefined;
    if (employeeId && buildingId && (!employee || !specialtiesForSlot(getBuildingDefinition(buildingId), slotIndex).includes(employee.specialty))) {
      showNotify('Для этого поста нужен сотрудник подходящей специальности.');
      return;
    }
    // Госпожа/Мастер posts are gender-locked: only a woman can be госпожа and only
    // a man can be мастер, matching the specialty they were hired under.
    if (employeeId && buildingId && employee && !fitsSpecialty(employee.specialty, employee.gender)) {
      showNotify(`Пост «${specialtyDefinitionOf(employee.specialty).role}» открыт только для ${requiredGenderForSpecialty(employee.specialty) === 'women' ? 'женщин' : 'мужчин'}.`);
      return;
    }
    const currentAssigneeId = building?.assignedEmployeeIds[slotIndex];
    if (employeeId && building?.assignedEmployeeIds.some((id, index) => id === employeeId && index !== slotIndex)) {
      showNotify('Этот сотрудник уже назначен на другой пост в здании.');
      return;
    }
    if (employee?.assignedBuildingId && employee.assignedBuildingId !== buildingId) {
      showNotify('Сначала снимите сотрудника с его текущего поста.');
      return;
    }

    setGameState(prev => ({
      ...prev,
      employees: prev.employees.map(item => {
        if (item.id === employeeId) return { ...item, assignedBuildingId: buildingId };
        if (item.id === currentAssigneeId) return { ...item, assignedBuildingId: null };
        return item;
      }),
      auxiliaryBuildings: prev.auxiliaryBuildings.map(item => {
        if (item.id !== buildingId) return employeeId && item.assignedEmployeeIds.includes(employeeId)
          ? { ...item, assignedEmployeeIds: item.assignedEmployeeIds.filter(id => id !== employeeId) }
          : item;
        const assignedEmployeeIds = [...item.assignedEmployeeIds];
        if (employeeId) assignedEmployeeIds[slotIndex] = employeeId;
        else assignedEmployeeIds.splice(slotIndex, 1);
        return { ...item, assignedEmployeeIds };
      }),
      log: [`${employee?.name ?? currentAssigneeId ?? 'Сотрудник'} ${buildingId ? `назначен в «${getBuildingDefinition(buildingId).name}»` : 'снят с поста'}.`, ...prev.log].slice(0, 50)
    }));
    showNotify(buildingId ? 'Сотрудник назначен на пост.' : 'Сотрудник снят с поста.');
  };

const hireEmployeeCandidate = (candidateId: string) => {
    const candidate = gameState.employeeCandidates.find(item => item.id === candidateId);
    if (!candidate) return;
    if (gameState.employees.length >= gameState.hiringSlots) {
      showNotify(`Лимит штата — ${gameState.hiringSlots} сотрудников. Купите место в отделе кадров.`);
      return;
    }
setGameState(prev => {
      const currentCandidate = prev.employeeCandidates.find(item => item.id === candidateId);
      if (!currentCandidate || prev.employees.length >= prev.hiringSlots) return prev;
      const employees = [...prev.employees, makeHiredEmployee(currentCandidate, prev.week)];
      // Top the pool back up right away so hiring never leaves the list short.
      const prioritySpecialties = getVacantSpecialties(
        prev.auxiliaryBuildings,
        employees,
        prev.restZone.attendantIds,
        recommendedAttendantCount(prev.restZone.seats)
      );
      const employeeCandidates = ensureEmployeeCandidatesForVacancies(
        refreshEmployeeCandidates(
          prev.employeeCandidates.filter(item => item.id !== candidateId),
          prev.week,
          undefined,
          prioritySpecialties
        ),
        prioritySpecialties,
        prev.week
      );
      return {
        ...prev,
        employees,
        employeeCandidates,
        log: [`Нанят сотрудник ${currentCandidate.name} (${currentCandidate.specialty}), оплата ${formatMoney(currentCandidate.weeklyWage)}/нед.`, ...prev.log].slice(0, 50)
      };
    });
    showNotify(`${candidate.name} принят(а) на работу.`);
  };

  /**
   * Chief doctor's hire: takes a candidate of the requested specialty
   * from the pool (or rolls a fresh one when the pool holds none), pays
   * nothing up front and posts medical staff straight to the hospital
   * post. Respects the hiring-slot cap like every other hire.
   */
  const hireMedicalSpecialty = (specialty: EmployeeSpecialty) => {
    if (gameState.employees.length >= gameState.hiringSlots) {
      showNotify(`Лимит штата — ${gameState.hiringSlots} сотрудников. Купите место в отделе кадров.`);
      return;
    }
    setGameState(prev => {
      if (prev.employees.length >= prev.hiringSlots) return prev;

      let candidates = prev.employeeCandidates;
      let candidate = candidates.find(item => item.specialty === specialty);
      if (!candidate) {
        const rolled = createEmployeeCandidates(1, [specialty], Math.abs(Math.trunc(prev.week)));
        const fresh = rolled[0];
        if (!fresh) return prev;
        candidate = fresh;
      } else {
        candidates = candidates.filter(item => item.id !== candidate!.id);
      }

      const employee = makeHiredEmployee(candidate, prev.week);
      const employees = [...prev.employees, employee];

      // The chief doctor posts the new medical hire to the hospital post:
      // the first free slot whose specialty list accepts the hire.
      const auxiliaryBuildings = prev.auxiliaryBuildings.map(building => {
        if (building.id !== 'hospital' || building.level <= 0) return building;
        const definition = getBuildingDefinition('hospital');
        let slotIndex = -1;
        for (let index = 0; index < totalPostCount(definition); index += 1) {
          if (building.assignedEmployeeIds[index]) continue;
          if (!specialtiesForSlot(definition, index).includes(specialty)) continue;
          if (!fitsSpecialty(specialty, employee.gender)) continue;
          slotIndex = index;
          break;
        }
        if (slotIndex < 0) return building;
        const assignedEmployeeIds = [...building.assignedEmployeeIds];
        assignedEmployeeIds[slotIndex] = employee.id;
        return { ...building, assignedEmployeeIds };
      });

      const prioritySpecialties = getVacantSpecialties(
        auxiliaryBuildings,
        employees,
        prev.restZone.attendantIds,
        recommendedAttendantCount(prev.restZone.seats)
      );
      return {
        ...prev,
        employees,
        auxiliaryBuildings,
        employeeCandidates: ensureEmployeeCandidatesForVacancies(
          refreshEmployeeCandidates(candidates, prev.week, EMPLOYEE_CANDIDATE_CAP, prioritySpecialties),
          prioritySpecialties,
          prev.week
        ),
        log: [`Главврач нанял ${employee.name} (${specialtyDefinitionOf(specialty).role}), оплата ${formatMoney(employee.weeklyWage)}/нед.`, ...prev.log].slice(0, 50)
      };
    });
    showNotify('Главврач нанял сотрудника для больницы.');
  };

  const dismissEmployee = (employeeId: string) => {
    const employee = gameState.employees.find(item => item.id === employeeId);
    if (!employee) return;
    setGameState(prev => ({
      ...prev,
      employees: prev.employees.filter(item => item.id !== employeeId),
      auxiliaryBuildings: prev.auxiliaryBuildings.map(building => ({ ...building, assignedEmployeeIds: building.assignedEmployeeIds.filter(id => id !== employeeId) })),
      restZone: { ...prev.restZone, attendantIds: prev.restZone.attendantIds.filter(id => id !== employeeId) },
      employeeCandidates: ensureEmployeeCandidatesForVacancies(
        prev.employeeCandidates,
        getVacantSpecialties(
          prev.auxiliaryBuildings,
          prev.employees.filter(item => item.id !== employeeId),
          prev.restZone.attendantIds.filter(id => id !== employeeId),
          recommendedAttendantCount(prev.restZone.seats)
        ),
        prev.week
      ),
      log: [`Сотрудник ${employee.name} уволен; назначенный пост освобождён.`, ...prev.log].slice(0, 50)
    }));
    showNotify(`${employee.name} уволен(а); назначение здания снято.`);
  };

/**
 * Manually extends an employee's contract for the default renewal term.
 * Used by the «Продлить по лояльности» action in the staff table; the
 * automatic end-of-week renewal lives in advanceEmployeesWeek.
 */
const renewEmployeeContract = (employeeId: string) => {
  const employee = gameState.employees.find(item => item.id === employeeId);
  if (!employee) return;
  setGameState(prev => ({
    ...prev,
    employees: prev.employees.map(item => item.id === employeeId
      ? { ...item, contractEndWeek: prev.week + CONTRACT_RENEWAL_WEEKS, goodWeeksStreak: Math.max(item.goodWeeksStreak ?? 0, 1) }
      : item),
    log: [`Контракт ${employee.name} продлён до недели ${prev.week + CONTRACT_RENEWAL_WEEKS} по лояльности.`, ...prev.log].slice(0, 50)
  }));
  showNotify(`Контракт ${employee.name} продлён на ${CONTRACT_RENEWAL_WEEKS} недель.`);
};

const refreshCandidates = () => {
  setGameState(prev => ({
      ...prev,
      employeeCandidates: ensureEmployeeCandidatesForVacancies(
        rerollEmployeeCandidates(
          undefined,
          getVacantSpecialties(
            prev.auxiliaryBuildings,
            prev.employees,
            prev.restZone.attendantIds,
            recommendedAttendantCount(prev.restZone.seats)
          ),
          Math.abs(Math.trunc(prev.week))
        ),
        getVacantSpecialties(
          prev.auxiliaryBuildings,
          prev.employees,
          prev.restZone.attendantIds,
          recommendedAttendantCount(prev.restZone.seats)
        ),
        prev.week
      )
    }));
    showNotify('Список кандидатов обновлён.');
  };

  const sellAuctionLot = (lotId: string) => {
    // Market assessment of the lot's character, read before the sale mutates state.
    const pendingLot = gameState.auctionHouse.pendingLots.find(lot => lot.id === lotId);
    // Персонал (рабы и сотрудники) не продаётся без согласия игрока:
    // первое нажатие «Продать» выставляет запрос администратора
    // аукционного дома, продажа состоится только по подтверждению.
    if (pendingLot && 'characterId' in pendingLot
      && !hasPendingSaleConsent(gameState.auctionHouse, lotId)) {
      setGameState(prev => ({
        ...prev,
        auctionHouse: requestCharacterSaleConsent(prev.auctionHouse, lotId, prev.week),
        log: [`Администратор аукционного дома ${AUCTION_HOUSE_ADMINISTRATOR} запросил согласие на продажу «${pendingLot.productName}» за ${formatMoney(pendingLot.appraisedValue)}.`, ...prev.log].slice(0, 50)
      }));
      showNotify(`Администратор аукционного дома ${AUCTION_HOUSE_ADMINISTRATOR} запросил согласие на продажу «${pendingLot.productName}». Подтвердите или отклоните продажу.`);
      return;
    }
    const pendingChar = pendingLot && 'characterId' in pendingLot
      ? gameState.roster.find(c => c.id === pendingLot.characterId)
      : undefined;
    const pendingMarketValue = pendingChar ? marketValueOf(pendingChar) : undefined;
    const pricesDiverge = pendingLot !== undefined && pendingMarketValue !== undefined
      && valuationMismatch(pendingMarketValue, pendingLot.appraisedValue);
    setGameState(prev => {
      const currentStaff = getAuctionHouseStaff(prev.auxiliaryBuildings, prev.employees);
      const auctioneerBonus = calculateBuildingWeeklyEffects(prev.auxiliaryBuildings, prev.employees).auctioneerSaleBonus;
      const saleResult = sellAuctionLotEngine(
        prev.auctionHouse,
        lotId,
        prev.week,
        currentStaff.auctioneer,
        auctioneerBonus,
        currentStaff.buildingLevel,
        prev.reputation
      );
      if (!saleResult.sale) return prev;
      const lot = saleResult.sale;
      const isCharacterLot = 'characterId' in lot;
      const lotChar = isCharacterLot ? prev.roster.find(c => c.id === lot.characterId) : undefined;
      const lotMarketValue = lotChar ? marketValueOf(lotChar) : undefined;
      const announcements = lotMarketValue !== undefined && valuationMismatch(lotMarketValue, lot.appraisedValue)
        ? buildValuationAnnouncements(lot, lotMarketValue, currentStaff.appraiser, currentStaff.auctioneer, auctioneerBonus)
        : [];
      let newRoster = prev.roster;
      if (isCharacterLot) {
        const charId = lot.characterId;
        newRoster = prev.roster.filter(c => c.id !== charId);
      }
      return {
        ...prev,
        funds: prev.funds + saleResult.sale.saleProceeds,
        roster: newRoster,
        auctionHouse: saleResult.state,
        metaProgress: registerAuctionSale(prev.metaProgress, saleResult.sale.saleProceeds),
        log: [isCharacterLot
          ? `Продан персонал «${lot.productName}» на аукционе за ${formatMoney(saleResult.sale.saleProceeds)}${saleResult.sale.winningNpcBidder ? ` (покупатель ${saleResult.sale.winningNpcBidder} поднял цену до ${formatMoney(saleResult.sale.npcWinningBid!)})` : ''}${saleResult.sale.auctioneerBonusPercent ? ` (аукционист +${saleResult.sale.auctioneerBonusPercent}%).` : '.'}`
          : `Продан товарный лот «${lot.productName}» из каравана «${lot.caravanName}» за ${formatMoney(saleResult.sale.saleProceeds)}${saleResult.sale.winningNpcBidder ? ` (покупатель ${saleResult.sale.winningNpcBidder} поднял цену до ${formatMoney(saleResult.sale.npcWinningBid!)})` : ''}${saleResult.sale.auctioneerBonusPercent ? ` (аукционист +${saleResult.sale.auctioneerBonusPercent}%).` : '.'}`,
          ...announcements.map(announcement => announcement.text),
          ...prev.log].slice(0, 50)
      };
    });
    if (pendingLot) {
      const winningNpc = gameState.auctionHouse.recentSales[0]?.winningNpcBidder;
      showNotify(pricesDiverge
        ? `Оценщик и аукционист назвали свои цены. Лот «${pendingLot.productName}» продан — средства зачислены в казну.`
        : winningNpc ? `Лот продан за ${formatMoney(gameState.auctionHouse.recentSales[0]?.saleProceeds)}! Покупатель ${winningNpc} поднял цену.` : 'Лот продан. Средства зачислены в казну.');
    }
  };

  /** Подтверждает запрос администратора и завершает продажу лота персонала. */
  const confirmAuctionSale = (lotId: string) => {
    if (!hasPendingSaleConsent(gameState.auctionHouse, lotId)) return;
    sellAuctionLot(lotId);
  };

  /** Отзывает запрос администратора на продажу лота персонала. */
  const cancelAuctionSaleConsent = (lotId: string) => {
    if (!hasPendingSaleConsent(gameState.auctionHouse, lotId)) return;
    const pendingLot = gameState.auctionHouse.pendingLots.find(lot => lot.id === lotId);
    setGameState(prev => ({
      ...prev,
      auctionHouse: cancelCharacterSaleConsent(prev.auctionHouse, lotId),
      log: [`Продажа «${pendingLot?.productName ?? lotId}» отклонена: согласие игрока не получено.`, ...prev.log].slice(0, 50)
    }));
    showNotify(`Продажа «${pendingLot?.productName ?? lotId}» отклонена — лот остаётся на аукционе.`);
  };

  const assignVenue = (charId: string, venue: NonNullable<Character['assignedVenue']>) => {
    const character = gameState.roster.find(c => c.id === charId);
    // Правило стрип-клуба: в клубе работают только пленники или работники клуба.
    if (venue === 'strip_club' && character) {
      const error = stripClubAssignmentError(character);
      if (error) {
        showNotify(error);
        return;
      }
    }
    setGameState(prev => ({
      ...prev,
      roster: prev.roster.map(c => c.id === charId ? { ...c, assignedVenue: venue } : c),
      log: [`Назначение: ${character ? `${character.name} — ` : ''}${venueLabel(venue)}`, ...prev.log]
    }));
    showNotify(`Назначение обновлено: ${venueLabel(venue)}.`);
  };

  const sellSlaveAtAuction = (char: Character) => {
    if (gameState.auctionHouse.pendingLots.some(lot => 'characterId' in lot && lot.characterId === char.id)) return;
    const lot = createCharacterLot(char, auctionHouseStaff.appraiser);
    const marketValue = marketValueOf(char);
    const announcements = valuationMismatch(marketValue, lot.appraisedValue)
      ? buildValuationAnnouncements(lot, marketValue, auctionHouseStaff.appraiser, auctionHouseStaff.auctioneer, auctionHouseEffects.auctioneerSaleBonus, false)
      : [];
    setGameState(prev => ({
      ...prev,
      auctionHouse: {
        ...prev.auctionHouse,
        pendingLots: [lot, ...prev.auctionHouse.pendingLots]
      },
      log: [`Раб «${char.name}» выставлен на аукцион.`, ...announcements.map(announcement => announcement.text), ...prev.log].slice(0, 50)
    }));
    showNotify(announcements.length > 0
      ? `Раб «${char.name}» выставлен на аукцион. Оценщик и аукционист назвали свои цены.`
      : `Раб «${char.name}» выставлен на аукцион.`);
  };

  /** Sends an operative who needs care to the rest zone for the standard stay. */
  const sendToRestZone = (charId: string) => {
    const character = gameState.roster.find(c => c.id === charId);
    if (!character) return;
    const hospitalPatientIds = (gameState.hospital.patients || []).map(patient => patient.characterId);
    const busyCharacterIds = gameState.roster.filter(isOnCaptureOp).map(c => c.id);
    const eligibility = restEligibility(character, gameState.restZone, { hospitalPatientIds, busyCharacterIds });
    if (!eligibility.eligible) {
      showNotify(eligibility.reason);
      return;
    }
    const cost = restProgramCost();
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств для отдыха ${character.name}: нужно ${formatMoney(cost)}.`);
      return;
    }

    const placement = admitToRest(character, gameState.week);
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      restZone: {
        ...prev.restZone,
        placements: [...prev.restZone.placements, placement],
        totalSpent: prev.restZone.totalSpent + cost
      },
      log: [`Зона отдыха: ${character.name} отправлен на программу «${REST_PROGRAM.name}» (${REST_PROGRAM.weeks} нед., -${formatMoney(cost)}).`, ...prev.log].slice(0, 50)
    }));
    showNotify(`${character.name} отправлен в зону отдыха на ${REST_PROGRAM.weeks} нед.`);
  };

  /** Buys one more place in the rest zone. Seats are unlimited; the price climbs with each purchase. */
  const buyRestSeat = () => {
    const cost = nextRestSeatCost(gameState.restZone);
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств для нового места: нужно ${formatMoney(cost)}.`);
      return;
    }
    const seats = gameState.restZone.seats + 1;
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      restZone: { ...prev.restZone, seats },
      log: [`Зона отдыха: куплено место, теперь ${seats} мест (-${formatMoney(cost)}).`, ...prev.log].slice(0, 50)
    }));
    showNotify(`Зона отдыха расширена: ${seats} мест.`);
  };

  /**
   * Выполняет запрос администратора площадки: покупает место,
   * применяет улучшение или нанимает сотрудника — если казна позволяет.
   */
  const acceptVenueRequest = (venue: RequestVenueId) => {
    const request: VenueAdministratorRequest | null | undefined = venue === 'rest_zone'
      ? gameState.venueRequests?.rest_zone
      : gameState.venueRequests?.[venue];
    if (!request) return;
    if (gameState.funds < request.cost) {
      showNotify(`Недостаточно средств: нужно ${formatMoney(request.cost)}.`);
      return;
    }

    setGameState(prev => {
      if (prev.funds < request.cost) return prev;
      let funds = prev.funds - request.cost;
      let venueCapacity = prev.venueCapacity;
      let restZone = prev.restZone;
      let pleasureHouseUpgrades = prev.pleasureHouseUpgrades;
      let stripClubUpgrades = prev.stripClubUpgrades;
      let beautySalon = prev.beautySalon;
      let auxiliaryBuildings = prev.auxiliaryBuildings;
      let employees = prev.employees;
      let employeeCandidates = prev.employeeCandidates;
      const logs: string[] = [];
      const adminName = venue === 'rest_zone'
        ? 'Администратор зоны отдыха'
        : `Администратор ${administratorVenueLabel(venue)}`;

      if (request.type === 'expansion' && request.target === 'seat') {
        if (venue === 'rest_zone') {
          restZone = { ...restZone, seats: restZone.seats + 1 };
          logs.push(`ЗОНА ОТДЫХА: ${adminName} купил(а) место — теперь ${restZone.seats} мест (-${formatMoney(request.cost)}).`);
        } else {
          const target = venue as keyof typeof venueCapacity;
          venueCapacity = { ...venueCapacity, [target]: venueCapacity[target] + 1 };
          logs.push(`${administratorVenueLabel(venue)}: ${adminName} купил(а) место — теперь ${venueCapacity[target]} мест (-${formatMoney(request.cost)}).`);
        }
      } else if (request.type === 'upgrade') {
        if (venue === 'pleasure_house' && request.target && request.target in pleasureHouseUpgrades) {
          const track = request.target as keyof typeof pleasureHouseUpgrades;
          pleasureHouseUpgrades = { ...pleasureHouseUpgrades, [track]: (pleasureHouseUpgrades[track] ?? 0) + 1 };
          logs.push(`ДОМ УДОВОЛЬСТВИЯ: ${adminName} улучшил(а) трек «${request.target}» до уровня ${pleasureHouseUpgrades[track]} (-${formatMoney(request.cost)}).`);
        } else if (venue === 'strip_club' && request.target && request.target in stripClubUpgrades) {
          const track = request.target as keyof typeof stripClubUpgrades;
          stripClubUpgrades = { ...stripClubUpgrades, [track]: (stripClubUpgrades[track] ?? 0) + 1 };
          logs.push(`СТРИП-КЛУБ: ${adminName} улучшил(а) трек «${request.target}» до уровня ${stripClubUpgrades[track]} (-${formatMoney(request.cost)}).`);
        } else if (venue === 'beauty_salon' && request.target === 'salon_level') {
          const nextLevel = beautySalon.level + 1;
          const levelInfo = SALON_LEVELS.find(level => level.level === nextLevel);
          beautySalon = { ...beautySalon, level: nextLevel };
          logs.push(`САЛОН КРАСОТЫ: ${adminName} поднял(а) салон до «${levelInfo?.name ?? nextLevel}» (-${formatMoney(request.cost)}).`);
        } else if ((venue === 'auction_house' || venue === 'bdsm_room') && request.target) {
          const buildingId = venue as 'auction_house' | 'bdsm_room';
          const definition = getBuildingDefinition(buildingId);
          auxiliaryBuildings = auxiliaryBuildings.map(item =>
            item.id === buildingId ? { ...item, level: item.level + 1 } : item);
          const prioritySpecialties = getVacantSpecialties(
            auxiliaryBuildings,
            employees,
            restZone.attendantIds,
            recommendedAttendantCount(restZone.seats)
          );
          employeeCandidates = ensureEmployeeCandidatesForVacancies(
            employeeCandidates,
            prioritySpecialties,
            prev.week
          );
          logs.push(`${definition.name}: ${adminName} ${request.target === 'construct' ? 'построил(а) здание' : `улучшил(а) до уровня ${auxiliaryBuildings.find(item => item.id === buildingId)?.level}`} (-${formatMoney(request.cost)}).`);
        }
      } else if (request.type === 'hire' && request.target) {
        const specialty = request.target as EmployeeSpecialty;
        const candidate = employeeCandidates.find(item => item.specialty === specialty);
        if (candidate && employees.length < prev.hiringSlots) {
          const newEmployee = makeHiredEmployee(candidate, prev.week);
          employees = [...employees, newEmployee];
          employeeCandidates = employeeCandidates.filter(item => item.id !== candidate.id);
          // Автопостинг: смотритель — в зону отдыха, здания — на свой пост.
          if (venue === 'rest_zone' && specialty === 'attendant') {
            restZone = { ...restZone, attendantIds: [...restZone.attendantIds, newEmployee.id] };
          } else if (venue === 'auction_house' || venue === 'bdsm_room') {
            const buildingId = venue as 'auction_house' | 'bdsm_room';
            auxiliaryBuildings = auxiliaryBuildings.map(item =>
              item.id === buildingId && !item.assignedEmployeeIds.includes(newEmployee.id)
                ? { ...item, assignedEmployeeIds: [...item.assignedEmployeeIds, newEmployee.id] }
                : item);
            employees = employees.map(item =>
              item.id === newEmployee.id ? { ...item, assignedBuildingId: buildingId } : item);
          }
          const prioritySpecialties = getVacantSpecialties(
            auxiliaryBuildings,
            employees,
            restZone.attendantIds,
            recommendedAttendantCount(restZone.seats)
          );
          employeeCandidates = ensureEmployeeCandidatesForVacancies(
            refreshEmployeeCandidates(
              employeeCandidates,
              prev.week,
              undefined,
              prioritySpecialties
            ),
            prioritySpecialties,
            prev.week
          );
          logs.push(`НАЙМ: ${adminName} нанял(а) ${candidate.name} (${specialtyDefinitionOf(specialty).role}).`);
        } else {
          funds = prev.funds;
          logs.push(`${adminName}: нет подходящего кандидата на пост «${specialtyDefinitionOf(specialty).role}» — загляните в отдел кадров.`);
        }
      }

      const venueRequests = { ...prev.venueRequests, [venue]: null };
      return {
        ...prev,
        funds,
        venueCapacity,
        restZone,
        pleasureHouseUpgrades,
        stripClubUpgrades,
        beautySalon,
        auxiliaryBuildings,
        employees,
        employeeCandidates,
        venueRequests,
        log: [...logs, ...prev.log].slice(0, 50)
      };
    });
    showNotify(`Запрос администратора выполнен: ${request.description}`);
  };

  /**
   * Выполняет предложение по улучшению глобального рынка:
   * покупает следующий уровень трека, если казна позволяет.
   */
  const acceptMarketRequest = () => {
    const request: MarketImprovementRequest | null = gameState.marketRequest;
    if (!request) return;
    if (gameState.funds < request.cost) {
      showNotify(`Недостаточно средств: нужно ${formatMoney(request.cost)}.`);
      return;
    }

    setGameState(prev => {
      if (prev.funds < request.cost || !prev.marketRequest) return prev;
      const track = request.track;
      const level = (prev.marketImprovements?.[track] ?? 0) + 1;
      const marketImprovements = { ...prev.marketImprovements, [track]: level };
      const logs: string[] = [
        `ГЛОБАЛЬНЫЙ РЫНОК: ${request.authorName} провёл(а) улучшение «${MARKET_IMPROVEMENT_TRACKS[track].name}» до уровня ${level} (-${formatMoney(request.cost)}).`,
        request.benefit
      ];
      return {
        ...prev,
        funds: prev.funds - request.cost,
        marketImprovements,
        marketRequest: null,
        log: [...logs, ...prev.log].slice(0, 50)
      };
    });
    showNotify(`Улучшение рынка выполнено: ${request.description}`);
  };

  /** Отклоняет текущее предложение по улучшению глобального рынка. */
  const declineMarketRequest = () => {
    const request: MarketImprovementRequest | null = gameState.marketRequest;
    if (!request) return;
    setGameState(prev => ({
      ...prev,
      marketRequest: null,
      log: [`ГЛОБАЛЬНЫЙ РЫНОК: ${request.authorName} отозвал(а) предложение «${MARKET_IMPROVEMENT_TRACKS[request.track].name}» — игрок отказался.`, ...prev.log].slice(0, 50)
    }));
    showNotify('Предложение по улучшению рынка отклонено.');
  };

  /** Opens one more staff position. Positions are unlimited; the price climbs with each purchase. */
  const buyHiringSlot = () => {
    const quote = quoteHiringSlot(gameState.hiringSlots, gameState.funds);
    if (!quote.affordable) {
      showNotify(`Недостаточно средств для нового места в штате: нужно ${formatMoney(quote.cost)}.`);
      return;
    }
    const hiringSlots = gameState.hiringSlots + 1;
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - quote.cost,
      hiringSlots,
      log: [`Отдел кадров: открыто место в штате, теперь ${hiringSlots} (${formatMoney(quote.cost)}, содержание ${formatMoney(quote.upkeep)}/нед.).`, ...prev.log].slice(0, 50)
    }));
    showNotify(`Мест в штате: ${hiringSlots}.`);
  };

  /** Posts or unposts a hired attendant at the rest zone. */
  const toggleRestZoneAttendant = (employeeId: string) => {
    const employee = gameState.employees.find(item => item.id === employeeId);
    if (!employee) return;
    const posted = gameState.restZone.attendantIds.includes(employeeId);
    if (!posted && employee.specialty !== 'attendant') {
      showNotify(`${employee.name} не смотритель — на этот пост не подходит.`);
      return;
    }
    const attendantIds = posted
      ? gameState.restZone.attendantIds.filter(id => id !== employeeId)
      : [...gameState.restZone.attendantIds, employeeId];
    setGameState(prev => ({
      ...prev,
      restZone: { ...prev.restZone, attendantIds },
      log: [
        posted
          ? `Зона отдыха: ${employee.name} снят(а) с поста смотрителя.`
          : `Зона отдыха: ${employee.name} назначен(а) смотрителем.`,
        ...prev.log
      ].slice(0, 50)
    }));
    showNotify(posted ? `${employee.name} снят(а) с поста.` : `${employee.name} теперь работает в зоне отдыха.`);
  };

  /** Pulls an operative back from the rest zone before the program is over. */
  const recallFromRestZone = (charId: string) => {
    const placement = gameState.restZone.placements.find(item => item.characterId === charId);
    if (!placement) return;
    setGameState(prev => ({
      ...prev,
      restZone: {
        ...prev.restZone,
        placements: prev.restZone.placements.filter(item => item.characterId !== charId)
      },
      log: [`Зона отдыха: ${placement.characterName} возвращён досрочно (${placement.weeksTotal - placement.weeksRemaining} из ${placement.weeksTotal} нед.).`, ...prev.log].slice(0, 50)
    }));
    showNotify(`${placement.characterName} вернулся с отдыха раньше срока.`);
  };

  /** Routes an operative to the beauty salon and pre-fills the fitting treatment. */
  const sendToSalon = (charId: string) => {
    const character = gameState.roster.find(c => c.id === charId);
    if (!character) return;
    const treatmentId = recommendedSalonTreatmentId(assessCareNeeds(character));
    if (treatmentId) setBookingTreatmentId(treatmentId);
    setBookingCharacterId(character.id);
    setBookingIsAuto(false);
    setGameState(prev => ({
      ...prev,
      roster: prev.roster.map(c => c.id === charId ? { ...c, assignedVenue: 'beauty_salon' } : c),
      log: [`${character.name} направлен в салон красоты на уход и процедуры.`, ...prev.log].slice(0, 50)
    }));
    setActiveTab('salon');
    showNotify(`${character.name} направлен в салон красоты — подтвердите процедуру.`);
  };

  /**
   * "Breaks" a captive over a week of indoctrination: submission and a little
   * loyalty rise, lowering the slave's unrest. Costs a fee in guards/grooming.
   */
  const breakSlave = (charId: string) => {
    const slave = gameState.roster.find(c => c.id === charId);
    if (!slave || !slave.isSlave) return;
    const cost = 1500 + Math.max(0, (60 - (slave.loyalty ?? 20)) * 40);
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств, чтобы сломить ${slave.name} (нужно ${formatMoney(cost)}).`);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      roster: prev.roster.map(c => c.id === charId ? applySlaveBreaking(c) : c),
      log: [`Потрачено ${formatMoney(cost)} на умиротворение пленника ${slave.name}. Покорность и лояльность выросли.`, ...prev.log]
    }));
    showNotify(`${slave.name} сломлен — покорность выросла, бунт снизился.`);
  };

  /**
   * Buys a captive lot from the buy-side market (Idea 2 arbitrage). The lot's
   * captives enter the roster as slaves; resell them to a high-demand buyer for
   * a margin.
   */
  const buyCaptiveLot = (lot: CaptiveLotOffer) => {
    if (gameState.funds < lot.cost) {
      showNotify(`Недостаточно средств, чтобы купить эту партию (нужно ${formatMoney(lot.cost)}).`);
      return;
    }
    const newSlaves: Character[] = [];
    for (let i = 0; i < lot.quantity; i++) {
      newSlaves.push({
        ...generateSlaveCharacter({
          regionId: lot.regionId,
          quality: lot.quality,
          origin: `market_purchase:${lot.regionId}`
        }),
        acquiredWeek: gameState.week
      });
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - lot.cost,
      roster: [...prev.roster, ...newSlaves],
      captiveLots: (prev.captiveLots || []).filter(l => l.id !== lot.id),
      reservedCaptiveLotIds: (prev.reservedCaptiveLotIds || []).filter(id => id !== lot.id),
log: [`Куплена партия пленных: ${lot.quantity} чел. (качество: ${lot.quality === 'high' ? 'высокое' : lot.quality === 'low' ? 'низкое' : 'среднее'}) из региона ${lot.regionName} за ${formatMoney(lot.cost)}.`, ...prev.log]
    }));
    showNotify(`Куплено пленных: ${lot.quantity} чел. из региона ${lot.regionName} за ${formatMoney(lot.cost)}.`);
  };

  const toggleCaptiveLotReservation = (lotId: string) => {
    const wasReserved = gameState.reservedCaptiveLotIds?.includes(lotId) ?? false;
    setGameState(prev => {
      const currentIds = prev.reservedCaptiveLotIds || [];
      const nextIds = wasReserved ? currentIds.filter(id => id !== lotId) : [...currentIds, lotId];
      return {
        ...prev,
        reservedCaptiveLotIds: nextIds,
log: [`Партия ${lotId} ${wasReserved ? 'снята с брони' : 'зарезервирована до следующей недели'}.`, ...prev.log].slice(0, 50)
      };
    });
    showNotify(wasReserved ? 'Бронирование отменено.' : 'Партия зарезервирована до следующего еженедельного обновления.');
  };

const advanceWeek = () => {
    let currentFunds = gameState.funds;
    const buildingEffects = calculateBuildingWeeklyEffects(gameState.auxiliaryBuildings, gameState.employees);
    const employeeWeek = advanceEmployeesWeek(gameState.employees, buildingEffects, gameState.week);

// Patients occupy a bed for the whole stay, including recovery, so they earn
    // nothing from their venue while they are on the ward.
    const hospitalPatientIds = new Set((gameState.hospital.patients || []).map(patient => patient.characterId));

    // Operatives on a rest program are away from every venue until they return.
    const restingIds = new Set((gameState.restZone?.placements || []).map(placement => placement.characterId));

    // Venue-specific revenues & Pleasure House intimate stats increment
    let venueRevenue = 0;

    // Calculate synergies for each venue once per week
    const venueSynergies: Record<string, SynergyResult> = {};
    const venues = ['beauty_salon', 'strip_club', 'pleasure_house', 'trade', 'security', 'auction_house', 'bdsm_room'];
    for (const v of venues) {
      const staff = gameState.roster.filter(c => c.assignedVenue === v);
      venueSynergies[v] = calculateVenueSynergies(staff);
    }

    const updatedRosterVenues = gameState.roster.map(c => {

      if (c.pregnancy?.status === 'hospitalized') return c;
      // Operatives deployed on a capture operation are away from every venue.
if (isOnCaptureOp(c) || hospitalPatientIds.has(c.id) || restingIds.has(c.id)) return c;
      // Operatives kept «без работы» stay on payroll but generate nothing.
      if (c.assignedVenue === 'unassigned') return c;
      const attr = calculateAttractiveness(c);
      if (c.assignedVenue === 'beauty_salon') {
        const synergies = venueSynergies['beauty_salon'];
        const rev = Math.floor((c.skill * 55 + attr * 20) * synergies.totalRevenueMultiplier);
        venueRevenue += rev;
        return c;
      } else if (c.assignedVenue === 'strip_club') {
        const scMultiplier = stripClubRevenueMultiplier(gameState.stripClubUpgrades);
        const synergies = venueSynergies['strip_club'];
        const rev = Math.floor((c.skill * 65 + attr * 35) * scMultiplier * synergies.totalRevenueMultiplier);
        venueRevenue += rev;
        return c;
      } else if (c.assignedVenue === 'pleasure_house') {
        const phMultiplier = pleasureHouseRevenueMultiplier(gameState.pleasureHouseUpgrades);
        const synergies = venueSynergies['pleasure_house'];
        const rev = Math.floor((c.skill * 80 + attr * 50) * phMultiplier * synergies.totalRevenueMultiplier);
        venueRevenue += rev;
        // Increment vaginal & anal counts based on skill and submission
        const subMult = (c.submission || 50) / 50;
        const addVag = Math.floor((Math.random() * 4 + 2) * subMult);
        const addAnal = Math.floor((Math.random() * 3 + 1) * subMult);
        const newVag = (c.pleasureStats?.vaginalCount || 0) + addVag;
        const newAnal = (c.pleasureStats?.analCount || 0) + addAnal;
        const newEarnings = (c.pleasureStats?.totalEarnings || 0) + rev;
        return {
          ...c,
          pleasureStats: { vaginalCount: newVag, analCount: newAnal, totalEarnings: newEarnings }
        };
      } else {
        const synergies = venueSynergies[c.assignedVenue || 'trade'];
        venueRevenue += Math.floor((c.skill * 45 + 5000) * synergies.totalRevenueMultiplier);
        return c;
      }
    });

    let caravanEarnings = 0;
    const updatedCaravans: Caravan[] = [];
    const newLogs: string[] = [];
    const newCaravanPrisoners: Character[] = [];
    const newGoodsLots: AuctionLot[] = [];

    // Ambushes that fired this week. Caravans roll once per week on the road and
    // capture operations roll harder still, so several can land in the same week.
    // Only as many as the modal stack can still hold are rolled.
    const pendingRaids: ActiveRaid[] = [];
    const raidSlots = Math.max(0, MAX_QUEUED_RAIDS - raidQueue.length);

    // Process capture operations ("захват"): one week on the road — where the
    // squad can be ambushed — then the snatch itself is resolved on arrival.
    const captureFundsDelta = { total: 0 };
    const captureReputationDelta = { total: 0 };
    const seizedTargets: Character[] = [];
    const lostSquadIds = new Set<string>();
    const woundedSquadIds = new Set<string>();
    const updatedCaptureOps: CaptureOperation[] = [];

    (gameState.captureOperations || []).forEach(operation => {
      if (operation.status !== 'outbound') {
        updatedCaptureOps.push(operation);
        return;
      }
      const remaining = operation.weeksRemaining - 1;
      if (remaining > 0) {
        let raidFired = false;
        if (pendingRaids.length < raidSlots) {
          const squad = gameState.roster.filter(c => operation.squadIds.includes(c.id));
          const raid = trySpawnCaptureRaid({
            id: operation.id,
            codename: operation.codename,
            targetName: operation.targetName,
            targetRegionName: operation.targetRegionName,
            leaderName: operation.leaderName,
            leaderId: operation.leaderId,
            squad,
            squadAvgSkill: operation.squadAvgSkill,
            squadAvgLoyalty: operation.squadAvgLoyalty,
            bounty: operation.bounty
          }, buildingEffects.escortCrew, {
            riskReduction: buildingEffects.raidRiskReduction,
            victoryBonus: buildingEffects.raidVictoryBonus
          });
          if (raid) {
            raidFired = true;
            pendingRaids.push(raid);
            newLogs.push(`ЗАСАДА: отряд «${operation.codename}» перехвачен на пути в ${operation.targetRegionName} (${raid.enemyName}), цель — ${operation.targetName}.`);
          }
        }
        updatedCaptureOps.push({
          ...operation,
          weeksRemaining: remaining,
          raidsTriggered: operation.raidsTriggered + (raidFired ? 1 : 0)
        });
        return;
      }

      // Arrival: the squad moves on the target.
      const resolution = resolveCaptureArrival(operation);
      captureFundsDelta.total += resolution.fundsDelta;
      captureReputationDelta.total += resolution.reputationDelta;
      if (resolution.captured) {
        seizedTargets.push(resolution.captured);
        newLogs.push(`Из региона ${operation.targetRegionName} доставлен 1 пленник (${resolution.captured.name}) — обращён в дом удовольствия без работы.`);
      }
      resolution.squadLostIds.forEach(id => lostSquadIds.add(id));
      resolution.squadWoundedIds.forEach(id => woundedSquadIds.add(id));
      newLogs.push(resolution.message);
      updatedCaptureOps.push({ ...operation, weeksRemaining: 0, status: resolution.status });
    });

    // Process caravans
    gameState.caravans.forEach(caravan => {
      if (caravan.status !== 'traveling') {
        updatedCaravans.push(caravan);
        return;
      }
      const remaining = caravan.weeksRemaining - 1;
      // A caravan is ambushed on every week it spends on the road (never on the
      // week it arrives).
      let raidFired = false;
      if (remaining > 0 && pendingRaids.length < raidSlots) {
        const leader = gameState.roster.find(c => (caravan.leaderId ? c.id === caravan.leaderId : c.name === caravan.leaderName));
        const crew = gameState.roster.filter(c => c.assignedVenue === 'trade'
          && c.id !== leader?.id
          && !isOnCaptureOp(c)
          && !restingIds.has(c.id));
        const raid = trySpawnRaid(caravan, leader, leader ? [leader, ...crew] : crew, buildingEffects.escortCrew, {
          riskReduction: buildingEffects.raidRiskReduction,
          victoryBonus: buildingEffects.raidVictoryBonus
        });
        if (raid) {
          raidFired = true;
          pendingRaids.push(raid);
          newLogs.push(`ЗАСАДА НА КАРАВАН: «${caravan.name}» атакован (${raid.enemyName}) на маршруте в ${caravan.destRegion}!`);
        }
      }
      // Weather, hunger or disease can claim a caravan on the road. This is
      // mutually exclusive with an ambush in the same week — a caravan that
      // survived an attack isn't also lost to the elements.
      if (remaining > 0 && !raidFired) {
        const destDanger = dangerForRegion(caravan.destRegion);
        if (Math.random() < destDanger * 0.15) {
          const lossCause = ['погодные условия', 'голод', 'болезни'][Math.floor(Math.random() * 3)];
          newLogs.push(`Караван «${caravan.name}» потерян при ${lossCause} на маршруте в ${caravan.destRegion}! Инвестиции потеряны (-${formatMoney(caravan.investment)}).`);
          updatedCaravans.push({
            ...caravan,
            weeksRemaining: 0,
            raidsTriggered: caravan.raidsTriggered ?? 0,
            status: 'lost',
            endWeek: gameState.week + 1
          });
          return;
        }
      }
      if (remaining <= 0) {
        caravanEarnings += caravan.investment;
        const goodsLot = createGoodsLot(caravan, gameState.week + 1, Math.random, auctionHouseStaff.appraiser);
        newGoodsLots.push(goodsLot);
        newLogs.push(`Караван «${caravan.name}» под командованием ${caravan.leaderName} благополучно прибыл в ${caravan.destRegion}. Инвестиции ${formatMoney(caravan.investment)} возвращены; товарный лот «${goodsLot.productName}» оценён в ${formatMoney(goodsLot.appraisedValue)}.`);
        // The caravan brought back prisoners from the region it travelled out of
        // (the origin region — the lands that "came to us"). These captives are
        // added to the pleasure house roster as unpaid («без работы») labour.
        const originRegionId = regionNameToId(caravan.originRegion) || '03_western_europe';
        for (let i = 0; i < 3; i++) {
          newCaravanPrisoners.push({
            ...generateSlaveCharacter({
              regionId: originRegionId,
              quality: 'medium',
              origin: 'caravan_completion'
            }),
            acquiredWeek: gameState.week + 1,
            assignedVenue: 'unassigned'
          });
        }
        newLogs.push(`Из региона прибыло 3 пленника — обращены в дом удовольствия без работы.`);
        updatedCaravans.push({
          ...caravan,
          weeksRemaining: 0,
          raidsTriggered: caravan.raidsTriggered ?? 0,
          status: 'completed',
          endWeek: gameState.week + 1
        });
      } else {
        updatedCaravans.push({
          ...caravan,
          weeksRemaining: remaining,
          raidsTriggered: (caravan.raidsTriggered ?? 0) + (raidFired ? 1 : 0)
        });
      }
    });

    // Process Contracts
    let contractEarnings = 0;
    const updatedContracts: ClientContract[] = [];
    gameState.contracts.forEach(contract => {
      if (contract.status === 'active') {
        const remaining = contract.weeksRemaining - 1;
        if (remaining <= 0) {
          const assignedIds = contract.assignedOperativeIds || [];
          const assignedOps = assignedIds.map(id => gameState.roster.find(c => c.id === id)).filter(Boolean) as Character[];
          const avgAttractiveness = assignedOps.length > 0
            ? Math.round(assignedOps.reduce((sum, c) => sum + calculateAttractiveness(c), 0) / assignedOps.length)
            : 0;
          const avgSkill = assignedOps.length > 0
            ? Math.round(assignedOps.reduce((sum, c) => sum + c.skill, 0) / assignedOps.length)
            : 0;

          if (assignedOps.length === 0) {
            contractEarnings -= Math.round(contract.rewardFunds * 0.3);
            gameState.reputation = Math.max(0, gameState.reputation - 5);
            newLogs.push(`VIP-контракт «${contract.title}» ПРОВАЛЕН: не назначены оперативники. Штраф: -${formatMoney(Math.round(contract.rewardFunds * 0.3))}, репутация -5.`);
            updatedContracts.push({ ...contract, status: 'failed', failedReason: 'Не назначены оперативники', weeksRemaining: 0 });
          } else if (avgAttractiveness < contract.requiredAttractiveness) {
            const failurePenalty = Math.round(contract.rewardFunds * 0.5);
            contractEarnings -= failurePenalty;
            gameState.reputation = Math.max(0, gameState.reputation - 3);
            newLogs.push(`VIP-контракт «${contract.title}» ПРОВАЛЕН: назначенные оперативники (привлекательность ${avgAttractiveness}) не достигли требуемой ${contract.requiredAttractiveness}. Штраф: -${formatMoney(failurePenalty)}, репутация -3.`);
            updatedContracts.push({ ...contract, status: 'failed', failedReason: `Привлекательность ${avgAttractiveness} ниже требуемой ${contract.requiredAttractiveness}`, weeksRemaining: 0 });
          } else {
            const qualityBonus = Math.min(50, Math.max(0, (avgAttractiveness - contract.requiredAttractiveness) * 0.02 + (avgSkill - 50) * 0.01));
            const qualityMultiplier = 1 + qualityBonus;
            const finalReward = Math.round(contract.rewardFunds * qualityMultiplier);
            const finalRep = Math.round(contract.rewardReputation * qualityMultiplier);
            contractEarnings += finalReward;
            gameState.reputation = Math.min(100, gameState.reputation + finalRep);
            newLogs.push(`VIP-контракт «${contract.title}» от ${contract.clientName} выполнен! Оперативников: ${assignedOps.length} (средняя привлекательность ${avgAttractiveness}, средний навык ${avgSkill}). Награда: ${formatMoney(finalReward)} (+${finalRep} реп.).`);
            updatedContracts.push({ ...contract, status: 'completed', weeksRemaining: 0 });
          }
        } else {
          updatedContracts.push({
            ...contract,
            weeksRemaining: remaining
          });
        }
      } else {
        updatedContracts.push(contract);
      }
    });

    // Spawn new contracts periodically (30% chance each week, max 5 active)
    if (rollChance(0.3) && updatedContracts.filter(c => c.status === 'active').length < 5) {
      const newContract = generateContract();
      updatedContracts.push(newContract);
      newLogs.push(`Предложен новый VIP-контракт: «${newContract.title}» от ${newContract.clientName}. Срок: ${newContract.durationWeeks} нед. Награда: ${formatMoney(newContract.rewardFunds)}.`);
    }

    // Process Slave-purchase contracts (buyers in the marketplace / black market).
    const updatedSlaveContracts: SlaveBuyerContract[] = [];
    (gameState.slaveContracts || []).forEach(contract => {
      if (contract.status !== 'active') {
        updatedSlaveContracts.push(contract);
        return;
      }
      const remaining = contract.weeksRemaining - 1;
      if (remaining <= 0) {
        // Offer expired before it was fulfilled.
        updatedSlaveContracts.push({ ...contract, weeksRemaining: 0, status: 'failed' });
        newLogs.push(`Контракт на пленных «${contract.title}» от ${contract.buyerName} истёк неисполненным (${contract.quantityDelivered}/${contract.quantityWanted} чел. поставлено).`);
      } else {
        updatedSlaveContracts.push({ ...contract, weeksRemaining: remaining });
      }
    });

    // New slave buyers approach the syndicate each week (50% chance on the open
    // market only — the black market channel was replaced by the regional supply
    // contracts below). Order counts are gated by the syndicate's standing with the
    // buyer type, and a buyer locked out by a recent scandal places no new orders.
    const nextWeek = gameState.week + 1;
    const standings: StandingMap = gameState.buyerStandings || {};
    // Улучшения глобального рынка влияют на цены, объёмы, скидки
    // и риски всех контрактов этой недели.
    const marketEffects = marketImprovementEffects(gameState.marketImprovements);

    const trySpawnOffer = (channel: SlaveContractChannel) => {
      const buyerType = 'Private Estate';
      const standingRec = getStanding(standings, buyerType);
      if (isBuyerLocked(standingRec, nextWeek)) {
        newLogs.push(`Покупатель пленных ${buyerType} избегает вашего синдиката на этой неделе (недавний скандал).`);
        return;
      }
      const capForChannel = updatedSlaveContracts.filter(c => c.status === 'active' && c.channel === channel).length;
      const allowed = maxOrdersForStanding(standingRec.reputation);
      if (capForChannel >= allowed) return;
      const offer = generateSlaveContract(channel, standingRec.reputation, marketEffects);
      updatedSlaveContracts.push(offer);
      const tierBadge = offer.demandTier === 'high' ? ' [ВЫСОКИЙ СПРОС]' : offer.demandTier === 'low' ? ' [НИЗКИЙ СПРОС]' : '';
      newLogs.push(`Новый покупатель пленных${tierBadge} на глобальном рынке: ${offer.buyerName} ищет ${offer.quantityWanted} пленных по ${formatMoney(offer.pricePerHead)} за голову.`);
    };
    if (rollChance(0.5)) trySpawnOffer('market');

    // Standing slave-supply offers won by heavy caravan traffic to one region.
    // Each week the week's purchase lot resets and the offer burns one week of its
    // term; when the term runs out the region closes its pens to the syndicate.
    const updatedSupplyContracts: TradeSupplyContract[] = [];
    const completedSupplyRewards: Character[] = [];
    (gameState.tradeSupplyContracts || []).forEach(contract => {
      if (contract.status !== 'active') return;
      const weeksRemaining = contract.weeksRemaining - 1;
      if (weeksRemaining <= 0) {
        newLogs.push(`Поставка рабов из региона ${contract.regionName} закрыта: за срок выкуплено ${contract.totalPurchased ?? 0} чел. на сумму ${formatMoney((contract.totalSpent ?? 0))}.`);
        // Reward: elite (legendary) slaves for fully completing a supply contract.
        const totalPurchased = contract.totalPurchased ?? 0;
        if (totalPurchased > 0) {
          const eliteCount = Math.max(1, Math.floor(totalPurchased / 10) + (contract.quality === 'legendary' ? 1 : 0));
          for (let i = 0; i < eliteCount; i++) {
            completedSupplyRewards.push({
              ...generateSlaveCharacter({
                regionId: contract.regionId,
                quality: 'legendary',
                origin: `supply_contract_completion:${contract.regionId}`
              }),
              acquiredWeek: nextWeek,
              assignedVenue: 'unassigned'
            });
          }
          newLogs.push(`Награда за выполнение контракта: ${eliteCount} элитных рабын(ы) из региона ${contract.regionName} прибыли в дом удовольствия!`);
        }
        return;
      }
      updatedSupplyContracts.push({ ...contract, weeksRemaining, purchasedThisWeek: 0 });
    });

    // A week where 5-15 caravans all arrived in the same region makes that region
    // open a fresh slave-supply offer to the syndicate on the Global Market.
    const supplyTriggers = detectCaravanSupplyTriggers(updatedCaravans);
    supplyTriggers.forEach(flow => {
      const alreadyServed = updatedSupplyContracts.some(c => c.regionId === flow.regionId);
      if (alreadyServed) return;
      const offer = generateTradeSupplyContract(flow, nextWeek, updatedSupplyContracts.length, marketEffects);
      updatedSupplyContracts.push(offer);
      newLogs.push(`ПОСТАВКА ИЗ РЕГИОНА: ${flow.regionName} принял ${flow.caravansDelivered} караванов за неделю и открыл выкуп рабов на глобальном рынке — до ${offer.weeklyQuantity} чел./нед. в течение ${offer.termWeeks} нед. по ${formatMoney(offer.pricePerHead)} за голову.`);
    });

    // Preserve reserved buy-side lots for one weekly refresh, then clear the reservation.
    const reservedLots = (gameState.captiveLots || []).filter(lot => gameState.reservedCaptiveLotIds?.includes(lot.id));
    const updatedLots: CaptiveLotOffer[] = [];
    // Automatic captive lot generation disabled to prevent automatic sales of prisoners.
    updatedLots.push(...reservedLots);

    // Process Beauty Salon Scheduled Treatments
    let salonTreatmentRevenue = 0;
    let suppliesUsedThisWeek = 0;
    const updatedTreatments: ScheduledTreatment[] = [];
    const exhaustionLevel = gameState.exhaustionUpgrades.beauty_salon;
const supplyDiscount = [1.0, 1.0, 0.75, 0.65][exhaustionLevel] ?? 1.0;
    const managerTrait = gameState.beautySalon.managerTraitId
      ? MANAGER_TRAITS.find(t => t.id === gameState.beautySalon.managerTraitId)
      : null;
    const tipBonus = managerTrait?.tipBonus ?? 0;

    gameState.beautySalon.scheduledTreatments.forEach(item => {
      if (item.nextRunWeek <= gameState.week + 1) {
        if (gameState.isReceivership && item.isAutomatic) {
          newLogs.push(`Внешнее управление остановило автоматические процедуры для ${item.characterName}.`);
          return;
        }
        const treatment = TREATMENTS.find(t => t.id === item.treatmentId);
        if (treatment) {
          salonTreatmentRevenue += Math.round(treatment.baseCost * 1.5 * (1 + tipBonus));
          suppliesUsedThisWeek += Math.round(treatment.suppliesConsumed * supplyDiscount);
          newLogs.push(`Процедура салона выполнена: ${treatment.name} для ${item.characterName}.`);
        }
        if (item.isAutomatic) {
          updatedTreatments.push({
            ...item,
            nextRunWeek: gameState.week + 1 + item.intervalWeeks
          });
        }
      } else {
        updatedTreatments.push(item);
      }
    });

// Dynamic Staff Loyalty & Exhaustion reporting
    const updatedRoster = updatedRosterVenues.map(char => {
      if (char.pregnancy?.status === 'hospitalized') return char;
      // In a ward for treatment: no shifts, so no wear and tear either.
      if (hospitalPatientIds.has(char.id)) return char;
      // Resting operatives recover in the rest zone instead of tiring further.
      if (restingIds.has(char.id)) return char;
      const oldExhaustionLevel = char.exhaustionLevel;
      const offDuty = !worksVenue(char.assignedVenue);
      const venueExhaustionBump = char.assignedVenue && char.assignedVenue !== 'trade' ? 8 : 4;
      const venueUpgradeLevel = char.assignedVenue === 'beauty_salon' || char.assignedVenue === 'strip_club' || char.assignedVenue === 'pleasure_house'
        ? gameState.exhaustionUpgrades[char.assignedVenue] ?? 0
        : 0;
      const exhaustReduction = venueUpgradeLevel * 0.15;
      const baseExhaustionBump = Math.round(venueExhaustionBump * (1 - exhaustReduction));
      // Комнаты и алкоголь дома удовольствия дополнительно корректируют нагрузку смены.
      const actualExhaustionBump = char.assignedVenue === 'pleasure_house'
        ? pleasureHouseExhaustionBump(gameState.pleasureHouseUpgrades, baseExhaustionBump)
        : char.assignedVenue === 'strip_club'
          ? stripClubExhaustionBump(gameState.stripClubUpgrades, baseExhaustionBump)
          : baseExhaustionBump;
      // The CEO Office secretary absorbs part of the protagonist's weekly load.
      const leadershipRelief = char.role === 'Chief Executive Officer' ? buildingEffects.leadershipRelief : 0;
      // An operative without a venue works no shifts: they recover instead.
      const exactEx = offDuty
        ? Math.min(100, Math.max(0, char.exactExhaustion - OFF_DUTY_EXHAUSTION_RECOVERY))
        : Math.min(100, Math.max(0, char.exactExhaustion + Math.floor(Math.random() * 10) - 3 - leadershipRelief + (char.assignedVenue !== 'trade' ? actualExhaustionBump : 0)));

      let newExhaustionDesc: 'Rested' | 'Tired' | 'Exhausted' | 'Burned Out' = 'Rested';
      if (exactEx > 75) newExhaustionDesc = 'Burned Out';
      else if (exactEx > 50) newExhaustionDesc = 'Exhausted';
      else if (exactEx > 25) newExhaustionDesc = 'Tired';

      if (oldExhaustionLevel !== newExhaustionDesc) {
        newLogs.push(`Уровень усталости ${char.name} изменился: ${EXHAUSTION_LABELS[oldExhaustionLevel]} → ${EXHAUSTION_LABELS[newExhaustionDesc]}.`);
      }

      // Duty costs health too: the venue sets the price of the week and fatigue
      // makes it worse. The clinic gives some of it back, the rest zone all of
      // it, and once the health falls into the bad range the ward takes over on
      // the following week.
      const oldHealthLevel = char.healthLevel;
      const exactHealth = Math.min(100, Math.max(0, char.exactHealth - weeklyHealthWear(char.assignedVenue, exactEx)));
      const newHealthLevel = healthFromExact(exactHealth);
      if (newHealthLevel !== oldHealthLevel) {
        newLogs.push(`${char.name}: здоровье ${exactHealth} из 100 (${HEALTH_LABELS[newHealthLevel]}).`);
      }

      let loyaltyDelta = 0;
      if (newExhaustionDesc === 'Burned Out') loyaltyDelta -= 5;
      else if (newExhaustionDesc === 'Exhausted') loyaltyDelta -= 2;
      else if (newExhaustionDesc === 'Rested') loyaltyDelta += 1;

      if (char.skinCondition === 'Flawless' || char.skinCondition === 'Clear') loyaltyDelta += 1;
      else loyaltyDelta -= 1;

      const newLoyalty = Math.min(100, Math.max(10, char.loyalty + loyaltyDelta));

      const newTan = Math.max(0, char.tanningLevel - 3);
      let newSkin = char.skinCondition;
      if (worksVenue(char.assignedVenue) && char.assignedVenue !== 'trade' && Math.random() < 0.35) {
        if (newSkin === 'Flawless') newSkin = 'Clear';
        else if (newSkin === 'Clear') newSkin = 'Dry';
        else if (newSkin === 'Dry') newSkin = 'Blemished';
      }

      return {
        ...char,
        tanningLevel: newTan,
        skinCondition: newSkin,
        exactExhaustion: exactEx,
        exhaustionLevel: newExhaustionDesc,
        exactHealth,
        healthLevel: newHealthLevel,
        loyalty: newLoyalty
      };
    });

// Advance pregnancy and company-property graduation once per week. Mothers at
    // term are then admitted to a bed and delivered by the hospital itself.
    const busyCharacterIds = gameState.roster.filter(isOnCaptureOp).map(c => c.id);
    const restWeek = advanceRestZoneWeek(
      gameState.restZone,
      updatedRoster,
      gameState.employees.filter(employee => gameState.restZone.attendantIds.includes(employee.id)),
      { hospitalPatientIds: Array.from(hospitalPatientIds), busyCharacterIds },
      gameState.week + 1
    );
    newLogs.push(...restWeek.logs);

    const pregnancyWeek = advancePregnancyWeek(
      gameState.roster,
      restWeek.roster,
      gameState.dependents || [],
      gameState.week + 1
    );
    newLogs.push(...pregnancyWeek.logs);

    const hospitalWeek = advanceHospitalWeek(
      pregnancyWeek.roster,
      pregnancyWeek.dependents,
      gameState.hospital,
      {
        week: gameState.week + 1,
        hospitalLevel,
        staff: hospitalStaff,
        restingCharacterIds: restingIds,
        onNotify: pushHospitalNotice
      }
    );
newLogs.push(...hospitalWeek.logs);

// The psychologist reviews the roster after the ward has taken its own cases, so
    // whoever the hospital already put to bed or the rest zone already took is not
    // judged again the same week.
    const psychologistWeek = advancePsychologistWeek({
      week: gameState.week + 1,
      roster: hospitalWeek.roster,
      hospital: hospitalWeek.hospital,
      restZone: restWeek.state,
      psychologists: hospitalPsychologistsOnDuty,
      staff: hospitalStaff,
      busyCharacterIds,
      onNotify: pushHospitalNotice
    });
    newLogs.push(...psychologistWeek.logs);
    // Operatives the psychologist just put on a rest programme are off the floor
    // too, so they neither guard the holding nor tire any further this week.
    const restingAfterPsychology = new Set([
      ...restingIds,
      ...psychologistWeek.restZone.placements.map(placement => placement.characterId)
    ]);

// Apply clinic effects only while a compatible clinician is assigned.
    const clinicAdjustedRoster = applyClinicRecovery(psychologistWeek.roster, buildingEffects.rosterHealthRecovery);
    // The BDSM Room works the house's captives: a posted госпожа/мастер raise
    // submission before the unrest roll, so trained slaves are less likely to run.
    const bdsmTraining = buildingEffects.bdsmTraining;
    const trainedRoster = bdsmTraining > 0
      ? clinicAdjustedRoster.map(c => applyBdsmTraining(c, bdsmTraining))
      : clinicAdjustedRoster;
    const trainedSlaves = trainedRoster.filter(c => c.isSlave);
    const unrest = assessSlaveUnrest(trainedSlaves, trainedRoster);
const guardsOnDuty = trainedRoster.filter(c => !c.isSlave && c.assignedVenue === 'trade' && !restingAfterPsychology.has(c.id)).length;
    // Roster trade operatives each shave 8 points of escape risk, capped at 45%
    // left; hired guards at the Guard Post shave a further 8 points each, and the
    // BDSM Room's disciplinarian takes off its own percentage points.
    const bdsmEscapeReduction = buildingEffects.bdsmEscapeReduction * 0.01;
    const securityFactor = Math.max(0.45, 1 - guardsOnDuty * 0.08 - buildingEffects.guardStrength * 0.08 - bdsmEscapeReduction);
    // Captives on a rest program are off the floor entirely, so they neither
    // guard the holding nor slip out of it mid-stay.
    const escapedIds = rollSlaveEscapes(trainedSlaves.filter(c => !restingAfterPsychology.has(c.id)), unrest.escapeChance, securityFactor);
    let rosterAfterEscapes = trainedRoster;
    if (escapedIds.length > 0) {
      const escapedNames = trainedSlaves.filter(c => escapedIds.includes(c.id)).map(c => c.name);
      const lostEarnings = trainedSlaves
        .filter(c => escapedIds.includes(c.id))
        .reduce((sum, c) => sum + (c.pleasureStats?.totalEarnings || 0), 0);
      rosterAfterEscapes = trainedRoster.filter(c => !escapedIds.includes(c.id));
      newLogs.push(`БЕСПОРЯДКИ СРЕДИ ПЛЕННЫХ: на этой неделе сбежали пленные — ${escapedNames.length} чел. (${escapedNames.join(', ')}). Потеряно за всё время ${formatMoney(lostEarnings)} заработка, репутация снижена.`);
    }
    if (bdsmTraining > 0 && trainedSlaves.length > 0) {
      newLogs.push(`БДСМ-КОМНАТА: госпожа и мастер провели неделю с рабынями дома удовольствия — покорность +${bdsmTraining}, риск побега снижен на ${buildingEffects.bdsmEscapeReduction} п.п.`);
    }

    // Operatives that came back from a botched snatch are exhausted, and the
    // squad that was wiped out never returns.
    const rosterAfterCaptureOps = [
      ...rosterAfterEscapes
        .filter(c => !lostSquadIds.has(c.id))
        .map(clearCaptureTask)
        .map(c => woundedSquadIds.has(c.id)
          ? { ...c, exactExhaustion: Math.min(100, c.exactExhaustion + 30), loyalty: Math.max(10, c.loyalty - 5) }
          : c),
      // A captured target joins the roster as a single prisoner from the region the
      // squad travelled to — in the pleasure house «без работы» until assigned.
      ...seizedTargets.map(target => ({
        ...target,
        acquiredWeek: gameState.week + 1,
        assignedVenue: 'unassigned' as const
      })),
      // Prisoners returned by a successful caravan are added to the pleasure house
      // roster — unpaid («без работы») until the player assigns them a venue.
      ...newCaravanPrisoners,
      // Elite slaves rewarded for completing supply contracts.
      ...completedSupplyRewards
    ];

const restZoneUpkeep = restZoneWeeklyUpkeep(gameState.restZone);
    const staffSlotUpkeep = hiringSlotUpkeep(gameState.hiringSlots);
    // Prestige (New Game+) grants a permanent revenue bonus per level.
    const prestigeMultiplier = prestigeRevenueMultiplier(gameState.metaProgress?.prestige.level ?? 0);
    if (prestigeMultiplier > 1) {
      venueRevenue = Math.floor(venueRevenue * prestigeMultiplier);
      caravanEarnings = Math.floor(caravanEarnings * prestigeMultiplier);
      captureFundsDelta.total = Math.floor(captureFundsDelta.total * prestigeMultiplier);
      contractEarnings = Math.floor(contractEarnings * prestigeMultiplier);
      salonTreatmentRevenue = Math.floor(salonTreatmentRevenue * prestigeMultiplier);
    }
    const netIncome = venueRevenue + caravanEarnings + captureFundsDelta.total + contractEarnings + salonTreatmentRevenue - employeeWeek.wagesPaid - hospitalWeek.upkeep - restZoneUpkeep - staffSlotUpkeep;
    currentFunds += netIncome;
if (employeeWeek.wagesPaid > 0) newLogs.push(`Выплачена зарплата сотрудникам: ${formatMoney(employeeWeek.wagesPaid)}.`);
    if (hospitalWeek.upkeep > 0) newLogs.push(`Содержание палат больницы: -${formatMoney(hospitalWeek.upkeep)}.`);
    if (restZoneUpkeep > 0) newLogs.push(`Содержание зоны отдыха: -${formatMoney(restZoneUpkeep)}.`);
    if (staffSlotUpkeep > 0) newLogs.push(`Содержание дополнительных мест в штате: -${formatMoney(staffSlotUpkeep)}.`);
    newLogs.push(...employeeWeek.logs);
    if (employeeWeek.renewedContracts > 0) newLogs.push(`Продлено контрактов по лояльности: ${employeeWeek.renewedContracts}.`);
    if (employeeWeek.expiredContracts > 0) newLogs.push(`Расторгнуто контрактов из-за низкой морали: ${employeeWeek.expiredContracts}.`);
    if (buildingEffects.rosterHealthRecovery > 0) newLogs.push(`Клиника восстановила сотрудникам компании до ${buildingEffects.rosterHealthRecovery} здоровья.`);

    // --- BANKRUPTCY PROCEDURE: advance a filed case by one week ---
    // A case charges weekly lawyer/manager fees, may freeze loan payments
    // (moratorium) and, once its term elapses, restructures the debt and
    // releases the syndicate from bankruptcy.
    let updatedBankruptcyCase = gameState.bankruptcyCase ?? null;
    let bankruptcyWeeklyFee = 0;
    let bankruptcyMoratorium = false;
    let bankruptcyResolved = false;
    let bankruptcyHaircut = 0;
    let bankruptcyRepPenalty = 0;
    if (updatedBankruptcyCase && updatedBankruptcyCase.status === 'active') {
      const bankruptcyResult = advanceBankruptcyWeek(updatedBankruptcyCase);
      updatedBankruptcyCase = bankruptcyResult.updatedCase;
      bankruptcyWeeklyFee = bankruptcyResult.weeklyFee;
      bankruptcyMoratorium = bankruptcyResult.loanMoratorium;
      bankruptcyResolved = bankruptcyResult.resolved;
      bankruptcyHaircut = bankruptcyResult.debtHaircut;
      bankruptcyRepPenalty = bankruptcyResult.reputationPenalty;
      newLogs.push(...bankruptcyResult.logs);
      if (bankruptcyWeeklyFee > 0) {
        currentFunds -= bankruptcyWeeklyFee;
      }
    }

    // Process loan repayment
    let updatedLoan = gameState.activeLoan;
    let loanPayment = 0;
    if (updatedLoan && bankruptcyMoratorium) {
      newLogs.push(`МОРАТОРИЙ: платёж по кредиту приостановлен на время процедуры банкротства. Остаток долга: ${formatMoney(updatedLoan.remainingPrincipal)}.`);
    } else if (updatedLoan) {
      loanPayment = Math.min(updatedLoan.weeklyPayment, updatedLoan.remainingPrincipal);
      currentFunds -= loanPayment;
      const newPrincipal = Math.max(0, updatedLoan.remainingPrincipal - loanPayment);
      const newWeeksPaid = updatedLoan.weeksPaid + 1;
      if (newPrincipal <= 0) {
        const repaidAmount = updatedLoan.amount;
        updatedLoan = null;
        newLogs.push(`Кредит на ${formatMoney(repaidAmount)} полностью погашен после ${newWeeksPaid} еженедельных платежей.`);
        showNotify('Кредит полностью погашен!');
      } else {
        updatedLoan = { ...updatedLoan, remainingPrincipal: newPrincipal, weeksPaid: newWeeksPaid };
        newLogs.push(`Списан платёж по кредиту ${formatMoney(loanPayment)} (неделя ${newWeeksPaid}/${updatedLoan.termWeeks}). Остаток долга: ${formatMoney(newPrincipal)}.`);
      }
    }

    let isBankrupt = gameState.isBankrupt;
    let isReceivership = gameState.isReceivership;
    if (currentFunds < 0 && !isBankrupt) {
      isBankrupt = true;
      isReceivership = true;
      newLogs.push('ВНИМАНИЕ: компания объявила банкротство и перешла под внешнее управление! Очереди процедур очищены.');
      updatedTreatments.length = 0;
      showNotify('Объявлено банкротство! Компания под внешним управлением.');
    }

    // A bankruptcy case that ran its term restructures the debt and
    // releases the syndicate from bankruptcy back to the board's control.
    if (bankruptcyResolved) {
      if (updatedLoan) {
        const forgivenAmount = Math.round(updatedLoan.remainingPrincipal * bankruptcyHaircut);
        const restructuredPrincipal = updatedLoan.remainingPrincipal - forgivenAmount;
        if (restructuredPrincipal <= 0) {
          newLogs.push(`Долг по кредиту полностью списан в рамках процедуры банкротства (${formatMoney(updatedLoan.remainingPrincipal)}).`);
          updatedLoan = null;
        } else {
          const remainingTerm = Math.max(1, updatedLoan.termWeeks - updatedLoan.weeksPaid);
          updatedLoan = {
            ...updatedLoan,
            remainingPrincipal: restructuredPrincipal,
            weeklyPayment: Math.ceil(restructuredPrincipal / remainingTerm)
          };
          newLogs.push(`ДОЛГ РЕСТРУКТУРИРОВАН: списано ${formatMoney(forgivenAmount)} (${Math.round(bankruptcyHaircut * 100)}%). Новый остаток: ${formatMoney(restructuredPrincipal)}, платёж ${formatMoney(updatedLoan.weeklyPayment)}/нед.`);
        }
      } else {
        newLogs.push('Процедура банкротства завершена: активных займов для реструктуризации нет.');
      }
      isBankrupt = false;
      isReceivership = false;
      showNotify('Процедура банкротства завершена — синдикат выходит из кризиса.');
    }

    // A slave escape damages the syndicate's public standing.
    const escapeRepPenalty = escapedIds.length > 0 ? Math.min(6, escapedIds.length * 2) : 0;

    // Full financial report for the week: every income and expense line the
    // syndicate logged, kept in the save so the Finance & Loans tab can show
    // it in its notifications panel.
    const totalRevenue = venueRevenue + caravanEarnings + captureFundsDelta.total + contractEarnings + salonTreatmentRevenue;
    const totalExpenses = employeeWeek.wagesPaid + hospitalWeek.upkeep + restZoneUpkeep + staffSlotUpkeep;
    const weeklyReport: WeeklyFinanceReport = {
      week: gameState.week + 1,
      revenue: {
        venue: venueRevenue,
        caravans: caravanEarnings,
        captureOps: captureFundsDelta.total,
        contracts: contractEarnings,
        salon: salonTreatmentRevenue
      },
      expenses: {
        wages: employeeWeek.wagesPaid,
        hospital: hospitalWeek.upkeep,
        restZone: restZoneUpkeep,
        staffSlots: staffSlotUpkeep,
        loanPayment
      },
      netIncome,
      treasuryAfter: currentFunds
    };
    newLogs.push(`ОТЧЕТ ЗА НЕДЕЛЮ ${gameState.week + 1}: доходы +${formatMoney(totalRevenue)} · расходы -${formatMoney(totalExpenses)}${loanPayment > 0 ? ` · платёж по кредиту -${formatMoney(loanPayment)}` : ''} · чистый доход ${formatMoney(netIncome)} · казна ${formatMoney(currentFunds)}.`);

    // --- META-PROGRESS: lifetime stats, achievements, campaign goal ---
    const nextWeekNumber = gameState.week + 1;
    const nextReputation = Math.min(100, Math.max(0, gameState.reputation - escapeRepPenalty + captureReputationDelta.total - bankruptcyRepPenalty));
    const nextSnapshot = buildSnapshot({
      week: nextWeekNumber,
      funds: currentFunds,
      reputation: nextReputation,
      isBankrupt,
      roster: rosterAfterCaptureOps,
      employees: employeeWeek.employees,
      auxiliaryBuildings: gameState.auxiliaryBuildings,
      dependents: hospitalWeek.dependents
    });
    const prevCaravanById = new Map(gameState.caravans.map(caravan => [caravan.id, caravan]));
    const statsDelta = {
      caravansCompleted: updatedCaravans.filter(c => c.status === 'completed' && prevCaravanById.get(c.id)?.status === 'traveling').length,
      caravansLost: updatedCaravans.filter(c => (c.status === 'lost' || c.status === 'raided') && prevCaravanById.get(c.id)?.status === 'traveling').length,
      raidsSurvived: updatedCaravans.filter(c => c.status === 'completed' && (c.raidsTriggered ?? 0) > 0 && prevCaravanById.get(c.id)?.status === 'traveling').length,
      captureOpsCompleted: updatedCaptureOps.filter(op => op.status === 'completed' && gameState.captureOperations.find(prevOp => prevOp.id === op.id)?.status === 'outbound').length,
      slavesAcquired: Math.max(0, rosterAfterCaptureOps.filter(c => c.isSlave === true).length - gameState.roster.filter(c => c.isSlave === true).length),
      employeesHired: Math.max(0, employeeWeek.employees.length - gameState.employees.length),
      births: Math.max(0, hospitalWeek.dependents.length - (gameState.dependents?.length ?? 0))
    };
    let nextMetaProgress = applyWeeklyStats(gameState.metaProgress, weeklyReport, statsDelta);
    const goalStatus = checkCampaignGoal(nextSnapshot, nextMetaProgress);
    nextMetaProgress = {
      ...nextMetaProgress,
      goalStatus,
      endingWeek: goalStatus !== 'ongoing' && nextMetaProgress.endingWeek === null ? nextWeekNumber : nextMetaProgress.endingWeek
    };
    const achievementEvaluation = evaluateAchievements(nextMetaProgress, nextSnapshot);
    nextMetaProgress = { ...nextMetaProgress, achievements: achievementEvaluation.achievements };
    for (const achievementId of achievementEvaluation.newlyUnlocked) {
      newLogs.push(`🏆 Достижение открыто: «${ACHIEVEMENT_BY_ID[achievementId].title}» — ${ACHIEVEMENT_BY_ID[achievementId].description}.`);
    }

    // Global marketplace restock: reserved candidates keep their
    // slots for one refresh, everything else is replaced.
    const marketRefresh = triggerWeeklyMarketRefresh(
      gameState.marketPool || [],
      gameState.reservedMarketCharacterIds || []
    );
    if (marketRefresh.triggered) {
      newLogs.push(marketRefresh.message);
    }

    // Demand Decay: gradually reduce regional demand back to 1.0
    const nextMarketDemand = { ...gameState.marketDemand };
    for (const regionId in nextMarketDemand) {
      nextMarketDemand[regionId] = Math.max(1, nextMarketDemand[regionId] - 0.02);
    }


    setGameState(prev => ({
      ...prev,
      week: prev.week + 1,
      funds: currentFunds,
      isBankrupt,
      isReceivership,
      bankruptcyCase: updatedBankruptcyCase,
      activeLoan: updatedLoan,
      lastWeeklyReport: weeklyReport,
      weeklyReports: [...(prev.weeklyReports || []), weeklyReport].slice(-104),
      metaProgress: nextMetaProgress,
      reputation: nextReputation,
      roster: rosterAfterCaptureOps,
      dependents: hospitalWeek.dependents,
      auctionHouse: {
        ...prev.auctionHouse,
        pendingLots: [...newGoodsLots, ...prev.auctionHouse.pendingLots]
      },
      employees: employeeWeek.employees,
      auxiliaryBuildings: prev.auxiliaryBuildings.map(building => ({
        ...building,
        assignedEmployeeIds: building.assignedEmployeeIds.map(id =>
          id && employeeWeek.expiredEmployeeIds.includes(id) ? null : id
        )
      })),
      employeeCandidates: ensureEmployeeCandidatesForVacancies(
        refreshEmployeeCandidates(
          prev.employeeCandidates,
          prev.week + 1,
          undefined,
          getVacantSpecialties(
            prev.auxiliaryBuildings,
            employeeWeek.employees,
            restWeek.state.attendantIds,
            recommendedAttendantCount(restWeek.state.seats)
          )
        ),
        getVacantSpecialties(
          prev.auxiliaryBuildings,
          employeeWeek.employees,
          restWeek.state.attendantIds,
          recommendedAttendantCount(restWeek.state.seats)
        ),
        prev.week + 1
      ),
      // Keep reserved candidates for one weekly refresh, then reset the reservation list.
      marketPool: marketRefresh.pool,
       reservedMarketCharacterIds: [],
       marketDemand: nextMarketDemand,
       caravans: updatedCaravans.filter(c => {

         if (c.status === 'traveling') return true;
         if (c.endWeek === undefined) return true;
         return (prev.week + 1) - c.endWeek < 3;
       }),
      // Keep a short history of finished operations so the player can read the outcome.
      captureOperations: updatedCaptureOps.slice(-6),
      hospital: psychologistWeek.hospital,
      restZone: {
        ...psychologistWeek.restZone,
        attendantIds: psychologistWeek.restZone.attendantIds.filter(
          id => !employeeWeek.expiredEmployeeIds.includes(id)
        )
      },
      contracts: updatedContracts.filter(c => c.status === 'active'),
      slaveContracts: updatedSlaveContracts.filter(c => c.status === 'active'),
      tradeSupplyContracts: updatedSupplyContracts.filter(c => c.status === 'active'),
      captiveLots: updatedLots,
      reservedCaptiveLotIds: [],
       beautySalon: {
         ...prev.beautySalon,
         supplies: Math.max(0, prev.beautySalon.supplies - suppliesUsedThisWeek + prev.beautySalon.level * 20),
         scheduledTreatments: updatedTreatments,
         totalRevenue: prev.beautySalon.totalRevenue + salonTreatmentRevenue
       },
        log: [...newLogs, ...prev.log].slice(0, 50),
        // Администраторы площадок выносят новые запросы и предложения
        // с учётом только что подсчитанных доходов и расходов.
        venueRequests: generateVenueRequests({
          week: nextWeekNumber,
          funds: currentFunds,
          venueCapacity: prev.venueCapacity,
          lastWeeklyReport: weeklyReport,
          pleasureHouseUpgrades: prev.pleasureHouseUpgrades,
          stripClubUpgrades: prev.stripClubUpgrades,
          beautySalon: prev.beautySalon,
          employees: employeeWeek.employees,
          auxiliaryBuildings: prev.auxiliaryBuildings,
          roster: rosterAfterCaptureOps,
          restZone: psychologistWeek.restZone
        }),
        // Администратор аукционного дома и финансист рынка выносят
        // предложение по улучшению глобального рынка — с учётом
        // только что подсчитанных доходов и расходов.
        marketImprovements: prev.marketImprovements,
        marketRequest: generateMarketImprovementRequest({
          week: nextWeekNumber,
          funds: currentFunds,
          marketImprovements: prev.marketImprovements,
          lastWeeklyReport: weeklyReport
        })
      }));

    // Meta-progress side effects: records board, leaderboard and endings.
    const recordsThisWeek = updateGameRecords(gameRecords, nextSnapshot, gameState.campaignName);
    setGameRecords(recordsThisWeek);
    saveGameRecords(recordsThisWeek);
    if (achievementEvaluation.newlyUnlocked.length > 0) {
      const firstAchievement = ACHIEVEMENT_BY_ID[achievementEvaluation.newlyUnlocked[0]];
      showNotify(`🏆 Достижение: «${firstAchievement.title}»${achievementEvaluation.newlyUnlocked.length > 1 ? ` (+${achievementEvaluation.newlyUnlocked.length - 1})` : ''}`);
    }
    if (goalStatus !== 'ongoing' && gameState.metaProgress.goalStatus === 'ongoing') {
      setCampaignEnding({ type: goalStatus, week: nextWeekNumber });
      const nextLeaderboard = recordCampaignResult(leaderboard, {
        campaignName: gameState.campaignName,
        result: goalStatus,
        week: nextWeekNumber,
        peakFunds: Math.max(nextMetaProgress.stats.peakFunds, currentFunds),
        totalRevenue: nextMetaProgress.stats.totalRevenue,
        prestigeLevel: nextMetaProgress.prestige.level,
        date: new Date().toLocaleString()
      });
      setLeaderboard(nextLeaderboard);
      saveLeaderboard(nextLeaderboard);
      const finalRecords = {
        ...recordsThisWeek,
        campaignsCompleted: recordsThisWeek.campaignsCompleted + 1,
        campaignsWon: recordsThisWeek.campaignsWon + (goalStatus === 'victory' ? 1 : 0)
      };
      setGameRecords(finalRecords);
      saveGameRecords(finalRecords);
    }

// Ambushes take priority; on every fourth week preserve the existing auction.
    if (pendingRaids.length > 0) {
      enqueueRaids(pendingRaids);
    } else if (rollChance(0.35)) {
      const nextWeek = gameState.week + 1;
      if (nextWeek % 4 === 0) {
        setActiveEvent(getRandomEventWithAuction(nextWeek));
      } else {
        const expansionEvent = chooseExpansionEvent({
          week: nextWeek,
          funds: currentFunds,
          employees: employeeWeek.employees,
          auxiliaryBuildings: gameState.auxiliaryBuildings
        }, gameState.seenExpansionEventIds);
        if (expansionEvent && rollChance(0.65)) setActiveEvent(expansionEvent);
        else setActiveEvent(getRandomEventWithAuction(nextWeek));
      }
    }


    const loanNote = loanPayment > 0 ? ` — Кредит: -${formatMoney(loanPayment)}` : '';
    showNotify(`Наступила неделя ${gameState.week + 1}. Чистый доход: ${formatMoney(netIncome)}${loanNote}`);
  };

  const buyMarketSlave = (character: Character) => {
    if (gameState.funds < character.price) {
      showNotify('Недостаточно средств для покупки этого пленного.');
      return;
    }
    
    const { nextDemand, nextStanding } = updateRegionalMarketAfterPurchase(
      gameState.marketDemand || {}, 
      gameState.regionalStanding || {}, 
      character.region
    );

    // A bought operative joins the company without a venue: the player posts
    // them personally, so they earn nothing and tire nothing until then.
    const slave: Character = {
      ...character,
      isSlave: true,
      slaveOrigin: `global_market:${character.region}`,
      assignedVenue: 'unassigned',
      acquiredWeek: gameState.week
    };
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - character.price,
      roster: [...prev.roster, slave],
      marketDemand: nextDemand,
      regionalStanding: nextStanding,
      // Mark the listing as acquired so the next weekly refresh replaces it.
      marketPool: prev.marketPool.map(candidate => candidate.id === character.id ? { ...candidate, acquired: true } : candidate),
      reservedMarketCharacterIds: (prev.reservedMarketCharacterIds || []).filter(id => id !== character.id),
      log: [`Куплен пленный ${character.name} из региона ${character.regionName} за ${formatMoney(character.price)}. Влияние в регионе выросло.`, ...prev.log]
    }));
    showNotify(`Пленный ${character.name} куплен!`);
  };

  const toggleMarketReservation = (characterId: string) => {
    const candidate = gameState.marketPool.find(character => character.id === characterId && !character.acquired);
    if (!candidate) return;
    const wasReserved = gameState.reservedMarketCharacterIds?.includes(characterId) ?? false;
    setGameState(prev => {
      const currentIds = prev.reservedMarketCharacterIds || [];
      const reservedMarketCharacterIds = wasReserved
        ? currentIds.filter(id => id !== characterId)
        : [...currentIds, characterId];
      return {
        ...prev,
        reservedMarketCharacterIds,
log: [`Кандидат на рынке ${candidate.name} ${wasReserved ? 'снят с брони' : 'зарезервирован до следующей недели'}.`, ...prev.log].slice(0, 50)
      };
    });
    showNotify(wasReserved ? 'Бронирование кандидата отменено.' : 'Кандидат зарезервирован до следующего еженедельного обновления.');
  };

  const launchCaravan = () => {
    if (investment <= 0 || gameState.funds < investment) {
      showNotify('Неверная сумма инвестиций или недостаточно средств в казне!');
      return;
    }
    const leader = gameState.roster.find(c => c.id === selectedLeaderId);
    const leaderName = leader ? leader.name : 'Оперативник синдиката';
    const profit = Math.floor(investment * (0.8 + Math.random() * 0.6));

    const newCaravan: Caravan = {
      id: 'caravan_' + Math.random().toString(36).substring(2, 9),
      name: caravanName,
      originRegion: 'Западная Европа и Скандинавия',
      destRegion,
      leaderName,
      leaderId: leader?.id,
      investment,
      potentialProfit: profit,
      weeksTotal: 3,
      weeksRemaining: 3,
      status: 'traveling',
      raidsTriggered: 0,
      dispatchedWeek: gameState.week
    };

    setGameState(prev => ({
      ...prev,
      funds: prev.funds - investment,
      caravans: [newCaravan, ...prev.caravans],
      metaProgress: registerCaravanDispatched(prev.metaProgress),
      log: [`Караван «${caravanName}» отправлен в ${destRegion} с инвестициями ${formatMoney(investment)}.`, ...prev.log]
    }));
    const nextMatch = caravanName.match(/(№|#)(\d+)/);
    if (nextMatch) {
      const nextNum = parseInt(nextMatch[2], 10) + 1;
      setCaravanName(caravanName.replace(nextMatch[0], `${nextMatch[1]}${nextNum}`));
    }
    showNotify('Торговый караван успешно отправлен!');
  };

  /**
   * Sends a hand-picked squad after a named target. The squad leaves the
   * syndicate for the whole operation (no venue income), is ambushed on the
   * road and can be lost entirely if the snatch goes wrong.
   */
  const launchCaptureOperation = () => {
    if ((gameState.captureOperations || []).filter(op => op.status === 'outbound').length >= MAX_ACTIVE_CAPTURE_OPS) {
      showNotify('Слишком много отрядов в поле. Дождитесь возвращения текущих.');
      return;
    }
    const squad = captureSquadIds
      .map(id => gameState.roster.find(c => c.id === id))
      .filter((c): c is Character => Boolean(c) && !isOnCaptureOp(c as Character));
    if (squad.length < MIN_CAPTURE_SQUAD) {
      showNotify(`Выберите отряд из ${MIN_CAPTURE_SQUAD}–${MAX_CAPTURE_SQUAD} оперативников.`);
      return;
    }
    if (captureBudget <= 0 || gameState.funds < captureBudget) {
      showNotify('Недостаточно средств для финансирования операции!');
      return;
    }
    const region = REGIONS.find(r => r.id === captureRegionId);
    if (!region) return;

    const operation = createCaptureOperation({
      codename: captureCodename.trim() || generateCodename((gameState.captureOperations || []).map(op => op.codename)),
      targetRegionId: region.id,
      targetRegionName: region.name,
      targetQuality: captureQuality,
      budget: captureBudget,
      squad
    });

    setGameState(prev => ({
      ...prev,
      funds: prev.funds - operation.upfrontCost,
      // Flag the squad as away so they earn nothing and cannot be redeployed.
      roster: prev.roster.map(c => operation.squadIds.includes(c.id)
        ? { ...c, assignedTask: captureTaskId(operation.id) }
        : c),
      captureOperations: [operation, ...prev.captureOperations],
      log: [
        `Операция захвата «${operation.codename}» отправлена: отряд из ${operation.squadSize} чел. выдвинут на ${operation.targetName} в регионе ${operation.targetRegionName}. Бюджет -${formatMoney(operation.upfrontCost)}, награда ${formatMoney(operation.bounty)}, шанс захвата ${operation.captureChance}%.`,
        ...prev.log
      ]
    }));
    setCaptureSquadIds([]);
    setCaptureCodename(generateCodename([...(gameState.captureOperations || []).map(op => op.codename), operation.codename]));
    showNotify(`«${operation.codename}» вышла на цель. Шанс захвата ${operation.captureChance}%.`);
  };

  const toggleCaptureSquadMember = (characterId: string) => {
    setCaptureSquadIds(prev => {
      if (prev.includes(characterId)) return prev.filter(id => id !== characterId);
      if (prev.length >= MAX_CAPTURE_SQUAD) return prev;
      // The squad is ordered: whoever is picked first commands it.
      return [...prev, characterId];
    });
  };

  /** Black-market purchase of permanent ward capacity. */
  const buyHospitalWard = (wardId: HospitalWardId, quantityOverride?: number) => {
    const quantity = quantityOverride ?? Math.max(1, Math.floor(hospitalWardQty[wardId] || 1));
    const quote = quoteWards(wardId, quantity, gameState.funds, hospitalLevel);
    if (quote.locked || !quote.affordable) {
      showNotify(quote.locked ? quote.lockReason : 'Недостаточно средств для закупки через чёрный рынок.');
      return;
    }
    const interception = rollInterception(quote.total);
    const ward = getWardDefinition(wardId);
    const note = interception.intercepted
      ? ` (партия перехвачена: потери ${formatMoney(interception.loss)}, −${INTERCEPTION_REPUTATION_PENALTY} репутации)`
      : '';
    const entry = `Чёрный рынок: закуплено ${quantity} шт. «${ward?.name}» за ${formatMoney(quote.total)}${note}.`;
    setGameState(prev => {
      const wardCounts = { ...prev.hospital.wardCounts };
      wardCounts[wardId] = (wardCounts[wardId] || 0) + quantity;
      return {
        ...prev,
        funds: prev.funds - quote.total - interception.loss,
        reputation: Math.min(100, Math.max(0, prev.reputation - (interception.intercepted ? INTERCEPTION_REPUTATION_PENALTY : 0))),
        hospital: {
          ...prev.hospital,
          wardCounts,
          ledger: [hospitalLedgerEntry(prev.week, entry, 'purchase'), ...prev.hospital.ledger].slice(0, 12)
        },
        log: [`Больница: закуплено ${quantity} шт. «${ward?.name}» за ${formatMoney(quote.total)}${note}.`, ...prev.log].slice(0, 50)
      };
    });
    setHospitalWardQty(prev => ({ ...prev, [wardId]: 1 }));
    showNotify(interception.intercepted
      ? `Партия перехвачена: −${formatMoney(interception.loss)} сверх оплаты.`
      : `Куплено ${quantity} шт. «${ward?.name}».`);
  };

  /** Black-market purchase of consumable medical gear, bought by the unit. */
  const buyHospitalEquipment = (itemId: HospitalEquipmentId, quantityOverride?: number) => {
    const quantity = quantityOverride ?? Math.max(1, Math.floor(hospitalEquipQty[itemId] || 1));
    const quote = quoteEquipment(itemId, quantity, gameState.funds);
    if (!quote.affordable) {
      showNotify('Недостаточно средств для закупки через чёрный рынок.');
      return;
    }
    const interception = rollInterception(quote.total);
    const item = HOSPITAL_EQUIPMENT.find(entry => entry.id === itemId);
    const note = interception.intercepted
      ? ` (партия перехвачена: потери ${formatMoney(interception.loss)}, −${INTERCEPTION_REPUTATION_PENALTY} репутации)`
      : '';
    const entry = `Чёрный рынок: закуплено ${quantity} шт. «${item?.name}» за ${formatMoney(quote.total)}${note}.`;
    setGameState(prev => {
      const equipment = { ...prev.hospital.equipment };
      equipment[itemId] = (equipment[itemId] || 0) + quantity;
      return {
        ...prev,
        funds: prev.funds - quote.total - interception.loss,
        reputation: Math.min(100, Math.max(0, prev.reputation - (interception.intercepted ? INTERCEPTION_REPUTATION_PENALTY : 0))),
        hospital: {
          ...prev.hospital,
          equipment,
          ledger: [hospitalLedgerEntry(prev.week, entry, 'purchase'), ...prev.hospital.ledger].slice(0, 12)
        },
        log: [`Больница: закуплено ${quantity} шт. «${item?.name}» за ${formatMoney(quote.total)}${note}.`, ...prev.log].slice(0, 50)
      };
    });
    if (quantityOverride === undefined) setHospitalEquipQty(prev => ({ ...prev, [itemId]: 1 }));
    showNotify(`Закуплено ${quantity} шт. «${item?.name}».`);
  };

  const CAPTURE_QUALITY_LABELS: Record<CaptureTargetQuality, string> = {
    low: 'Простой человек',
    medium: 'Местный чиновник',
    high: 'Известная персона',
    elite: 'Элита'
  };

  const CAPTURE_STATUS_LABELS: Record<CaptureOperation['status'], string> = {
    outbound: 'в пути',
    completed: 'цель захвачена',
    failed: 'провал',
    lost: 'отряд уничтожен'
  };

  const captureOperations = gameState.captureOperations || [];
  const availableCaptureOperatives = gameState.roster.filter(c => !isOnCaptureOp(c));
  const captureSquad = captureSquadIds
    .map(id => gameState.roster.find(c => c.id === id))
    .filter((c): c is Character => Boolean(c));
  const captureRegion = REGIONS.find(r => r.id === captureRegionId);
  const captureSquadAvgSkill = captureSquad.length > 0
    ? Math.round(captureSquad.reduce((sum, c) => sum + c.skill, 0) / captureSquad.length)
    : 0;
  const buildingPreviewEffects = calculateBuildingWeeklyEffects(gameState.auxiliaryBuildings, gameState.employees);
  const capturePreviewSnatchChance = captureChanceFor(captureQuality, captureSquad, captureRegionId, captureBudget);
  const capturePreviewAmbushChance = raidChanceForRoute(captureRegion?.name ?? '', captureSquadAvgSkill, buildingPreviewEffects.raidRiskReduction, 'capture');
  const capturePreviewBounty = recommendedBudget(captureQuality, captureRegionId);
  const activeCaptureCount = captureOperations.filter(op => op.status === 'outbound').length;

  const hospital = gameState.hospital;
  const hospitalLevel = gameState.auxiliaryBuildings.find(b => b.id === 'hospital')?.level ?? 0;
  const hospitalNurses = gameState.employees.filter(e => e.specialty === 'nurse' && e.status === 'active').length;
  const hospitalMidwives = gameState.employees.filter(e => e.specialty === 'midwife' && e.status === 'active').length;
  const hospitalPsychologistsOnDuty: Psychologist[] = hospitalPsychologists(gameState.employees);
  const hospitalStaff = {
    nurses: hospitalNurses,
    midwives: hospitalMidwives,
    nurseBonus: hospitalLevel > 0 ? buildingPreviewEffects.nurseBonus : 0,
    midwifeBonus: hospitalLevel > 0 ? buildingPreviewEffects.midwifeBonus : 0,
    // Whoever is posted to the ward is the one walking patients in.
    escortNames: gameState.employees
      .filter(employee => employee.status === 'active' && employee.assignedBuildingId === 'hospital')
      .map(employee => employee.name)
  };
  // Mothers who are at full term but hold no bed: the hospital tab lists them so
  // a shortage of wards is visible instead of silent.
  const waitingForHospitalBed = gameState.roster.filter(
    character => character.pregnancy?.status === 'pregnant'
      && character.pregnancy.daysPregnant >= GESTATION_DAYS
      && !hospital.patients.some(patient => patient.characterId === character.id)
  );
  // Pregnancies the medical staff would put under observation right now, but every
// ward is taken: the risk reasons travel with them so the player sees the case.
  const waitingForObservation = gameState.roster
    .filter(character =>
      !character.assignedTask
      && !hospital.patients.some(patient => patient.characterId === character.id)
      && needsPregnancyObservation(character, hospital.equipment)
    )
    .map(character => ({ character, risk: assessPregnancyRisk(character, hospital.equipment) }));

  // Roster members whose health has fallen into the bad range and still have no
  // bed booked for them.
  const waitingForTreatment = gameState.roster.filter(
    character => needsHospitalTreatment(character)
      && !character.assignedTask
      && !hospital.patients.some(patient => patient.characterId === character.id)
  );

  // Chief doctor: reads the last weekly finance report and the hospital's
  // own books, then issues requests and proposals the player can accept.
  const hospitalClinicians = gameState.employees.filter(
    employee => employee.specialty === 'clinician' && employee.status === 'active'
  ).length;
  const medicalWages = gameState.employees
    .filter(employee => employee.status === 'active'
      && ['nurse', 'midwife', 'clinician', 'psychologist'].includes(employee.specialty))
    .reduce((sum, employee) => sum + employee.weeklyWage, 0);
  const hospitalStaffing = calculateStaffing({
    roster: gameState.roster,
    hospital,
    psychologistsOnDuty: hospitalPsychologistsOnDuty
  });
  const hospitalBuilding = gameState.auxiliaryBuildings.find(item => item.id === 'hospital');
  const hospitalUpgradeCost = hospitalBuilding ? getBuildingActionCost(hospitalBuilding) : null;
  const hospitalUpgradeBenefit = hospitalBuilding
    ? getBuildingDefinition('hospital').effectDescriptions[Math.min(3, hospitalBuilding.level + 1)]
    : getBuildingDefinition('hospital').effectDescriptions[1];
  const chiefDoctorReport = buildChiefDoctorReport({
    week: gameState.week,
    funds: gameState.funds,
    hospital,
    hospitalLevel,
    hospitalUpgradeCost,
    hospitalUpgradeBenefit,
    nurses: hospitalNurses,
    midwives: hospitalMidwives,
    clinicians: hospitalClinicians,
    psychologists: hospitalPsychologistsOnDuty.length,
    medicalWages,
    recommendedDoctors: hospitalStaffing.doctors,
    recommendedNurses: hospitalStaffing.nurses,
    recommendedPsychologists: hospitalStaffing.psychologists,
    psychologistCases: hospitalStaffing.breakdown.psychologistCases,
    waitingForBed: waitingForHospitalBed.length,
    waitingForObservation: waitingForObservation.length,
    waitingForTreatment: waitingForTreatment.length,
    hiringSlots: gameState.hiringSlots,
    employeeCount: gameState.employees.length,
    weeklyReport: gameState.lastWeeklyReport
  });

  const handleEventChoice = (choice: EventChoice | ExpansionEventChoice) => {
    if (activeEvent && 'kind' in activeEvent && 'effects' in choice) {
      setGameState(prev => applyExpansionEventChoice(prev, activeEvent, choice));
      showNotify(choice.resultMessage);
      setActiveEvent(null);
      return;
    }
    if (!('fundsDelta' in choice) || !('reputationDelta' in choice)) return;
    // Auction house (Idea 4): entering the lot opens the bidding flow instead of
    // resolving the event directly.
    if (choice.startsAuction) {
      const lotQuality: 'high' | 'elite' = rollChance(0.7) ? 'high' : 'elite';
      setAuction({
        currentBid: 18000 + rollInt(12000),
        round: 1,
        lotQuality,
        lotName: lotQuality === 'elite' ? 'Элитная пленница (редкий профиль)' : 'Пленница высокого класса'
      });
      setActiveEvent(null);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds + (choice.fundsDelta ?? 0),
      reputation: Math.min(100, Math.max(0, prev.reputation + (choice.reputationDelta ?? 0))),
      log: [`Результат события: ${choice.resultMessage}`, ...prev.log]
    }));
    showNotify(choice.resultMessage);
    setActiveEvent(null);
  };

  /**
   * Places a bid in the slave auction. NPC buyers counter-bid a few times; if the
   * syndicate wins, an elite captive joins the roster for the final bid.
   */
  const placeAuctionBid = () => {
    if (!auction) return;
    const bidAmount = auction.currentBid;
    if (gameState.funds < bidAmount) {
      showNotify('Недостаточно средств для этой ставки!');
      return;
    }

    // NPC counter-bid chance falls as the lot gets expensive.
    const counterChance = Math.max(0.15, 0.7 - auction.round * 0.15);
    const npcCounter = auction.round < 4 && Math.random() < counterChance;

    if (npcCounter) {
      const raise = Math.round(auction.currentBid * (0.12 + Math.random() * 0.15));
      setAuction({
        ...auction,
        currentBid: auction.currentBid + raise,
        round: auction.round + 1
      });
      showNotify(`Покупатель перебил вашу ставку! Новая цена: ${formatMoney((auction.currentBid + raise))}.`);
      return;
    }

    // Won the lot: pay the bid and add a captive to the roster.
    const slave = generateSlaveCharacter({
      regionId: '05_middle_east',
      quality: auction.lotQuality === 'elite' ? 'high' : 'medium',
      origin: 'slave_auction'
    });
    slave.acquiredWeek = gameState.week;
    if (auction.lotQuality === 'elite') {
      // Elite lots are stronger than a standard raid captive.
      slave.skill = Math.min(100, slave.skill + 25);
      slave.submission = Math.min(100, slave.submission + 15);
      slave.role = 'Проданная с аукциона элита (раб)';
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - bidAmount,
      roster: [...prev.roster, slave],
      log: [`Выигран лот аукциона (${formatMoney(bidAmount)}): ${slave.name} — ${slave.role} присоединился к составу.`, ...prev.log]
    }));
    showNotify(`Аукцион выигран! ${slave.name} (${slave.role}) приобретена за ${formatMoney(bidAmount)}.`);
    setAuction(null);
  };

  const withdrawFromAuction = () => {
    setAuction(null);
    showNotify('Вы вышли из аукциона. Лот перешёл к другому покупателю.');
  };

  /**
   * Resolves the player's choice in a road-ambush mini-event and applies every
   * consequence: treasury/reputation deltas, stake losses, the mission leader's
   * death, a wiped-out capture squad and any captured raiders pressed into the
   * roster as slaves.
   */
  const handleRaidChoice = (action: RaidResolutionAction) => {
    if (!activeRaid) return;
    const raid = activeRaid;
    const outcome = resolveRaid(raid, action);
    const captured = buildCapturedSlaves(outcome, raid.destRegion)
      .map(slave => ({ ...slave, acquiredWeek: gameState.week }));
    const summary = outcome.success ? outcome.message : outcome.failureMessage;

    // Resolve which personnel are lost before touching state, so the state
    // updater stays side-effect free.
    const operation = (gameState.captureOperations || []).find(op => op.id === raid.raidId);
    const removedIds = new Set<string>();
    // Legacy caravans have no leaderId, so fall back to the old name match once.
    const removedNames = new Set<string>();
    let squadWiped = false;
    if (raid.missionKind === 'capture' && operation) {
      squadWiped = outcome.detachmentWiped;
      if (squadWiped) operation.squadIds.forEach(id => removedIds.add(id));
      else if (outcome.leaderKilled && raid.leaderId) removedIds.add(raid.leaderId);
    } else if (outcome.leaderKilled && raid.missionKind === 'caravan') {
      if (raid.leaderId) removedIds.add(raid.leaderId);
      else removedNames.add(raid.leaderName);
    }

    setGameState(prev => {
      const caravans = prev.caravans.map(c => {
        if (raid.missionKind !== 'caravan' || c.id !== raid.raidId) return c;
        const lostValue = Math.round(c.potentialProfit * outcome.stakeLossFraction);
        const thisLeaderDied = outcome.leaderKilled && raid.leaderId
          ? c.leaderId === raid.leaderId
          : outcome.leaderKilled && c.leaderName === raid.leaderName;
        const isRaided = outcome.resultingStatus === 'raided' || thisLeaderDied;
        return {
          ...c,
          potentialProfit: Math.max(0, c.potentialProfit - lostValue),
          // A failed defense leaves the caravan plundered; a caravan that held,
          // or merely lost cargo while fleeing, resumes travel.
          status: isRaided ? 'raided' as const : 'traveling' as const,
          leaderName: thisLeaderDied ? 'Неизвестен (погиб)' : c.leaderName,
          endWeek: isRaided ? gameState.week : c.endWeek
        };
      });

      const captureOperations = prev.captureOperations.map(op => {
        if (raid.missionKind !== 'capture' || op.id !== raid.raidId) return op;
        const lostValue = Math.round(op.bounty * outcome.stakeLossFraction);
        return {
          ...op,
          bounty: Math.max(0, op.bounty - lostValue),
          // A scattered squad presses on to the target; a wiped one is finished.
          status: squadWiped ? 'lost' as const : 'outbound' as const
        };
      });

      // Kill the leader (by id where known, otherwise by the legacy name match)
      // and free any surviving squad members from the mission flag.
      const roster = prev.roster
        .filter(c => !removedIds.has(c.id) && !removedNames.has(c.name))
        .map(clearCaptureTask);

      const logEntries = [
        `Дорожная засада [${raid.missionName} · ${raid.enemyType}]: ${summary}`,
        outcome.capturedSlaves > 0
          ? `Захвачено нападающих: ${captured.length} — обращены в рабов.`
          : '',
        outcome.stakeLossFraction > 0
          ? `Потери ставки: конфисковано ${Math.round(outcome.stakeLossFraction * 100)}%.`
          : '',
        squadWiped ? `Отряд из ${operation?.squadSize ?? 0} человек потерян без выживших.` : ''
      ].filter(Boolean);

      return {
        ...prev,
        funds: prev.funds + outcome.fundsDelta,
        reputation: Math.min(100, Math.max(0, prev.reputation + outcome.reputationDelta)),
        caravans,
        captureOperations,
        roster: [...roster, ...captured],
        log: [...logEntries, ...prev.log].slice(0, 50)
      };
    });

    showNotify(summary.length > 70 ? summary.slice(0, 67) + '…' : summary);
    popRaid();
  };

  /**
   * Fulfils a slave-purchase contract by handing over all eligible captives from
   * the roster. Pays per delivered head, applies reputation effects and rolls the
   * contract's risk for a possible customs/authorities scandal.
   */
  /**
   * Signs an opened regional supply offer, unlocking the weekly purchase right.
   * The caravans opened the door; signing is what commits the syndicate to buying.
   */
  const signRegionSupply = (contractId: string) => {
    const contract = (gameState.tradeSupplyContracts || []).find(c => c.id === contractId);
    if (!contract || contract.status !== 'active' || contract.signed) return;

    setGameState(prev => ({
      ...prev,
      tradeSupplyContracts: (prev.tradeSupplyContracts || []).map(c =>
        c.id === contractId ? signTradeSupplyContract(c) : c
      ),
      log: [
        `Подписан контракт на поставку рабов с регионом ${contract.regionName}: до ${contract.weeklyQuantity} чел./нед. по ${formatMoney(contract.pricePerHead)} за голову в течение ${contract.weeksRemaining} нед.`,
        ...prev.log
      ].slice(0, 50)
    }));
    showNotify(`Контракт с регионом ${contract.regionName} подписан — теперь можно выкупать пленников.`);
  };

  /**
   * Buys this week's lot of captives from a region's supply offer (the reward for
   * routing 5-15 caravans into it). The heads join the roster «без работы» and the
   * cost comes straight out of the treasury.
   */
  const buyFromRegionSupply = (contractId: string, quantity?: number) => {
    const contractToSign = (gameState.tradeSupplyContracts || []).find(c => c.id === contractId);
    if (contractToSign && !contractToSign.signed) {
      showNotify('Сначала подпишите контракт.');
      return;
    }
    const contract = (gameState.tradeSupplyContracts || []).find(c => c.id === contractId);
    if (!contract || contract.status !== 'active') return;

    const { contract: updated, bought, cost } = buyFromSupplyContract(
      contract,
      gameState.funds,
      gameState.week,
      quantity
    );
    if (bought.length === 0) {
      showNotify(
        gameState.funds < contract.pricePerHead
          ? `Недостаточно средств: одна голова стоит ${formatMoney(contract.pricePerHead)}.`
          : 'Недельная партия уже выкуплена.'
      );
      return;
    }

    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      roster: [...prev.roster, ...bought],
      tradeSupplyContracts: (prev.tradeSupplyContracts || []).map(c => c.id === contractId ? updated : c),
      log: [
        `Выкуплено у региона ${contract.regionName}: ${bought.length} пленник(ов) (качество: ${contract.quality}) за ${formatMoney(cost)}.`,
        ...prev.log
      ].slice(0, 50)
    }));
    showNotify(`Куплено ${bought.length} пленник(ов) у региона ${contract.regionName} за ${formatMoney(cost)}.`);
  };

  const fulfillSlaveContract = (contractId: string) => {
    const contract = (gameState.slaveContracts || []).find(c => c.id === contractId);
    if (!contract || contract.status !== 'active') return;

    const { contract: delivered, deliveredIds } = deliverSlaves(contract, gameState.roster);
    const legalRiskReduction = calculateBuildingWeeklyEffects(gameState.auxiliaryBuildings, gameState.employees).scandalRiskReduction;
    if (deliveredIds.length === 0) {
      showNotify('Нет подходящих пленников в составе для этого покупателя!');
      return;
    }

    const payout = Math.round(deliveredIds.length * contract.pricePerHead * marketImprovementEffects(gameState.marketImprovements).proceedsMultiplier);
    const fullyDone = delivered.status === 'completed';
    // Roll the risk only when the full order is closed out.
    const scandal = fullyDone && rollPercent(effectiveRiskPercent(contract, legalRiskReduction, marketImprovementEffects(gameState.marketImprovements)));
    const reputationDelta = scandal
      ? -contract.riskReputation
      : fullyDone
        ? contract.rewardReputation
        : 0;

    setGameState(prev => {
      const logEntries = [
        `Контракт «${contract.title}»: доставлено ${deliveredIds.length} пленник(ов) покупателю ${contract.buyerName} за ${formatMoney(payout)} (${delivered.quantityDelivered}/${delivered.quantityWanted}).`,
        scandal ? `СКАНДАЛ: рейд по борьбе с торговлей людьми вывел след на ваш синдикат (${reputationDelta} репутации).` : '',
        !scandal && fullyDone ? `Контракт выполнен без инцидентов. +${reputationDelta} репутации.` : ''
      ].filter(Boolean);

      // Update standing with this buyer type (Idea 5): clean completions build
      // trust (bigger orders, better prices); a scandal locks them out for weeks.
      const updatedStandings = applyStandingOutcome(prev.buyerStandings, contract.buyerType, {
        completed: fullyDone,
        scandal,
        week: prev.week
      });
      const newTier = standingTier(getStanding(updatedStandings, contract.buyerType).reputation);
      const standingNote = scandal
        ? `Отношения с покупателем ${contract.buyerType} испорчены — блокировка на несколько недель.`
        : fullyDone
          ? `Отношения с покупателем ${contract.buyerType} улучшены (${newTier}).`
          : '';

      return {
        ...prev,
        funds: prev.funds + payout,
        reputation: Math.min(100, Math.max(0, prev.reputation + reputationDelta)),
        roster: prev.roster.filter(c => !deliveredIds.includes(c.id)),
        slaveContracts: (prev.slaveContracts || []).map(c => c.id === contractId ? { ...delivered, status: scandal ? 'failed' : delivered.status } : c),
        buyerStandings: updatedStandings,
        log: [...logEntries, standingNote, ...prev.log].filter(Boolean).slice(0, 50)
      };
    });

    if (scandal) {
      showNotify(`Сделка раскрыта! Доставлено ${deliveredIds.length} пленник(ов), но потеряно ${contract.riskReputation} репутации.`);
    } else {
      showNotify(`Доставлено ${deliveredIds.length} пленник(ов) покупателю ${contract.buyerName} за ${formatMoney(payout)}.`);
    }
  };

  const applyForLoan = () => {
    if (gameState.activeLoan) {
      showNotify('У вас уже есть активный кредит!');
      return;
    }
    const interest = loanRepaymentType === 'fixed' ? 0.12 : 0.18;
    const totalOwed = Math.round(loanAmount * (1 + interest));
    const weeklyPayment = Math.round(totalOwed / loanTerm);
    const loanApp: LoanApplication = {
      amount: loanAmount,
      termWeeks: loanTerm,
      repaymentType: loanRepaymentType,
      interestRate: interest,
      remainingPrincipal: totalOwed,
      weeksPaid: 0,
      weeklyPayment
    };
    setGameState(prev => ({
      ...prev,
      funds: prev.funds + loanAmount,
      activeLoan: loanApp,
      metaProgress: registerLoanTaken(prev.metaProgress),
      log: [`Получен кредит ${formatMoney(loanAmount)} (${loanRepaymentType === 'fixed' ? 'Фиксированный платёж' : 'Доля от дохода'}, ${interest * 100}% процентов, ${loanTerm} недель). Еженедельный платёж: ${formatMoney(weeklyPayment)}.`, ...prev.log]
    }));
    showNotify(`Кредит одобрен! Зачислено ${formatMoney(loanAmount)}. Еженедельный платёж: ${formatMoney(weeklyPayment)}`);
  };

  const payOffLoanEarly = () => {
    if (!gameState.activeLoan) return;
    const payoffAmount = gameState.activeLoan.remainingPrincipal;
    if (gameState.funds < payoffAmount) {
      showNotify('Недостаточно средств для досрочного погашения!');
      return;
    }
    const savedInterest = (gameState.activeLoan.weeklyPayment * (gameState.activeLoan.termWeeks - gameState.activeLoan.weeksPaid)) - payoffAmount;
    const weeksPaid = gameState.activeLoan.weeksPaid;
    const termWeeks = gameState.activeLoan.termWeeks;
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - payoffAmount,
      activeLoan: null,
      metaProgress: registerLoanRepaid(prev.metaProgress),
      log: [`Досрочное погашение кредита: выплачено ${formatMoney(payoffAmount)} (оплачено ${weeksPaid}/${termWeeks} недель). Экономия ~${formatMoney(Math.round(savedInterest))} на будущих процентах.`, ...prev.log]
    }));
    showNotify(`Кредит досрочно погашен за ${formatMoney(payoffAmount)}!`);
  };

  // Court procedures are argued by the syndicate's own lawyers, so the
  // court path is only open while at least one lawyer is on staff.
  const companyLawyers = gameState.employees.filter(employee => employee.specialty === 'lawyer' && employee.status === 'active');
  const activeBankruptcyCase = gameState.bankruptcyCase && gameState.bankruptcyCase.status === 'active'
    ? gameState.bankruptcyCase
    : null;
  const canFileBankruptcy = gameState.isBankrupt
    && !activeBankruptcyCase
    && (bankruptcyPath === 'bank_board' || companyLawyers.length > 0);

  const fileBankruptcy = () => {
    if (!canFileBankruptcy) return;
    const procedure: BankruptcyProcedure = bankruptcyPath === 'bank_board'
      ? 'settlement_agreement'
      : bankruptcyProcedure;
    const definition = getProcedureDefinition(bankruptcyPath, procedure);
    const newCase = fileBankruptcyCase(bankruptcyInitiator, bankruptcyPath, procedure, gameState.week);
    setGameState(prev => ({
      ...prev,
      bankruptcyCase: newCase,
      isReceivership: definition.receivershipDuring,
      log: [`ЗАЯВЛЕНИЕ О БАНКРОТСТВЕ: ${INITIATOR_LABELS[bankruptcyInitiator]} инициировал процедуру «${definition.title}» (${PATH_LABELS[bankruptcyPath]}). Срок процедуры: ${definition.durationWeeks} нед., еженедельные сборы ${formatMoney(definition.weeklyFee)}.`, ...prev.log].slice(0, 50)
    }));
    showNotify(`Процедура «${definition.title}» начата — срок ${definition.durationWeeks} нед.`);
  };

  const upgradeSalon = () => {
    const currentLevel = gameState.beautySalon.level;
    const nextLevel = currentLevel + 1;
    const levelInfo = SALON_LEVELS.find(l => l.level === nextLevel);
    if (!levelInfo) {
      showNotify('Салон уже на максимальном уровне!');
      return;
    }
    if (gameState.funds < levelInfo.upgradeCost) {
      showNotify(`Недостаточно средств! Нужно ${formatMoney(levelInfo.upgradeCost)} на улучшение.`);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - levelInfo.upgradeCost,
      beautySalon: {
        ...prev.beautySalon,
        level: nextLevel
      },
      log: [`Салон красоты улучшен до «${levelInfo.name}» (уровень ${nextLevel}) за ${formatMoney(levelInfo.upgradeCost)}. Рабочие места: ${levelInfo.workstations}, вместимость расходников: ${levelInfo.supplyCapacity}.`, ...prev.log]
    }));
    showNotify(`Салон улучшен до «${levelInfo.name}»!`);
  };

  const assignSalonManager = (traitId: string) => {
    const trait = MANAGER_TRAITS.find(t => t.id === traitId);
    if (!trait) return;
    setGameState(prev => ({
      ...prev,
      beautySalon: { ...prev.beautySalon, managerTraitId: traitId },
      log: [`Назначен управляющий салоном: ${trait.name} — ${trait.effectDescription}.`, ...prev.log]
    }));
    showNotify(`Управляющий назначен: ${trait.name}!`);
  };

  const upgradeExhaustion = (venue: 'pleasure_house' | 'strip_club' | 'beauty_salon') => {
    const upgrade = EXHAUSTION_UPGRADES[venue];
    const currentLevel = gameState.exhaustionUpgrades[venue];
    const nextLevel = currentLevel + 1;
    if (nextLevel > upgrade.maxLevel) {
      showNotify(`Оздоровление «${upgrade.venueName}» уже на максимальном уровне!`);
      return;
    }
    const cost = upgrade.costs[nextLevel];
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств! Нужно ${formatMoney(cost)} на это улучшение.`);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      exhaustionUpgrades: { ...prev.exhaustionUpgrades, [venue]: nextLevel },
      log: [`Оздоровление «${upgrade.venueName}» улучшено до уровня ${nextLevel}: ${upgrade.effectDescriptions[nextLevel]}.`, ...prev.log]
    }));
    showNotify(`Оздоровление «${upgrade.venueName}» улучшено до уровня ${nextLevel}!`);
  };

  const upgradePleasureHouse = (trackId: PleasureHouseUpgradeId) => {
    const upgrade = PLEASURE_HOUSE_UPGRADES[trackId];
    const currentLevel = gameState.pleasureHouseUpgrades[trackId] ?? 0;
    const nextLevel = currentLevel + 1;
    if (nextLevel > upgrade.maxLevel) {
      showNotify(`${upgrade.name} уже на максимальном уровне!`);
      return;
    }
    const cost = upgrade.costs[nextLevel];
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств! Нужно ${formatMoney(cost)} для этого улучшения.`);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      pleasureHouseUpgrades: { ...prev.pleasureHouseUpgrades, [trackId]: nextLevel },
      log: [`Дом удовольствия: ${upgrade.name} улучшен до уровня ${nextLevel}. ${upgrade.effectDescriptions[nextLevel]}.`, ...prev.log]
    }));
    showNotify(`${upgrade.name} улучшен до уровня ${nextLevel}!`);
  };

  const upgradeStripClub = (trackId: StripClubUpgradeId) => {
    const upgrade = STRIP_CLUB_UPGRADES[trackId];
    const currentLevel = gameState.stripClubUpgrades[trackId] ?? 0;
    const nextLevel = currentLevel + 1;
    if (nextLevel > upgrade.maxLevel) {
      showNotify(`${upgrade.name} уже на максимальном уровне!`);
      return;
    }
    const cost = upgrade.costs[nextLevel];
    if (gameState.funds < cost) {
      showNotify(`Недостаточно средств! Нужно ${formatMoney(cost)} для этого улучшения.`);
      return;
    }
    setGameState(prev => ({
      ...prev,
      funds: prev.funds - cost,
      stripClubUpgrades: { ...prev.stripClubUpgrades, [trackId]: nextLevel },
      log: [`Стрип-клуб: ${upgrade.name} улучшен до уровня ${nextLevel}. ${upgrade.effectDescriptions[nextLevel]}.`, ...prev.log].slice(0, 50)
    }));
    showNotify(`${upgrade.name} улучшен до уровня ${nextLevel}!`);
  };

  const assignOperativeToContract = (contractId: string, charId: string) => {
    const charName = gameState.roster.find(c => c.id === charId)?.name || charId;
    const contractTitle = gameState.contracts.find(c => c.id === contractId)?.title || contractId;
    const wasAssigned = gameState.contracts.find(c => c.id === contractId)?.assignedOperativeIds?.includes(charId) ?? false;
    setGameState(prev => {
      const contract = prev.contracts.find(c => c.id === contractId);
      if (!contract || contract.status !== 'active') return prev;
      const assigned = contract.assignedOperativeIds || [];
      const newAssigned = wasAssigned
        ? assigned.filter(id => id !== charId)
        : [...assigned, charId];
      const action = wasAssigned ? 'удалён из контракта' : 'назначен на контракт';
      return {
        ...prev,
        contracts: prev.contracts.map(c => c.id === contractId ? { ...c, assignedOperativeIds: newAssigned } : c),
        log: [`Оперативник ${charName} ${action} «${contractTitle}».`, ...prev.log]
      };
    });
    showNotify(`${charName} ${wasAssigned ? 'удалён из контракта' : 'назначен на контракт'} «${contractTitle}»!`);
  };

  const scheduleSalonTreatment = () => {
    const targetChar = gameState.roster.find(c => c.id === bookingCharacterId);
    const treatment = TREATMENTS.find(t => t.id === bookingTreatmentId);
    if (!targetChar || !treatment) {
      showNotify('Выберите оперативника и процедуру.');
      return;
    }
    if (gameState.beautySalon.supplies < treatment.suppliesConsumed) {
      showNotify('Недостаточно расходников салона! Сначала пополните запасы.');
      return;
    }

    const newTreatment: ScheduledTreatment = {
      id: 'sched_' + Math.random().toString(36).substring(2, 9),
      characterId: targetChar.id,
      characterName: targetChar.name,
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      isAutomatic: bookingIsAuto,
      intervalWeeks: bookingInterval,
      nextRunWeek: gameState.week + 1,
      status: 'queued'
    };

    setGameState(prev => ({
      ...prev,
      beautySalon: {
        ...prev.beautySalon,
        supplies: prev.beautySalon.supplies - treatment.suppliesConsumed,
        scheduledTreatments: [...prev.beautySalon.scheduledTreatments, newTreatment]
      },
      log: [`Запланировано: ${treatment.name} для ${targetChar.name} (следующая неделя).`, ...prev.log]
    }));
    showNotify(`Записано: ${treatment.name} для ${targetChar.name}!`);
  };

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onAuthenticated={() => setIsAuthenticated(true)}
      />
    );
  }

  // --- MAIN MENU SCREEN ---
  if (currentScreen === 'main_menu') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-slate-950 to-slate-950 pointer-events-none" />

        <div className="relative z-10 max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-pink-600 to-amber-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6 text-slate-950">
            <Sparkles className="w-8 h-8 font-bold" />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white mb-2">EMPORIUM</h1>
          <p className="text-xs text-slate-400 font-mono mb-8 uppercase tracking-widest">Глобальная стратегия и торговая симуляция v0.3.7</p>

          <div className="space-y-3">
            <button
              onClick={() => {
                const slot1 = getSlotInfo(1);
                if (slot1.exists) {
                  loadGameFromSlot(1);
                } else {
                  setCurrentScreen('new_game');
                }
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              Продолжить кампанию (Слот 1)
            </button>

            <button
              onClick={() => setCurrentScreen('new_game')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-pink-400" />
               Новая игра
            </button>

            <button
              onClick={() => setCurrentScreen('load_game')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
               Загрузка сохранений
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-500">
            Портреты, торговые караваны, салон красоты и VIP-контракты включены
          </div>
        </div>
      </div>
    );
  }

  // --- NEW GAME SCREEN ---
  if (currentScreen === 'new_game') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-slate-950 to-slate-950 pointer-events-none" />

        <div className="relative z-10 max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-left">
          <button
            onClick={() => setCurrentScreen('main_menu')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Назад в главное меню
          </button>

          <h2 className="text-2xl font-bold text-white mb-2">Создание персонажа</h2>
          <p className="text-slate-400 text-sm mb-6">Создайте своего главу синдиката, как в начале новой игры.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Имя</label>
              <input
                type="text"
                value={newCeoName}
                onChange={e => setNewCeoName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-pink-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Пол</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewCeoGender('women');
                    setNewCeoPortraitUrl(null);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm border ${newCeoGender === 'women' ? 'bg-pink-600/20 border-pink-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  Женщина
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCeoGender('men');
                    setNewCeoPortraitUrl(null);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm border ${newCeoGender === 'men' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  Мужчина
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCeoGender('trans');
                    setNewCeoPortraitUrl(null);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm border ${newCeoGender === 'trans' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  Трансгендер
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Выбор пола исключает портреты других полов — доступны только портреты выбранного пола.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Дата рождения</label>
                <input
                  type="date"
                  value={newCeoBirthDate}
                  onChange={e => setNewCeoBirthDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Место рождения</label>
                <input
                  type="text"
                  value={newCeoBirthPlace}
                  onChange={e => setNewCeoBirthPlace(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Фото главного героя
                </label>
                <FileUpload
                  accept="image/*"
                  label="Фото главного героя"
                  onFile={f => {
                    const r = new FileReader();
                    r.onload = () => {
                      setNewCeoPhoto(r.result as string);
                      setNewCeoPortraitUrl(null);
                    };
                    r.readAsDataURL(f);
                  }}
                />
              </div>
            </div>

            {/* Портреты из игры для выбранного пола: при выборе женщин остальные полы недоступны. */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Портрет из игры
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {ceoPortraitFileNames(newCeoGender).map(fileName => {
                  const url = assetUrl(`/portraits/99_CEO/${newCeoGender}/${fileName}.webp`);
                  const selected = newCeoPortraitUrl === url;
                  return (
                    <button
                      key={fileName}
                      type="button"
                      onClick={() => {
                        setNewCeoPortraitUrl(url);
                        setNewCeoPhoto(null);
                      }}
                      aria-pressed={selected}
                      className={`aspect-square rounded-lg border overflow-hidden ${selected ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-700 bg-slate-950 hover:border-slate-500'}`}
                    >
                      <img src={url} alt={`Портрет ${newCeoGender}`} className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Предпросмотр фото главного героя. */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Предпросмотр</label>
              <div className="relative h-32 w-32 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center">
                {newCeoPhoto ?? newCeoPortraitUrl ? (
                  <img src={newCeoPhoto ?? newCeoPortraitUrl!} alt="Фото главного героя" className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={assetUrl(`/portraits/99_CEO/${newCeoGender}/${ceoPortraitFileNames(newCeoGender)[0]}.webp`)}
                    alt="Портрет по умолчанию"
                    className="h-full w-full object-cover opacity-50 grayscale"
                  />
                )}
                <span className="absolute bottom-1 left-1 bg-slate-900/80 text-[10px] text-slate-300 px-1.5 py-0.5 rounded">
                  {newCeoPhoto ? 'Загруженное фото' : newCeoPortraitUrl ? 'Портрет из игры' : 'По умолчанию'}
                </span>
              </div>
              {newCeoPhoto === null && newCeoPortraitUrl === null && (
                <p className="mt-1 text-[10px] text-slate-500">Показан портрет по умолчанию для выбранного пола.</p>
              )}
            </div>
              <input
                type="text"
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-pink-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Начальный капитал ($)</label>
              <select
                value={newStartingFunds}
                onChange={e => setNewStartingFunds(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-pink-500 outline-none"
              >
                <option value={75000}>$75,000 (Хардкор)</option>
                <option value={125000}>$125,000 (Стандарт)</option>
                <option value={250000}>$250,000 (Режим магната)</option>
              </select>
            </div>

            <button
              onClick={startNewCampaign}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              Создать и начать игру
            </button>
          </div>

          {mapCoords && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left">
              <h4 className="text-amber-400 font-bold text-sm mb-2">Координаты локации (Яндекс.Карты)</h4>
              <p className="text-xs text-slate-300 mb-1">
                <span className="font-mono font-bold">{mapCoords.lat}, {mapCoords.lon}</span>
                — террейн будет сгенерирован по этой точке.
              </p>
            </div>
          )}
        </div>
  );
  }

  // --- LOAD GAME SCREEN ---
  if (currentScreen === 'load_game') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-slate-950 to-slate-950 pointer-events-none" />

        <div className="relative z-10 max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-left">
          <button
            onClick={() => setCurrentScreen('main_menu')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Назад в главное меню
          </button>

          <h2 className="text-2xl font-bold text-white mb-2">Сохранение / загрузка</h2>
          <p className="text-slate-400 text-sm mb-6">Выберите слот, чтобы загрузить прогресс кампании.</p>

          <div className="space-y-4">
            {[1, 2, 3, 4].map(slotNum => {
              const info = getSlotInfo(slotNum);
              return (
                <div key={slotNum} className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono font-bold">Слот #{slotNum}</span>
                      <h3 className="font-bold text-white text-base">{info.exists ? info.campaignName : 'Пустой слот'}</h3>
                    </div>
                    {info.exists ? (
                      <div className="text-xs text-slate-400 flex items-center gap-4 font-mono">
                        <span>Неделя {info.week}</span>
                        <span>Казна: <strong className="text-emerald-400">{formatMoney(info.funds)}</strong></span>
                        <span className="text-slate-500">{info.timestamp}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">В этом слоте нет сохранённых данных кампании.</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {info.exists ? (
                      <>
                        <button
                          onClick={() => loadGameFromSlot(slotNum)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Загрузить
                        </button>
                        <button
                          onClick={() => deleteSlotData(slotNum)}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          saveGameToSlot(slotNum);
                          showNotify(`Создано новое сохранение в слоте ${slotNum}!`);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Сохранить сюда
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Renders the Slave Ledger — an aggregate overview of the syndicate's captive
   * holdings (count, averages, unrest and lifetime revenue). Shared by the
   * dashboard and the dedicated Slave Market tab.
   */
  const renderSlaveLedger = () => {
    const ledgerSlaves = gameState.roster.filter(c => c.isSlave);
    const ledgerUnrest = assessSlaveUnrest(ledgerSlaves, gameState.roster);
    const avgSubmission = ledgerSlaves.length ? Math.round(ledgerSlaves.reduce((s, c) => s + (c.submission || 0), 0) / ledgerSlaves.length) : 0;
    const avgLoyalty = ledgerSlaves.length ? Math.round(ledgerSlaves.reduce((s, c) => s + (c.loyalty || 0), 0) / ledgerSlaves.length) : 0;
    const lifetime = lifetimeSlaveRevenue(ledgerSlaves);
    const unrestTone = ledgerUnrest.unrestIndex >= 60 ? 'text-red-400' : ledgerUnrest.unrestIndex >= 35 ? 'text-amber-400' : 'text-emerald-400';
    return (
      <div className="bg-slate-900 border-slate-800 rounded-xl p-6 shadow-xl text-left">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-pink-400" /> Реестр рабов</h3>
          <span className="text-[10px] uppercase text-slate-500 font-semibold">Сводка по пленникам</span>
        </div>
        {ledgerSlaves.length === 0 ? (
          <div className="text-slate-500 text-xs text-center py-6 bg-slate-950 border-slate-800 rounded-xl">В вашем распоряжении нет пленников. Выиграйте набег на караван, купите лот или победите на аукционе, чтобы приобрести рабов.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="bg-slate-950 border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Всего пленников</div>
              <div className="text-xl font-bold font-mono text-white">{ledgerSlaves.length}</div>
            </div>
            <div className="bg-slate-950 border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Ср. покорность</div>
              <div className="text-xl font-bold font-mono text-pink-400">{avgSubmission}</div>
            </div>
            <div className="bg-slate-950 border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Ср. лояльность</div>
              <div className="text-xl font-bold font-mono text-purple-400">{avgLoyalty}</div>
            </div>
            <div className="bg-slate-950 border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Индекс беспорядков</div>
              <div className={`text-xl font-bold font-mono ${unrestTone}`}>{ledgerUnrest.unrestIndex}</div>
            </div>
            <div className="bg-slate-950 border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Риск побега</div>
              <div className={`text-xl font-bold font-mono ${ledgerUnrest.escapeChance >= 25 ? 'text-red-400' : ledgerUnrest.escapeChance >= 12 ? 'text-amber-400' : 'text-emerald-400'}`}>{ledgerUnrest.escapeChance}%</div>
            </div>
            <div className="bg-slate-950 border-slate-800 rounded-lg p-3 col-span-2 md:col-span-5">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Доход от рабов за всё время</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{formatMoney(lifetime)}</div>
              <div className="text-[10px] text-slate-500 mt-1">Снижайте беспорядки, ломая пленников (вкладка «Персонал»), или назначайте их на охрану в Торговле. Покупатели с высоким спросом платят намного больше — проверьте предложения ниже.</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders the slave-buyer offers for a given channel (market / black market),
   * showing the roster's eligible captives and a fulfilment button per offer.
   */
  const renderSlaveContracts = (channel: SlaveContractChannel) => {
    const offers = (gameState.slaveContracts || []).filter(c => c.channel === channel && c.status === 'active');

    if (offers.length === 0) {
      return (
        <div className="text-slate-500 text-xs text-center py-6 bg-slate-950 border-slate-800 rounded-xl">
          Сейчас здесь нет активных покупателей рабов. Продвиньте неделю, чтобы получить новые предложения.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {offers.map(contract => {
          const eligible = eligibleSlaves(gameState.roster, contract);
          const totalSlaves = gameState.roster.filter(c => c.isSlave).length;
          const canDeliver = eligible.length > 0;
          return (
            <div key={contract.id} className={`bg-slate-950 border rounded-xl p-4 flex-col justify-between gap-3 ${channel === 'black_market' ? 'border-purple-500/30' : 'border-amber-500/30'}`}>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white text-sm leading-tight">{contract.title}</h4>
                    <p className="text-xs text-amber-400 mt-0.5">{contract.buyerName}</p>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold mt-0.5">{contract.buyerType === 'Private Estate' ? 'Частное поместье' : contract.buyerType === 'Cartel Broker' ? 'Брокер картеля' : 'Подпольный аукционист'} • {contract.regionName}</p>
                  </div>
                  <div className="flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-mono px-2 py-1 rounded-full font-bold bg-slate-800 text-slate-300">{contract.weeksRemaining} нед.</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${contract.demandTier === 'high' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : contract.demandTier === 'low' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                      {contract.demandTier === 'high' ? 'ВЫСОКИЙ' : contract.demandTier === 'low' ? 'НИЗКИЙ' : 'СРЕДНИЙ'} СПРОС
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{contract.description}</p>
                <div className="text-[10px] font-mono text-emerald-400 mt-1">Арбитраж: ориентир в регионе поставки {formatMoney(contract.sourcePriceBenchmark)}/голова → предложение платит {formatMoney(contract.pricePerHead)}/голова</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-slate-500">Требуется</span><span className="text-white">{contract.quantityWanted}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Доставлено</span><span className="text-white">{contract.quantityDelivered}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">За голову</span><span className="text-emerald-400">{formatMoney(contract.pricePerHead)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Мин. качество</span><span className="text-pink-400">{contract.minQuality === 'low' ? 'Низкое' : contract.minQuality === 'medium' ? 'Среднее' : 'Высокое'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Риск</span><span className="text-red-400">{contract.riskPercent}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Репутационный удар</span><span className="text-red-400">-{contract.riskReputation} реп.</span></div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-800/60 pt-3">
                <span className="text-[10px] uppercase text-slate-500 font-semibold">
                  Подходящие пленники: <strong className={eligible.length > 0 ? 'text-emerald-400' : 'text-red-400'}>{eligible.length}</strong> / {totalSlaves}
                </span>
                <button
                  onClick={() => fulfillSlaveContract(contract.id)}
                  disabled={!canDeliver}
                  className={`px-3 py-2 rounded-lg font-bold text-xs transition shrink-0 ${canDeliver ? (channel === 'black_market' ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer') : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                >
                  {canDeliver ? `Доставить ${eligible.length} пленник(ов)` : 'Нет подходящих пленников'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Renders the per-buyer-type standing panel (Idea 5): trust, scandals, order
   * caps, price bonuses and any active scandal lockout.
   */
  const renderBuyerRelationships = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {['Private Estate', 'Diplomatic Household', 'Shipping Consortium'].map(buyerType => {
          const rec = getStanding(gameState.buyerStandings, buyerType);
          const locked = isBuyerLocked(rec, gameState.week);
          const tier = standingTier(rec.reputation);
          const label = buyerType === 'Private Estate' ? 'Частное поместье' : buyerType === 'Diplomatic Household' ? 'Дипломатический дом' : 'Судоходный консорциум';
          return (
            <div key={buyerType} className="bg-slate-950 border-slate-800 rounded-xl p-4">
              <div className="font-bold text-white text-sm">{label}</div>
              <div className="text-[10px] uppercase text-slate-500 font-semibold mt-0.5">
                {locked ? <span className="text-red-400">Заблокировано (скандал)</span> : <span className="text-emerald-400">{tier === 'cold' ? 'Холодные' : tier === 'neutral' ? 'Нейтральные' : tier === 'trusted' ? 'Доверенные' : 'Благосклонные'} отношения</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono">
                <div className="flex justify-between"><span className="text-slate-500">Доверие</span><span className="text-white">{rec.reputation}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Скандалы</span><span className="text-red-400">{rec.scandals}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Макс. заказов</span><span className="text-white">{maxOrdersForStanding(rec.reputation)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Бонус к цене</span><span className="text-emerald-400">+{Math.min(20, rec.reputation * 4)}%</span></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- PLAYING MAIN APP UI ---
  const weeklyReport = gameState.lastWeeklyReport;
  return (
    <div className="tg-app-shell overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* IN-GAME MENU / SAVE MODAL */}
      {showInGameMenu && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Save className="w-5 h-5 text-amber-400" /> Меню синдиката и сохранения
              </h3>
              <button onClick={() => setShowInGameMenu(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-6">Управляйте сохранениями кампании или вернитесь в главное меню.</p>

            <div className="space-y-4 mb-6">
              {[1, 2, 3, 4].map(slotNum => {
                const info = getSlotInfo(slotNum);
                const isCurrent = gameState.slot === slotNum;
                return (
                  <div key={slotNum} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono font-bold">Слот #{slotNum} {isCurrent && '(Текущий)'}</span>
                        <span className="text-xs font-bold text-white">{info.exists ? info.campaignName : 'Пусто'}</span>
                      </div>
                      {info.exists && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Неделя {info.week} • {formatMoney(info.funds)}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveGameToSlot(slotNum)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer"
                       >
                         Сохранить
                       </button>
                      {info.exists && (
                        <button
                          onClick={() => {
                             loadGameFromSlot(slotNum);
                             setShowInGameMenu(false);
                           }}
                           className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer"
                           >
                             Загрузить
                           </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowInGameMenu(false);
                  setCurrentScreen('main_menu');
                }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Выйти в главное меню
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    exportGameSave(gameState, `emporium_save_week${gameState.week}.json`);
                    showNotify('Сохранение экспортировано в файл!');
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  Экспорт
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e: any) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event: any) => {
                        const content = event.target.result;
                        const importedState = importGameSave(content);
                        if (importedState) {
                          setGameState(importedState);
                          showNotify('Сохранение успешно импортировано!');
                        } else {
                          showNotify('Ошибка импорта файла!');
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  Импорт
                </button>
                <button
                  onClick={() => setShowInGameMenu(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Продолжить кампанию
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-12 right-0 bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full transition cursor-pointer border border-slate-700"
              title="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fullscreenImage}
              alt="Портрет оперативника в полный экран"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain border-2 border-slate-700 shadow-2xl bg-slate-900"
            />
            <p className="text-xs text-slate-400 mt-3 font-mono">Нажмите вне изображения или закройте, чтобы выйти из полноэкранного режима.</p>
          </div>
        </div>
      )}

      {/* Random Event Modal */}
      {activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded uppercase">{activeEvent.category} {('kind' in activeEvent ? 'Обновление' : 'Дилемма')}</span>
                <h3 className="text-lg font-bold text-white mt-1">{activeEvent.title}</h3>
              </div>
            </div>

            <p className="text-slate-300 text-sm mb-6 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{activeEvent.description}</p>

            <div className="space-y-3">
              {activeEvent.choices.map((choice, idx) => {
                const choiceCost = 'effects' in choice
                  ? choice.effects.reduce((sum, effect) => sum + (effect.type === 'funds' ? Math.max(0, -effect.delta) : 0), 0)
                  : Math.max(0, -(choice.fundsDelta ?? 0));
                const cannotAfford = choiceCost > gameState.funds;
                return (
                  <button
                    key={'id' in choice ? choice.id : `${activeEvent.id}-${idx}`}
                    onClick={() => handleEventChoice(choice)}
                    disabled={cannotAfford}
                    className="w-full text-left bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/50 p-4 rounded-xl transition cursor-pointer flex items-center justify-between group disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-800"
                  >
                    <span>
                      <span className="block text-sm font-medium text-white group-hover:text-pink-400">{choice.text}</span>
                      {cannotAfford && <span className="mt-1 block text-[10px] text-red-300">Недостаточно средств: нужно {formatMoney(choiceCost)}.</span>}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 shrink-0" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Slave Auction Bidding Modal (Idea 4) */}
      {auction && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl border-purple-500/40 text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded uppercase">Подпольный аукцион • Раунд {auction.round}/4</span>
                <h3 className="text-lg font-bold text-white mt-1">Аукцион рабов — {auction.lotName}</h3>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed bg-slate-950 p-4 rounded-xl border-slate-800">
              Аукционист объявляет лот. Покупатели всё ещё активны. Текущая ставка:{' '}
              <strong className="text-amber-400">{formatMoney(auction.currentBid)}</strong>. Делайте ставку, чтобы выиграть, иначе лот уйдёт другому покупателю.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                 <div className="text-[10px] uppercase text-slate-400 font-semibold">Казна</div>
                <div className="text-sm font-bold font-mono text-emerald-400">{formatMoney(gameState.funds)}</div>
              </div>
              <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Класс лота</div>
                <div className="text-sm font-bold font-mono text-pink-400">{auction.lotQuality === 'elite' ? 'ЭЛИТА' : 'ВЫСОКИЙ'}</div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={placeAuctionBid}
                disabled={gameState.funds < auction.currentBid}
                className={`w-full font-bold py-3 rounded-xl text-sm transition ${gameState.funds >= auction.currentBid ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
              >
                {gameState.funds >= auction.currentBid ? `Ставка ${formatMoney(auction.currentBid)}` : 'Недостаточно средств для ставки'}
              </button>
              <button
                onClick={withdrawFromAuction}
                className="w-full bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300 font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
              >
                Выйти из аукциона
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Road Ambush Mini-Event Modal (caravans & capture operations) */}
      {activeRaid && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-red-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl border-red-500/40 text-red-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-red-500/10 text-red-400 rounded uppercase">
                  {activeRaid.enemyType === 'pirates' ? 'Засада пиратов' : 'Засада бандитов'} &bull; угроза: {activeRaid.severity === 'minor' ? 'незначительная' : activeRaid.severity === 'moderate' ? 'умеренная' : 'серьёзная'}
                  {raidQueue.length > 1 ? ` • очередь: ${raidQueue.length}` : ''}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {activeRaid.missionKind === 'capture' ? `Отряд «${activeRaid.missionName}» под атакой` : `«${activeRaid.missionName}» под атакой`}
                </h3>
              </div>
            </div>

            <p className="text-slate-300 text-sm mb-4 leading-relaxed bg-slate-950 p-4 rounded-xl border-slate-800">
              {activeRaid.missionKind === 'capture' ? (
                <>Отряд под командованием {activeRaid.leaderName}, охотящийся за{' '}
                  <strong className="text-amber-400">{activeRaid.targetName}</strong> на дороге в{' '}
                  <strong className="text-amber-400">{activeRaid.destRegion}</strong>, перехвачен силами <strong className="text-red-400">{activeRaid.enemyName}</strong>.
                  Ставка: <strong className="text-emerald-400">{formatMoney(activeRaid.stakeValue)}</strong>.
                  Уничтоженный отряд не вернётся.</>
              ) : (
                <>Силы <strong className="text-red-400">{activeRaid.enemyName}</strong> устроили засаду вашему каравану на пути в{' '}
                  <strong className="text-amber-400">{activeRaid.destRegion}</strong> под предводительством {activeRaid.leaderName}. Экипаж должен решить, как ответить.</>
              )}
            </p>

            {/* Crew statistics used by the resolution */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
              <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Навык лидера</div>
                <div className="text-sm font-bold font-mono text-pink-400">{activeRaid.leaderSkill}</div>
              </div>
              <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Лояльность лидера</div>
                <div className="text-sm font-bold font-mono text-emerald-400">{activeRaid.leaderLoyalty}</div>
              </div>
              <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Размер экипажа</div>
                <div className="text-sm font-bold font-mono text-white">{activeRaid.crewSize}</div>
              </div>
              <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Ср. навык экипажа</div>
                <div className="text-sm font-bold font-mono text-amber-400">{activeRaid.crewAvgSkill}</div>
              </div>
            </div>

            {(activeRaid.depotRiskReduction > 0 || activeRaid.depotVictoryBonus > 0) && (
              <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200">
                Караванная станция: риск нападения −{activeRaid.depotRiskReduction} п.п., шанс победы в бою +{activeRaid.depotVictoryBonus} п.п.
              </p>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleRaidChoice('fight')}
                className="w-full text-left bg-slate-950 hover:bg-red-500/10 border-slate-800 hover:border-red-500/50 p-4 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-bold text-white group-hover:text-red-400">⚔️ Сражаться</span>
                  <p className="text-xs text-slate-400 mt-0.5">Отбейте нападающих силой. Победа приносит пленных и добычу. Есть риск гибели лидера.</p>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded font-bold ${activeRaid.fightChance >= 50 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {activeRaid.fightChance}%
                </span>
              </button>

              <button
                onClick={() => handleRaidChoice('flee')}
                className="w-full text-left bg-slate-950 hover:bg-amber-500/10 border-slate-800 hover:border-amber-500/50 p-4 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-bold text-white group-hover:text-amber-400">🏃 Скрыться</span>
                  <p className="text-xs text-slate-400 mt-0.5">Попытка ускакать от засады. Стоит части ставки, но сохраняет экипаж.</p>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded font-bold ${activeRaid.fleeChance >= 50 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {activeRaid.fleeChance}%
                </span>
              </button>

              <button
                onClick={() => handleRaidChoice('tribute')}
                className="w-full text-left bg-slate-950 hover:bg-purple-500/10 border-slate-800 hover:border-purple-500/50 p-4 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-bold text-white group-hover:text-purple-400">💰 Отдать дань ({formatMoney(activeRaid.tributeDemand)})</span>
                  <p className="text-xs text-slate-400 mt-0.5">Выкупить безопасный проход. Дёшево при высокой лояльности, но нападающие могут предать вас.</p>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded font-bold ${activeRaid.tributeChance >= 50 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {activeRaid.tributeChance}%
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App settings */}
      <SettingsModal
        open={isSettingsOpen}
        settings={appSettings}
        onChange={updateSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Top Notification Toast */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-amber-300 animate-bounce">
          <AlertCircle className="w-5 h-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Clinic admission notices: an employee escorting a mother to a ward. */}
      {hospitalNotices.length > 0 && (
        <div className="pointer-events-none fixed right-5 z-50 flex flex-col gap-2" style={{ top: notification ? '5rem' : '1.25rem' }}>
          {hospitalNotices.map(notice => (
            <div
              key={notice.id}
              role="status"
              className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-slate-900/95 px-4 py-2.5 text-xs font-semibold text-amber-100 shadow-xl backdrop-blur"
            >
              <HeartPulse className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{notice.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(open => !open)}
            aria-label={isMobileMenuOpen ? 'Закрыть меню навигации' : 'Открыть меню навигации'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-game-navigation"
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 md:hidden"
          >
            {isMobileMenuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
          <div className="bg-gradient-to-tr from-pink-600 to-amber-400 p-2.5 rounded-xl shadow-inner text-slate-950">
            <Sparkles className="w-6 h-6 font-bold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 p-0">EMPORIUM <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-full font-mono">v0.3.7 Web</span></h1>
            <p className="text-xs text-slate-400">{gameState.campaignName} (Слот #{gameState.slot})</p>
          </div>
        </div>

          {/* Status Metrics */}
          <div className="flex flex-wrap items-center gap-4 my-2 sm:my-0 sm:gap-6">
          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <Calendar className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Хронология</div>
              <div className="text-sm font-bold font-mono">Неделя {gameState.week}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800" title={`Курс BTC/USD: $1 = ₿${(1 / getBtcRate()).toFixed(8)} · 1 BTC ≈ $${getBtcRate().toLocaleString()} (реальный рыночный курс)`}>
            <Bitcoin className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Казна</div>
              <div className="text-sm font-bold font-mono text-emerald-400">{formatMoney(gameState.funds)}</div>
              <div className="text-[9px] font-mono text-slate-500">1 BTC ≈ ${getBtcRate().toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <Award className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Репутация синдиката</div>
              <div className="text-sm font-bold font-mono text-purple-300">{gameState.reputation}%</div>
            </div>
          </div>

          {gameState.metaProgress && gameState.metaProgress.prestige.level > 0 && (
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-purple-500/40" title={`New Game+ уровень ${gameState.metaProgress.prestige.level}: +${gameState.metaProgress.prestige.level * 50}% стартовый капитал, +${gameState.metaProgress.prestige.level * 25}% к доходам`}>
              <Crown className="w-4 h-4 text-purple-300" />
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Престиж</div>
                <div className="text-sm font-bold font-mono text-purple-300">
                  {gameState.metaProgress.prestige.level} <span className="text-[10px] text-slate-400">×{prestigeRevenueMultiplier(gameState.metaProgress.prestige.level).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
           <div className="flex items-center gap-3" data-platform={currentPlatform}>
             <button
               type="button"
               onClick={() => setIsSettingsOpen(true)}
               aria-label="Настройки приложения"
               title="Настройки"
               className="rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-200 transition hover:bg-slate-700"
             >
               <Settings className="w-4 h-4" />
             </button>
              <NotificationCenter feed={activityFeed} onNavigate={tab => { setActiveTab(tab); setIsMobileMenuOpen(false); }} />


          <button
            onClick={() => setShowInGameMenu(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg font-semibold flex items-center gap-2 border border-slate-700 transition cursor-pointer text-sm shadow"
          >
            <Save className="w-4 h-4 text-amber-400" />
            Меню / Сохранение
          </button>

          <button
            onClick={advanceWeek}
            disabled={raidQueue.length > 0}
            title={raidQueue.length > 0 ? 'Сначала разберитесь с нападением' : undefined}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500 text-slate-950 px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer text-sm"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Следующая неделя
          </button>
        </div>
      </header>

      {/* CAMPAIGN ENDING: victory or defeat modal */}
      {campaignEnding && (
        <CampaignEndingModal
          ending={campaignEnding}
          campaignName={gameState.campaignName}
          prestigeLevel={gameState.metaProgress?.prestige.level ?? 0}
          onContinue={() => setCampaignEnding(null)}
          onPrestige={startPrestigeCampaign}
          onRetire={() => {
            setCampaignEnding(null);
            setCurrentScreen('main_menu');
          }}
        />
      )}

      {isMobileMenuOpen && (
        <nav id="mobile-game-navigation" aria-label="Разделы игры" className="border-b border-slate-800 bg-slate-900 px-3 py-2 md:hidden">
          {renderNavigationItems(false, true)}
        </nav>
      )}

      <div className={`flex min-h-0 flex-1 ${mezzanineView === 'mezzanine' ? 'h-[calc(100vh-5rem)]' : ''}`}>
        <aside className={`hidden shrink-0 flex-col border-r border-slate-800 bg-slate-900/70 transition-[width] duration-200 md:flex ${isSidebarExpanded ? 'w-64' : 'w-[4.5rem]'}`}>
          <div className={`flex min-h-14 items-center border-b border-slate-800 px-3 ${isSidebarExpanded ? 'justify-between' : 'justify-center'}`}>
            {isSidebarExpanded && <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Навигация</span>}
            <button
              type="button"
              onClick={() => setIsSidebarExpanded(expanded => !expanded)}
              aria-label={isSidebarExpanded ? 'Свернуть панель навигации' : 'Развернуть панель навигации'}
              aria-expanded={isSidebarExpanded}
              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              {isSidebarExpanded ? <ChevronLeft aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
          <nav aria-label="Разделы игры" className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            {renderNavigationItems(!isSidebarExpanded)}
          </nav>
          {isSidebarExpanded && (
            <div className="border-t border-slate-800 px-4 py-3 text-[10px] leading-relaxed text-slate-600">
              EMPORIUM OPERATIONS<br />Глобальная стратегическая система
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className={`min-w-0 flex-1 overflow-y-auto ${mezzanineView === 'mezzanine' ? 'overflow-hidden p-3 sm:p-4' : activeTab === 'slave_market' || activeTab === 'supply_contracts' || activeTab === 'market' || activeTab === 'roster' || activeTab === 'strip_club' || activeTab === 'salon' ? 'max-w-none p-3 sm:p-4' : 'mx-auto w-full max-w-7xl p-4 sm:p-6'}`}>
        {/* BANKRUPTCY & RECEIVERSHIP WARNING BANNER */}
        {gameState.isBankrupt && (
          <div className="mb-6 bg-red-950/80 border border-red-500/50 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-red-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <h4 className="font-bold text-white">ВНЕШНЕЕ УПРАВЛЕНИЕ И БАНКРОТСТВО</h4>
                <p className="text-xs text-red-300">Казна отрицательна. Очереди процедур очищены; внешний управляющий контролирует доходы салона.</p>
              </div>
            </div>
            {!activeBankruptcyCase && (
              <button
                onClick={() => setActiveTab('board')}
                className="shrink-0 bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition cursor-pointer"
              >
                Совет директоров — процедура выхода
              </button>
            )}
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Размер активного штата</div>
                <div className="text-2xl font-bold font-mono text-white">
                  {gameState.roster.length} <span className="text-xs font-normal text-slate-400">оперативников</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Активные торговые караваны</div>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {gameState.caravans.filter(c => c.status === 'traveling').length} <span className="text-xs font-normal text-slate-400">маршрутов</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Отправлено глобальных маршрутов</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                <div className="text-slate-400 text-xs uppercase mb-1 font-semibold">Выручка салона</div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {formatMoney(gameState.beautySalon.totalRevenue)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Всего заработано за всё время</div>
              </div>
            </div>

            {/* CAMPAIGN GOAL — win condition progress */}
            <CampaignGoalPanel
              week={gameState.week}
              funds={gameState.funds}
              reputation={gameState.reputation}
              goalStatus={gameState.metaProgress?.goalStatus ?? 'ongoing'}
              prestigeLevel={gameState.metaProgress?.prestige.level ?? 0}
            />

            {/* OFFICE FLOOR PLAN — top-down view of the syndicate's buildings */}
            <OfficeFloorPlan buildings={gameState.auxiliaryBuildings} employees={gameState.employees} />

            {/* SLAVE LEDGER (Idea 3) — shared helper */}
            {renderSlaveLedger()}

            {/* Roster Quick View */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white">Ключевые оперативники</h3>
                <button onClick={() => setActiveTab('roster')} className="text-amber-400 hover:underline text-xs font-semibold flex items-center gap-1 cursor-pointer">
                  Смотреть всех <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-3">
                {gameState.roster.slice(0, 3).map(char => {
                  const attr = calculateAttractiveness(char);
                  return (
                    <div key={char.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="relative group cursor-pointer" onClick={() => setFullscreenImage(char.image)} title="Нажмите, чтобы открыть в полном размере">
                          <img src={char.image} alt={char.name} className="w-12 h-12 rounded-lg object-cover border border-slate-700 group-hover:border-pink-500 transition" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">{char.name}</div>
                          <div className="text-xs text-slate-400">{roleLabel(char.role)} • <span className="text-amber-400">Привлекательность: {attr}/100</span></div>
                          <div className="text-[11px] text-slate-300 font-mono mt-0.5">Страна: <span className="text-slate-100">{char.country || 'Неизвестно'}</span> · Город: <span className="text-slate-100">{char.city || '—'}</span></div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <div className="text-pink-400 uppercase font-bold">{venueLabel(char.assignedVenue)}</div>
                        <div className="text-slate-400">{HEALTH_LABELS[char.healthLevel]} / {EXHAUSTION_LABELS[char.exhaustionLevel]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h3 className="font-bold text-white mb-4">Хронологический журнал синдиката</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2 max-h-64 overflow-y-auto">
                {gameState.log.map((entry, idx) => (
                  <div key={idx} className="text-slate-300 border-b border-slate-900 pb-1.5 last:border-0">{entry}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL MARKETPLACE TAB */}
        {activeTab === 'market' && (
          <GlobalMarketTab
          platform={currentPlatform}
          candidates={gameState.marketPool.filter(character => !character.acquired)}
            funds={gameState.funds}
            reservedCharacterIds={gameState.reservedMarketCharacterIds || []}
            onBuySlave={buyMarketSlave}
            onToggleReservation={toggleMarketReservation}
            onPreviewImage={setFullscreenImage}
            marketImprovements={gameState.marketImprovements}
            marketRequest={gameState.marketRequest}
            onAcceptMarketRequest={acceptMarketRequest}
            onDeclineMarketRequest={declineMarketRequest}
          />
        )}

        {/* FACILITIES & STAFF TAB */}
        {activeTab === 'facilities_staff' && (
<FacilitiesStaffTab
            week={gameState.week}
            funds={gameState.funds}
            employees={gameState.employees}
            buildings={gameState.auxiliaryBuildings}
            candidates={gameState.employeeCandidates}
            hiringSlots={gameState.hiringSlots}
            onBuildOrUpgrade={buildOrUpgradeBuilding}
            onAssignEmployee={assignEmployeeToBuilding}
            onHireEmployee={hireEmployeeCandidate}
            onDismissEmployee={dismissEmployee}
            onRefreshCandidates={refreshCandidates}
            onBuyHiringSlot={buyHiringSlot}
          />
        )}

        {/* STAFF TABLE TAB */}
        {activeTab === 'staff' && (
          <div className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-start gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Персонал</h2>
                  <p className="mt-1 max-w-3xl text-sm text-slate-400">Табличный список всех наёмных сотрудников компании без фотографий. Позволяет быстро назначать на посты и увольнять.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                <span>{gameState.employees.length} сотрудников</span>
              </div>
            </header>

            <StaffTable
              employees={gameState.employees}
              buildings={gameState.auxiliaryBuildings}
              currentWeek={gameState.week}
              onDismiss={dismissEmployee}
              onAssignEmployee={assignEmployeeToBuilding}
              onRenewContract={renewEmployeeContract}
            />
          </div>
        )}

        {/* HIRING TAB */}
        {activeTab === 'hiring' && (
          <HiringTab
            week={gameState.week}
            funds={gameState.funds}
            employees={gameState.employees}
            buildings={gameState.auxiliaryBuildings}
            restZone={gameState.restZone}
            candidates={gameState.employeeCandidates}
            hiringSlots={gameState.hiringSlots}
            onHire={hireEmployeeCandidate}
            onRefresh={refreshCandidates}
            onBuySlot={buyHiringSlot}
            onOpenStaffTab={() => setActiveTab('facilities_staff')}
          />
        )}

        {/* SLAVE MARKET TAB */}
        {activeTab === 'slave_market' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-pink-400" /> Рынок пленниц и торговля пленными
              </h2>
              <p className="text-slate-400 text-sm">Полный цикл торговли пленными: скупайте партии дёшево в регионах с низким спросом, открывайте постоянные поставки от регионов за удачные караваны, сдерживайте недовольство и перепродавайте покупателям с высоким спросом. Цены определяются региональным спросом.</p>
            </div>

            {/* 1. Buy side — captive lots for arbitrage */}
          <CaptiveLotsMarketPanel
          platform={currentPlatform}
          lots={gameState.captiveLots || []}
                funds={gameState.funds}
                reservedLotIds={gameState.reservedCaptiveLotIds || []}
                onBuyLot={buyCaptiveLot}
                onToggleReservation={toggleCaptiveLotReservation}
                onPreviewImage={setFullscreenImage}
              />

            {/* 2. Holdings overview */}
            {renderSlaveLedger()}

            {/* 3. Sell side — buyer offers across both channels */}
            <div className="bg-slate-900 border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" /> Предложения покупателей — открытые торги
              </h3>
              <p className="text-slate-400 text-sm mb-4">Иностранные домовладельцы, поместья и консорциумы публикуют открытые заявки на выкуп пленных из вашего штата. Выполнение оплачивается за каждого человека; срыв сделки вредит вашей репутации.</p>
              {renderSlaveContracts('market')}
            </div>

            {/* 4. Buyer relationships (standing) */}
            <div className="bg-slate-900 border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" /> Отношения с покупателями
              </h3>
              <p className="text-slate-400 text-sm mb-4">Репутация у каждого типа покупателей растёт за чисто выполненные сделки (крупные заказы, лучшие цены) и рушится до полной блокировки после скандала.</p>
              {renderBuyerRelationships()}
            </div>
          </div>
        )}

        {/* SUPPLY CONTRACTS TAB — region supply offers won by caravans. */}
        {activeTab === 'supply_contracts' && (
          <div className="space-y-3">
            <VenueBanner
              title="Поставки от регионов"
              description="Контракты снабжения, открытые прибытием караванов. Подпишите предложение, чтобы получить доступ к недельной партии."
              imageSrc={VENUE_APPEARANCES.supplyContracts.imageSrc}
              imageAlt={VENUE_APPEARANCES.supplyContracts.imageAlt}
              accentClassName="text-sky-300"
              summary={(
                <>
                  <span>Открытых контрактов <strong className="font-mono text-slate-100">{gameState.tradeSupplyContracts.filter(contract => contract.status === 'active').length}</strong></span>
                  <span>Казна <strong className="font-mono text-emerald-300">{formatMoney(gameState.funds)}</strong></span>
                </>
              )}
            />

           <SupplyContractsPanel
           platform={currentPlatform}
contracts={gameState.tradeSupplyContracts || []}
              funds={gameState.funds}
              onSign={signRegionSupply}
              onBuy={buyFromRegionSupply}
            />
          </div>
        )}

        {/* ROSTER TAB */}
        {activeTab === 'roster' && (
          <PleasureHouseTab
          platform={currentPlatform}
          gameState={gameState}
            sortedRoster={sortedRoster}
            rosterSortId={rosterSortId}
            rosterSortDescending={rosterSortDescending}
            rosterSortOptions={ROSTER_SORT_OPTIONS}
            onSortChange={value => setRosterSortId(value as RosterSortId)}
            onSortDirectionToggle={() => setRosterSortFlipped(previous => ({ ...previous, [rosterSortId]: !rosterSortDescending }))}
            administratorRequest={gameState.venueRequests?.pleasure_house ?? null}
            onAcceptRequest={acceptVenueRequest}
            onUpgrade={upgradePleasureHouse}
            onAssignVenue={assignVenue}
            onBreakSlave={breakSlave}
            onSellSlave={sellSlaveAtAuction}
            onPreviewImage={setFullscreenImage}
            roleLabel={roleLabel}
            getCareSummary={getFemaleSlaveCareSummary}
          />
        )}
        {legacyRosterViewEnabled && activeTab === 'roster' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Дом удовольствия</h2>
              <p className="text-slate-400 text-sm">Персонал дома удовольствия: назначения по площадкам и улучшения заведения.</p>
            </div>

            {/* УЛУЧШЕНИЯ ДОМА УДОВОЛЬСТВИЯ */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h3 className="font-bold text-white text-base mb-1">Улучшения дома удовольствия</h3>
              <p className="text-slate-400 text-sm mb-4">Развивайте услуги заведения: БДСМ, фетиш, алкоголь и комнаты. Каждый трек имеет 3 уровня.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {PLEASURE_HOUSE_UPGRADE_IDS.map(trackId => {
                  const upgrade = PLEASURE_HOUSE_UPGRADES[trackId];
                  const currentLevel = gameState.pleasureHouseUpgrades[trackId] ?? 0;
                  const nextLevel = currentLevel + 1;
                  const canUpgrade = nextLevel <= upgrade.maxLevel;
                  const nextCost = canUpgrade ? upgrade.costs[nextLevel] : 0;
                  return (
                    <div key={trackId} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <h4 className="font-bold text-white text-sm mb-1">{upgrade.name}</h4>
                      <p className="text-[11px] text-slate-500 mb-2">{upgrade.tagline}</p>
                      <div className="text-xs font-mono text-slate-400 mb-1">Уровень: <strong className="text-amber-400">{currentLevel}/{upgrade.maxLevel}</strong></div>
                      <div className="flex gap-1 mb-2" aria-label={`${upgrade.name}: уровень ${currentLevel} из ${upgrade.maxLevel}`}>
                        {Array.from({ length: upgrade.maxLevel }, (_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${i < currentLevel ? 'bg-pink-500' : 'bg-slate-800'}`}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-400 mb-3 min-h-8">{upgrade.effectDescriptions[currentLevel]}</div>
                      <button
                        onClick={() => upgradePleasureHouse(trackId)}
                        disabled={!canUpgrade || gameState.funds < nextCost}
                        className="w-full bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {canUpgrade ? `Улучшить (${formatMoney(nextCost)})` : 'МАКС.'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-left">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="roster-sort" className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Сортировка персонала</label>
                  <select
                    id="roster-sort"
                    value={rosterSortId}
                    onChange={e => setRosterSortId(e.target.value as RosterSortId)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:border-pink-500 outline-none"
                  >
                    {ROSTER_SORT_OPTIONS.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setRosterSortFlipped(prev => ({ ...prev, [rosterSortId]: !rosterSortDescending }))}
                  disabled={rosterSortId === 'none'}
                  className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 hover:border-pink-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Сменить направление сортировки"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-pink-400" />
                  {rosterSortDescending ? 'По убыванию' : 'По возрастанию'}
                </button>
                <p className="text-[11px] text-slate-400 font-mono ml-auto">
                  Персонал: <span className="text-slate-100">{gameState.roster.length}</span> ·
                  Без работы: <span className="text-amber-300">{idleRosterCount}</span> ·
                  Беременных: <span className="text-pink-300">{pregnantRosterCount}</span> ·
                  Оценка рынком: <span className="text-emerald-300">{formatMoney(rosterMarketValue)}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" role="table">
                  <tbody className="divide-y divide-slate-800">
                    {sortedRoster.map(char => {
                      const attr = calculateAttractiveness(char);
                      const isCEO = char.role.includes('Chief Executive');
                      const restPlacement = gameState.restZone.placements.find(item => item.characterId === char.id);
                      const hospitalStay = (gameState.hospital.patients || [])
                        .find(patient => patient.characterId === char.id);
                      const treatmentStay = hospitalStay && isTreatmentStay(hospitalStay) ? hospitalStay : null;
                      const observationStay = hospitalStay && isObservationStay(hospitalStay) ? hospitalStay : null;
                      const careSummary = char.isSlave && char.gender === 'women'
                        ? getFemaleSlaveCareSummary(char)
                        : null;
                      const listedAtAuction = gameState.auctionHouse.pendingLots.some(lot => 'characterId' in lot && lot.characterId === char.id);
                      return (
                        <tr key={char.id} className="hover:bg-slate-950/50 transition">
                          <td className="px-4 py-4 w-36 align-top">
                            <div
                              className="relative group cursor-pointer"
                              onClick={() => setFullscreenImage(char.image)}
                              title="Нажмите, чтобы открыть портрет"
                            >
                              <img src={char.image} alt={char.name} className="w-28 h-28 rounded-xl object-cover border border-slate-700 shrink-0 group-hover:border-pink-500 transition" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition">
                                <Maximize2 className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-white text-base">{char.name}</h3>
                              {isCEO && <span className="text-[10px] px-2 py-0.5 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-full font-mono font-bold">ГЕН. ДИР.</span>}
                              {char.isSlave && <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 border-red-500/30 rounded-full font-mono font-bold">ПЛЕННИК</span>}
                              {char.isSlave && (!char.assignedVenue || char.assignedVenue === 'unassigned') && (
                                <span className="text-[10px] px-2 py-0.5 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-full font-mono font-bold">БЕЗ РАБОТЫ</span>
                              )}
                              {isOnCaptureOp(char) && <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono font-bold">В ПОЛЕ</span>}
                              {restPlacement && <span className="text-[10px] px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full font-mono font-bold">ОТДЫХ · {restPlacement.weeksRemaining} НЕД.</span>}
                              {treatmentStay && (
                                <span className="text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full font-mono font-bold">
                                  БОЛЬНИЦА · {Math.max(0, treatmentStay.weeksRemaining - 1)} НЕД.
                                </span>
                              )}
                              {observationStay && (
                                <span className="text-[10px] px-2 py-0.5 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-full font-mono font-bold">
                                  НАБЛЮДЕНИЕ · {Math.max(0, observationStay.weeksRemaining - 1)} НЕД.
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{roleLabel(char.role)} · <span className="text-amber-400 font-mono">Привлекательность: {attr}/100</span></p>
                            <p className="text-[11px] text-slate-300 font-mono mt-1">Пол: <span className="text-slate-100">{GENDER_LABELS[char.gender]}</span> · Страна: <span className="text-slate-100">{char.country || 'Неизвестно'}</span> · Город: <span className="text-slate-100">{char.city || '—'}</span> · Покупка: <span className="text-slate-100">неделя {char.acquiredWeek ?? '—'}</span> · Оценка рынком: <span className="text-emerald-300">{formatMoney(marketValueOf(char))}</span></p>
                            <div className="text-xs text-slate-500 font-mono mt-1">
                              Здоровье: <span className="text-emerald-400">{isCEO ? `${char.exactHealth}% (${HEALTH_LABELS[char.healthLevel]})` : HEALTH_LABELS[char.healthLevel]}</span> |
                              Усталость: <span className="text-amber-400">{isCEO ? `${char.exactExhaustion}% (${EXHAUSTION_LABELS[char.exhaustionLevel]})` : EXHAUSTION_LABELS[char.exhaustionLevel]}</span> |
                              Покорность: <span className="text-purple-400">{char.submission || 50}%</span>
                            </div>
                            {careSummary && (
                              <section className={`mt-2 rounded-lg border px-3 py-2 text-xs ${careSummary.tone}`} aria-label="Содержание рабынь">
                                <div className="font-semibold">Содержание рабынь · {careSummary.status}</div>
                                <ul className="mt-1 list-disc pl-4 text-slate-200">
                                  {careSummary.needs.map(need => <li key={need}>{need}</li>)}
                                </ul>
                              </section>
                            )}
                            {char.isSlave && char.gender === 'women' && char.pregnancy && (
                              <section className={`mt-2 rounded-lg border px-3 py-2 text-xs ${char.pregnancy.status === 'hospitalized' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-pink-500/25 bg-pink-500/5 text-pink-100'}`} aria-label="Статус беременности">
                                <div className="flex items-center gap-2 font-semibold">
                                  <HeartPulse aria-hidden="true" className="h-4 w-4 shrink-0" />
                                  {char.pregnancy.status === 'hospitalized'
                                    ? `Госпитализация · палата «${getWardDefinition(char.pregnancy.wardId ?? '')?.name ?? 'палата'}», роды после этой недели`
                                    : `Беременность · ${Math.round(char.pregnancy.daysPregnant / 7)}/${GESTATION_DAYS / 7} недель`}
                                </div>
                                {char.pregnancy.status === 'pregnant' && (
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950" role="progressbar" aria-label={`Прогресс беременности: ${char.name}`} aria-valuemin={0} aria-valuemax={GESTATION_DAYS} aria-valuenow={char.pregnancy.daysPregnant}>
                                    <div className="h-full rounded-full bg-pink-400 transition-[width]" style={{ width: `${Math.min(100, char.pregnancy.daysPregnant / GESTATION_DAYS * 100)}%` }} />
                                  </div>
                                )}
                              </section>
                            )}
                            {char.pleasureStats && (
                              <div className="text-[11px] font-mono text-pink-400 mt-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                Статистика дома удовольствия · Вагинальные: <strong>{char.pleasureStats.vaginalCount}</strong> | Анальные: <strong>{char.pleasureStats.analCount}</strong> | Заработано: <strong>{formatMoney(char.pleasureStats.totalEarnings)}</strong>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-4 min-w-60">
                              <div>
                                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Место работы</label>
                                <select
                                  value={char.assignedVenue || 'unassigned'}
                                  onChange={e => assignVenue(char.id, e.target.value as any)}
                                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:border-pink-500 outline-none w-full"
                                >
                                  {char.assignedVenue === 'trade' && <option value="trade">{VENUE_LABELS.trade}</option>}
                                  <option value="beauty_salon">{VENUE_LABELS.beauty_salon}</option>
                                  <option value="strip_club">{VENUE_LABELS.strip_club}</option>
                                  <option value="pleasure_house">{VENUE_LABELS.pleasure_house}</option>
                                  <option value="bdsm_room">{VENUE_LABELS.bdsm_room}</option>
                                  <option value="auction_house">{VENUE_LABELS.auction_house}</option>
                                  <option value="security">{VENUE_LABELS.security}</option>
                                  <option value="unassigned">{VENUE_LABELS.unassigned}</option>
                                </select>
                              </div>
                              {char.isSlave && (
                                <div>
                                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Умиротворение</label>
                                  <button
                                    onClick={() => breakSlave(char.id)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer w-full"
                                  >
                                    Сломить пленника
                                  </button>
                                </div>
                              )}
                              {char.isSlave && (
                                <div>
                                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Продать раба</label>
                                  <button
                                    onClick={() => sellSlaveAtAuction(char)}
                                    disabled={listedAtAuction}
                                    className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {listedAtAuction ? 'Выставлен на аукцион' : 'Продать раба'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
<DependentsPanel dependents={gameState.dependents || []} />
          </div>
        )}

        {/* PLEASURE HOUSE PRISONERS TAB */}
        {activeTab === 'pleasure_house_prisoners' && (
          <PleasureHousePrisonersTable
          platform={currentPlatform}
          gameState={gameState}
            excludeVenue="strip_club"
            onUpgrade={upgradePleasureHouse}
            onAssignVenue={assignVenue}
            onBreakSlave={breakSlave}
            onSellSlave={sellSlaveAtAuction}
            onPreviewImage={setFullscreenImage}
            roleLabel={roleLabel}
            getCareSummary={getFemaleSlaveCareSummary}
          />
        )}

        {/* TRAIT CHATS TAB */}
        {activeTab === 'trait_chats' && (
          <TraitChatExplorer
            gameState={gameState}
            onPreviewImage={setFullscreenImage}
          />
        )}

        {/* STRIP CLUB TAB */}
        {activeTab === 'strip_club' && (
          <StripClubTab
          platform={currentPlatform}
          funds={gameState.funds}
            roster={gameState.roster}
            stripClubUpgrades={gameState.stripClubUpgrades}
            administratorRequest={gameState.venueRequests?.strip_club ?? null}
            onAcceptRequest={acceptVenueRequest}
            onUpgrade={upgradeStripClub}
            onAssignVenue={assignVenue}
            onBreakSlave={breakSlave}
            onPreviewImage={setFullscreenImage}
          />
        )}

        {/* SCHOOL & KINDERGARTEN TAB */}
        {activeTab === 'school_kindergarten' && (
          <SchoolKindergartenTab dependents={gameState.dependents || []} />
        )}

        {/* SCHOOL TRAINING TAB */}
        {activeTab === 'school' && (
          <SchoolTab
            roster={gameState.roster}
            enrolments={gameState.schoolEnrolments || []}
            teachers={schoolTeachers}
            week={gameState.week}
            onEnroll={enrollInSchool}
            onCancel={cancelSchoolEnrolment}
          />
        )}

        {/* CORRECTION CENTRE TAB */}
        {activeTab === 'correction_center' && (
          <CorrectionCenterTab
            roster={gameState.roster}
            enrolments={gameState.correctionEnrolments || []}
            week={gameState.week}
            hasMedic={Boolean(gameState.correctionMedicId)}
            onEnroll={enrollInCorrectionCourse}
            onCancel={cancelCorrectionCourse}
          />
        )}

        {/* SELF-DEVELOPMENT CENTRE TAB */}
        {activeTab === 'self_development' && (
          <SelfDevelopmentTab
            roster={gameState.roster}
            funds={gameState.funds}
            onApply={applyTraitPlan}
          />
        )}

        {/* TRADE CARAVANS TAB */}
        {activeTab === 'caravans' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Трансконтинентальные торговые караваны</h2>
              <p className="text-slate-400 text-sm">Отправляйте инвестиционный капитал и руководителей синдиката в глобальные регионы ради выгодной коммерческой отдачи.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left lg:col-span-1">
                <h3 className="font-bold text-white text-base mb-4">Отправить новый караван</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Название маршрута</label>
                    <input 
                      type="text" 
                      value={caravanName} 
                      onChange={e => setCaravanName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Регион назначения</label>
                    <select 
                      value={destRegion} 
                      onChange={e => setDestRegion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                    >
                      {REGIONS.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Капиталовложения ($)</label>
                    <input 
                      type="number" 
                      value={investment} 
                      onChange={e => setInvestment(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Глава каравана</label>
                    <select 
                      value={selectedLeaderId} 
                      onChange={e => setSelectedLeaderId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                    >
                      {gameState.roster.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({roleLabel(c.role)})</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={launchCaravan}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-lg text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" /> Отправить караван
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left lg:col-span-2">
                <h3 className="font-bold text-white text-base mb-4">Активные и завершённые караваны</h3>
                <div className="space-y-3">
                  {gameState.caravans.map(caravan => (
                    <div key={caravan.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{caravan.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Назначение: <strong className="text-amber-400">{caravan.destRegion}</strong> • Глава: {caravan.leaderName}</div>
                        <div className="text-xs font-mono text-slate-500 mt-1">Вложения: {formatMoney(caravan.investment)} • Потенциальная прибыль: <strong className="text-emerald-400">{formatMoney(caravan.potentialProfit)}</strong></div>
                         {(caravan.raidsTriggered ?? 0) > 0 && (
                           <div className="text-[10px] font-mono text-red-400/80 mt-1">
                             нападений за маршрут: {caravan.raidsTriggered}
                           </div>
                         )}
                         {caravan.endWeek !== undefined && (
                           <div className="text-[10px] font-mono text-slate-500 mt-1">
                             Неделя завершения: {caravan.endWeek}
                           </div>
                         )}
                       </div>
                       <div className="text-right font-mono">
                         <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                           caravan.status === 'traveling' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : caravan.status === 'raided' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : caravan.status === 'lost' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                         }`}>
                           {caravan.status === 'traveling' ? `${caravan.weeksRemaining} нед. осталось` : caravan.status === 'raided' ? 'Ограблен' : caravan.status === 'lost' ? 'Потерян' : 'Завершён'}
                         </span>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAPTURE OPERATIONS TAB */}
        {activeTab === 'capture_ops' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Захват цели</h2>
              <p className="text-slate-400 text-sm">
                Отправьте отряд за конкретным человеком в чужой регион. Дорога опаснее торговой: каждую неделю в пути отряд
                могут перехватить, а провал операции стоит бюджета, репутации и иногда жизни всего отряда.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left lg:col-span-1">
                <h3 className="font-bold text-white text-base mb-4">Отправка отряда</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Кодовое название</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={captureCodename}
                        onChange={e => setCaptureCodename(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                      />
                      <button
                        onClick={() => setCaptureCodename(generateCodename(captureOperations.map(op => op.codename)))}
                        title="Случайное кодовое название"
                        className="bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg px-3 text-white text-xs cursor-pointer"
                      >
                        ⟳
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Регион цели</label>
                    <select
                      value={captureRegionId}
                      onChange={e => setCaptureRegionId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                    >
                      {REGIONS.filter(r => r.id !== '99_ceo').map(r => (
                        <option key={r.id} value={r.id}>{r.name} — опасность {Math.round(routeDanger(r.id) * 100)}%</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Статус цели</label>
                    <select
                      value={captureQuality}
                      onChange={e => setCaptureQuality(e.target.value as CaptureTargetQuality)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                    >
                      {(Object.keys(CAPTURE_QUALITY_LABELS) as CaptureTargetQuality[]).map(quality => (
                        <option key={quality} value={quality}>{CAPTURE_QUALITY_LABELS[quality]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Бюджет операции ($)</label>
                    <input
                      type="number"
                      value={captureBudget}
                      onChange={e => setCaptureBudget(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Рекомендуется ≈ {formatMoney(capturePreviewBounty)}. Бюджет увеличивает награду, но не снижает риск нападения.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase">Отряд</label>
                      <span className="text-[10px] font-mono text-slate-400">{captureSquadIds.length}/{MAX_CAPTURE_SQUAD}</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-lg p-2">
                      {availableCaptureOperatives.length === 0 && (
                        <p className="text-[10px] text-slate-500 p-1">Нет свободных оперативников.</p>
                      )}
                      {availableCaptureOperatives.map(c => {
                        const picked = captureSquadIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCaptureSquadMember(c.id)}
                            className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition cursor-pointer flex items-center justify-between ${
                              picked ? 'bg-pink-500/15 text-white border border-pink-500/40' : 'text-slate-400 hover:bg-slate-900 border border-transparent'
                            }`}
                          >
                            <span className="truncate">{picked ? `${captureSquadIds.indexOf(c.id) + 1}. ` : ''}{c.name}</span>
                            <span className="font-mono text-[10px] text-slate-500">навык {c.skill} / верность {c.loyalty}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Командир — первый выбранный оперативник, остальные идут в экипаж.</p>
                  </div>

                  {/* Risk preview so the dispatch decision is informed before committing funds. */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">Захват</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">{captureSquad.length >= MIN_CAPTURE_SQUAD ? `${capturePreviewSnatchChance}%` : '—'}</div>
                    </div>
                    <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">Нападение/нед.</div>
                      <div className="text-sm font-bold font-mono text-red-400">{captureSquad.length >= MIN_CAPTURE_SQUAD ? `${Math.round(capturePreviewAmbushChance * 100)}%` : '—'}</div>
                    </div>
                    <div className="bg-slate-950 border-slate-800 rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">В пути</div>
                      <div className="text-sm font-bold font-mono text-amber-400">{CAPTURE_OPERATION_WEEKS} нед.</div>
                    </div>
                  </div>

                  {activeCaptureCount >= MAX_ACTIVE_CAPTURE_OPS && (
                    <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      Одновременно в поле не больше {MAX_ACTIVE_CAPTURE_OPS} отрядов. Дождитесь возвращения текущих.
                    </p>
                  )}

                  <button
                    onClick={launchCaptureOperation}
                    disabled={activeCaptureCount >= MAX_ACTIVE_CAPTURE_OPS}
                    className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg text-xs transition shadow-lg shadow-pink-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Target className="w-4 h-4" /> Отправить отряд
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-base">Операции</h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    в поле: {activeCaptureCount}/{MAX_ACTIVE_CAPTURE_OPS} · заморожено {formatMoney(committedCaptureSpend(captureOperations))}
                  </span>
                </div>
                <div className="space-y-3">
                  {captureOperations.length === 0 && (
                    <p className="text-xs text-slate-500">Операций пока нет. Соберите отряд и отправьте его за целью.</p>
                  )}
                  {captureOperations.map(operation => {
                    const tone = operation.status === 'outbound'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : operation.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : operation.status === 'lost'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-slate-500/20 text-slate-300 border-slate-500/30';
                    return (
                      <div key={operation.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-white text-sm">{operation.codename}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Цель: <strong className="text-amber-400">{operation.targetName}</strong> · {operation.targetRegionName} · {CAPTURE_QUALITY_LABELS[operation.targetQuality]}
                          </div>
                          <div className="text-xs font-mono text-slate-500 mt-1">
                            Отряд {operation.squadSize} (навык {operation.squadAvgSkill}) · награда <strong className="text-emerald-400">{formatMoney(operation.bounty)}</strong> · захват {operation.captureChance}%
                          </div>
                        </div>
                        <div className="text-right font-mono space-y-1">
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-bold border ${tone}`}>
                            {CAPTURE_STATUS_LABELS[operation.status]}
                          </span>
                          <div className="text-[10px] text-slate-500">
                            {operation.status === 'outbound'
                              ? `${operation.weeksRemaining} нед. в пути · нападений: ${operation.raidsTriggered}`
                              : `нападений: ${operation.raidsTriggered} · бюджет ${formatMoney(operation.upfrontCost)}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY SERVICE TAB */}
        {activeTab === 'security_service' && (
          <SecurityServiceTab state={gameState} />
        )}

        {/* BDSM ROOM TAB */}
        {activeTab === 'bdsm_room' && (
          <BDSMRoomTab
          platform={currentPlatform}
          state={gameState}
            onAcceptRequest={acceptVenueRequest}
          />
        )}

        {/* REST ZONE TAB */}
        {activeTab === 'rest_zone' && (
          <RestZoneTab
            week={gameState.week}
            funds={gameState.funds}
            roster={gameState.roster}
            restZone={gameState.restZone}
            hospitalPatientIds={(gameState.hospital.patients || []).map(patient => patient.characterId)}
            busyCharacterIds={gameState.roster.filter(isOnCaptureOp).map(character => character.id)}
            employees={gameState.employees}
            administratorRequest={gameState.venueRequests?.rest_zone ?? null}
            onAcceptRequest={acceptVenueRequest}
            onSendToRest={sendToRestZone}
            onRecall={recallFromRestZone}
            onSendToSalon={sendToSalon}
            onBuySeat={buyRestSeat}
            onToggleAttendant={toggleRestZoneAttendant}
          />
        )}

        {/* BEAUTY SALON TAB */}
        {activeTab === 'salon' && (
          <BeautySalonTab
          platform={currentPlatform}
          salon={gameState.beautySalon}
            funds={gameState.funds}
            roster={gameState.roster}
            exhaustionUpgrades={gameState.exhaustionUpgrades}
            administratorRequest={gameState.venueRequests?.beauty_salon ?? null}
            onAcceptRequest={acceptVenueRequest}
            bookingCharacterId={bookingCharacterId}
            bookingTreatmentId={bookingTreatmentId}
            bookingIsAuto={bookingIsAuto}
            bookingInterval={bookingInterval}
            onBookingCharacterChange={setBookingCharacterId}
            onBookingTreatmentChange={setBookingTreatmentId}
            onBookingAutoChange={setBookingIsAuto}
            onBookingIntervalChange={setBookingInterval}
            onUpgradeSalon={upgradeSalon}
            onAssignManager={assignSalonManager}
            onUpgradeExhaustion={upgradeExhaustion}
            onScheduleTreatment={scheduleSalonTreatment}
            onAssignVenue={assignVenue}
            onBreakSlave={breakSlave}
            onPreviewImage={setFullscreenImage}
          />
        )}

        {/* HOSPITAL TAB */}
        {activeTab === 'hospital' && (
          <HospitalTab
            week={gameState.week}
            funds={gameState.funds}
            hospital={hospital}
            hospitalLevel={hospitalLevel}
            nurses={hospitalNurses}
            midwives={hospitalMidwives}
            nurseBonus={hospitalStaff.nurseBonus}
            midwifeBonus={hospitalStaff.midwifeBonus}
            psychologists={hospitalPsychologistsOnDuty}
            roster={gameState.roster}
            wardQuantities={hospitalWardQty}
            equipmentQuantities={hospitalEquipQty}
            onWardQuantityChange={(wardId, value) => setHospitalWardQty(prev => ({ ...prev, [wardId]: value }))}
            onEquipmentQuantityChange={(itemId, value) => setHospitalEquipQty(prev => ({ ...prev, [itemId]: value }))}
            onBuyWard={buyHospitalWard}
            onBuyEquipment={buyHospitalEquipment}
            onOpenHiring={() => setActiveTab('hiring')}
            chiefDoctor={chiefDoctorReport}
            onHireSpecialty={hireMedicalSpecialty}
            onBuyHiringSlot={buyHiringSlot}
            onUpgradeHospital={() => buildOrUpgradeBuilding('hospital')}
            waitingForBed={waitingForHospitalBed}
            waitingForTreatment={waitingForTreatment}
            waitingForObservation={waitingForObservation}
          />
        )}

        {/* CONTRACTS TAB */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Контракты для VIP-клиентов</h2>
              <p className="text-slate-400 text-sm">Назначайте оперативников на контракты клиентов. По завершении контракта привлекательность и навык назначенных оперативников сверяются с требованиями.</p>
            </div>

            <div className="space-y-4">
              {gameState.contracts.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-sm">
                  Нет активных VIP-контрактов. Продвиньте неделю, чтобы открыть новые возможности.
                </div>
              ) : (
                gameState.contracts.map(contract => {
                  const assignedOps = (contract.assignedOperativeIds || [])
                    .map(id => gameState.roster.find(c => c.id === id))
                    .filter(Boolean) as Character[];
                  const avgAttr = assignedOps.length > 0
                    ? Math.round(assignedOps.reduce((sum, c) => sum + calculateAttractiveness(c), 0) / assignedOps.length)
                    : 0;
                  const meetsReq = assignedOps.length > 0 && avgAttr >= contract.requiredAttractiveness;

                  return (
                    <div key={contract.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-white text-base">{contract.title}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Клиент: {contract.clientName}</p>
                        </div>
                        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {contract.weeksRemaining}/{contract.durationWeeks} нед.
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mb-3">{contract.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                        <div>
                          <span className="text-slate-500">Награда</span>
                          <div className="font-bold text-emerald-400">{formatMoney(contract.rewardFunds)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Репутация</span>
                          <div className="font-bold text-purple-400">+{contract.rewardReputation}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Нужная привлекательность</span>
                          <div className="font-bold text-amber-400">{contract.requiredAttractiveness}/100</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Назначенные оперативники</span>
                          <div className={`font-bold ${meetsReq ? 'text-emerald-400' : assignedOps.length > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {assignedOps.length} {assignedOps.length > 0 && `(${avgAttr}/100)`}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {(contract.assignedOperativeIds || []).map(charId => {
                          const char = gameState.roster.find(c => c.id === charId);
                          if (!char) return null;
                          return (
                            <div key={charId} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                              <img src={char.image} alt={char.name} className="w-8 h-8 rounded object-cover border border-slate-700" />
                              <span className="text-xs text-white">{char.name}</span>
                              <button
                                onClick={() => assignOperativeToContract(contract.id, charId)}
                                className="text-red-400 hover:text-red-300 text-xs font-bold"
                                title="Убрать из контракта"
                              >вњ•</button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {gameState.roster.filter(c => !(contract.assignedOperativeIds || []).includes(c.id)).map(char => (
                          <button
                            key={char.id}
                            onClick={() => assignOperativeToContract(contract.id, char.id)}
                            className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 hover:border-pink-500/50 transition text-left"
                            title="Назначить в контракт"
                          >
                            <img src={char.image} alt={char.name} className="w-7 h-7 rounded object-cover border border-slate-700" />
                            <span className="text-xs text-slate-300">{char.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* GOODS AUCTION HOUSE TAB */}
        {activeTab === 'auction_house' && (
          <AuctionHouseTab
            week={gameState.week}
            funds={gameState.funds}
            pendingLots={gameState.auctionHouse.pendingLots}
            recentSales={gameState.auctionHouse.recentSales}
            auctioneer={auctionHouseStaff.auctioneer}
            appraiser={auctionHouseStaff.appraiser}
            auctioneerSaleBonus={auctionHouseEffects.auctioneerSaleBonus}
            administratorRequest={gameState.venueRequests?.auction_house ?? null}
            onAcceptRequest={acceptVenueRequest}
            onSellLot={sellAuctionLot}
            saleConsents={gameState.auctionHouse.pendingSaleConsents}
            onConfirmSale={confirmAuctionSale}
            onCancelSaleConsent={cancelAuctionSaleConsent}
            onOpenCaravans={() => setActiveTab('caravans')}
            pleasureHouseCharacters={gameState.roster.filter(c => c.assignedVenue !== 'pleasure_house')}
            onPreviewImage={setFullscreenImage}
            onAddCharacterLot={(char) => {
              const lot = createCharacterLot(char, auctionHouseStaff.appraiser);
              const marketValue = marketValueOf(char);
              const announcements = valuationMismatch(marketValue, lot.appraisedValue)
                ? buildValuationAnnouncements(lot, marketValue, auctionHouseStaff.appraiser, auctionHouseStaff.auctioneer, auctionHouseEffects.auctioneerSaleBonus, false)
                : [];
              setGameState(prev => ({
                ...prev,
                auctionHouse: {
                  ...prev.auctionHouse,
                  pendingLots: [lot, ...prev.auctionHouse.pendingLots]
                },
                log: [`Персонал «${char.name}» выставлен на аукцион.`, ...announcements.map(announcement => announcement.text), ...prev.log].slice(0, 50)
              }));
            }}
          />
        )}

        {/* BOARD OF DIRECTORS TAB */}
        {activeTab === 'board' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Совет директоров</h2>
              <p className="text-slate-400 text-sm">Высший орган управления синдикатом: состав совета, юридическая служба и процедуры выхода из банкротства.</p>
            </div>

            {/* BOARD COMPOSITION */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h3 className="font-bold text-white text-base mb-4">Состав совета директоров</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameState.roster
                  .filter(character => character.role === 'Chief Executive Officer' || character.role === 'Logistics Director')
                  .map(member => (
                    <div key={member.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{member.name}</div>
                        <div className="text-xs text-slate-400">{ROLE_LABELS[member.role] ?? member.role}</div>
                      </div>
                    </div>
                  ))}
                {companyLawyers.map(lawyer => (
                  <div key={lawyer.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                      {lawyer.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{lawyer.name}</div>
                      <div className="text-xs text-slate-400">Юрист · юридический отдел синдиката</div>
                    </div>
                  </div>
                ))}
              </div>
              {companyLawyers.length === 0 ? (
                <p className="mt-4 text-xs text-amber-400/90">
                  Юридическая служба пуста. Судебные процедуры банкротства ведутся моими юристами — наймите юриста через отдел кадров (вкладка «Найм сотрудников»).
                </p>
              ) : (
                <p className="mt-4 text-xs text-emerald-400/90">
                  В штате {companyLawyers.length} юрист(ов) — судебные процедуры доступны.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Найм сотрудников осуществляется через отдел кадров: вкладки «Отдел кадров» и «Найм сотрудников».
              </p>
            </div>

            {/* BANKRUPTCY PROCEDURE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-white text-base mb-1">Процедура банкротства и выход из кризиса</h3>
                  <p className="text-slate-400 text-sm">
                    Инициатор — сам должник или уполномоченные органы. Выход — через суд и юристов синдиката
                    (финансовое оздоровление, внешнее управление, мировое соглашение) или только через банк и совет директоров.
                  </p>
                </div>
                <span className={`font-mono text-[10px] border rounded-md px-2 py-1 ${gameState.isBankrupt ? 'text-red-400 border-red-500/40 bg-red-950' : 'text-emerald-400 border-emerald-500/40 bg-emerald-950'}`}>
                  {gameState.isBankrupt ? 'БАНКРОТСТВО ОБЪЯВЛЕНО' : 'КАЗНА ПОЛОЖИТЕЛЬНА'}
                </span>
              </div>

              {activeBankruptcyCase ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
                  {(() => {
                    const definition = getProcedureDefinition(activeBankruptcyCase.path, activeBankruptcyCase.procedure);
                    const progress = Math.min(100, Math.round((activeBankruptcyCase.weeksElapsed / activeBankruptcyCase.totalWeeks) * 100));
                    return (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Процедура</span>
                          <strong className="text-amber-400">{definition.title}</strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Инициатор</span>
                          <strong className="text-white">{INITIATOR_LABELS[activeBankruptcyCase.initiator]}</strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Путь выхода</span>
                          <strong className="text-white">{PATH_LABELS[activeBankruptcyCase.path]}</strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Подана на неделе</span>
                          <strong className="text-slate-300">{activeBankruptcyCase.filedWeek}</strong>
                        </div>
                        <div>
                          <div className="flex justify-between gap-2 mb-1">
                            <span className="text-slate-400">Прогресс</span>
                            <strong className="text-purple-400">{activeBankruptcyCase.weeksElapsed}/{activeBankruptcyCase.totalWeeks} нед. ({progress}%)</strong>
                          </div>
                          <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="border-t border-slate-800 pt-3 space-y-1 text-slate-400">
                          <div>Еженедельные сборы: <strong className="text-rose-400">-{formatMoney(definition.weeklyFee)}</strong></div>
                          <div>Мораторий на платежи по займам: <strong className={definition.loanMoratorium ? 'text-emerald-400' : 'text-slate-500'}>{definition.loanMoratorium ? 'да' : 'нет'}</strong></div>
                          <div>Внешнее управление доходами: <strong className={definition.receivershipDuring ? 'text-rose-400' : 'text-slate-500'}>{definition.receivershipDuring ? 'да' : 'нет'}</strong></div>
                          <div>Списание долга по завершении: <strong className="text-emerald-400">{Math.round(definition.debtHaircut * 100)}%</strong></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : !gameState.isBankrupt ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 text-center">
                  Процедура доступна после объявления банкротства (казна отрицательна).
                  Текущая казна: <strong className="text-slate-200">{formatMoney(gameState.funds)}</strong>.
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Инициатор процедуры</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['debtor', 'authorized_bodies'] as BankruptcyInitiator[]).map(initiator => (
                        <button
                          key={initiator}
                          type="button"
                          onClick={() => setBankruptcyInitiator(initiator)}
                          className={`px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border ${bankruptcyInitiator === initiator ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                        >
                          {INITIATOR_LABELS[initiator]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Путь выхода из банкротства</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBankruptcyPath('court')}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border text-left ${bankruptcyPath === 'court' ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                      >
                        Через суд и юристов
                        <span className="block text-[10px] font-normal opacity-80 mt-1">Финансовое оздоровление · внешнее управление · мировое соглашение</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBankruptcyPath('bank_board')}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border text-left ${bankruptcyPath === 'bank_board' ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                      >
                        Только через банк или совет директоров
                        <span className="block text-[10px] font-normal opacity-80 mt-1">Внесудебная реструктуризация без юристов</span>
                      </button>
                    </div>
                  </div>

                  {bankruptcyPath === 'court' ? (
                    companyLawyers.length > 0 ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Процедура (утверждается судом)</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {COURT_PROCEDURES.map(definition => (
                            <button
                              key={definition.id}
                              type="button"
                              onClick={() => setBankruptcyProcedure(definition.id)}
                              className={`p-3 rounded-lg text-left transition cursor-pointer border ${bankruptcyProcedure === definition.id ? 'bg-amber-600/20 border-amber-500' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
                            >
                              <div className="font-bold text-white text-xs mb-1">{definition.title}</div>
                              <div className="text-[10px] text-slate-400 leading-relaxed">{definition.shortDescription}</div>
                              <div className="mt-2 text-[10px] font-mono text-slate-500 space-y-0.5">
                                <div>Срок: <strong className="text-slate-300">{definition.durationWeeks} нед.</strong> · сборы <strong className="text-rose-400">{formatMoney(definition.weeklyFee)}/нед.</strong></div>
                                <div>Списание долга: <strong className="text-emerald-400">{Math.round(definition.debtHaircut * 100)}%</strong> · мораторий: <strong className="text-slate-300">{definition.loanMoratorium ? 'да' : 'нет'}</strong></div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-950/60 border border-amber-500/40 rounded-lg p-3 text-xs text-amber-300">
                        Для судебных процедур нужны юристы синдиката — «мои юристы» ведут дело в суде.
                        Наймите юриста через отдел кадров (вкладка «Найм сотрудников») или выберите путь через банк и совет директоров.
                      </div>
                    )
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="font-bold text-white text-xs mb-1">{BANK_BOARD_PROCEDURE.title}</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">{BANK_BOARD_PROCEDURE.shortDescription}</div>
                      <div className="mt-2 text-[10px] font-mono text-slate-500 space-y-0.5">
                        <div>Срок: <strong className="text-slate-300">{BANK_BOARD_PROCEDURE.durationWeeks} нед.</strong> · сборы <strong className="text-rose-400">{formatMoney(BANK_BOARD_PROCEDURE.weeklyFee)}/нед.</strong></div>
                        <div>Реструктуризация долга: <strong className="text-emerald-400">{Math.round(BANK_BOARD_PROCEDURE.debtHaircut * 100)}%</strong> · мораторий: <strong className="text-slate-300">{BANK_BOARD_PROCEDURE.loanMoratorium ? 'да' : 'нет'}</strong></div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={fileBankruptcy}
                    disabled={!canFileBankruptcy}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg text-xs transition shadow-lg shadow-red-600/25 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Gavel className="w-4 h-4" /> Подать заявление о банкротстве
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FINANCES & LOANS TAB */}
        {activeTab === 'finances' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Казна, расходы и займы синдиката</h2>
              <p className="text-slate-400 text-sm">Управляйте кредитными лимитами, графиком погашения займов и реструктуризацией корпоративного долга.</p>
            </div>

            {gameState.bankruptcyCase && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-base mb-1">Процедура банкротства</h3>
                    <p className="text-slate-400 text-sm">
                      {(() => {
                        const definition = getProcedureDefinition(gameState.bankruptcyCase.path, gameState.bankruptcyCase.procedure);
                        return `${definition.title} · ${INITIATOR_LABELS[gameState.bankruptcyCase.initiator]} · ${PATH_LABELS[gameState.bankruptcyCase.path]}`;
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('board')}
                    className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition cursor-pointer"
                  >
                    Открыть в совете директоров
                  </button>
                </div>
                {gameState.bankruptcyCase.status === 'active' ? (
                  <div className="mt-4">
                    <div className="flex justify-between gap-2 mb-1 font-mono text-[10px] text-slate-400">
                      <span>Неделя {gameState.bankruptcyCase.weeksElapsed} из {gameState.bankruptcyCase.totalWeeks}</span>
                      <span>{Math.round((gameState.bankruptcyCase.weeksElapsed / gameState.bankruptcyCase.totalWeeks) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((gameState.bankruptcyCase.weeksElapsed / gameState.bankruptcyCase.totalWeeks) * 100))}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-emerald-400/90">{gameState.bankruptcyCase.outcomeNote ?? 'Процедура завершена.'}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                <h3 className="font-bold text-white text-base mb-4">Заявка на заём синдиката</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Сумма займа ($)</label>
                    <input 
                      type="number" 
                      value={loanAmount} 
                      onChange={e => setLoanAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-pink-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Срок (недели)</label>
                    <input 
                      type="number" 
                      value={loanTerm} 
                      onChange={e => setLoanTerm(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-pink-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Схема погашения</label>
                    <select 
                      value={loanRepaymentType} 
                      onChange={e => setLoanRepaymentType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-pink-500 outline-none"
                    >
                      <option value="fixed">Фиксированные платежи (12% процентов)</option>
                      <option value="income_share">Доля от дохода (18% процентов)</option>
                    </select>
                  </div>

                   <div className={gameState.activeLoan ? 'opacity-30 pointer-events-none' : ''}>
                   <button 
                     onClick={applyForLoan}
                     disabled={!!gameState.activeLoan}
                     className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-xs transition shadow-lg shadow-emerald-600/25 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <CreditCard className="w-4 h-4" /> Получить средства по займу
                   </button>
                   </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
                <h3 className="font-bold text-white text-base mb-4">Текущий активный кредит</h3>
                {gameState.activeLoan ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
                    <div className="flex justify-between">
                      <span>Сумма займа</span>
                      <strong className="text-emerald-400">{formatMoney(gameState.activeLoan.amount)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Остаток долга</span>
                      <strong className="text-amber-400">{formatMoney(gameState.activeLoan.remainingPrincipal)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Еженедельный платёж</span>
                      <strong className="text-white">{formatMoney(gameState.activeLoan.weeklyPayment)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Прогресс</span>
                      <strong className="text-purple-400">{gameState.activeLoan.weeksPaid}/{gameState.activeLoan.termWeeks} нед.</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Процентная ставка</span>
                      <strong className="text-pink-400">{gameState.activeLoan.interestRate * 100}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Схема</span>
                      <strong className="text-slate-300">{gameState.activeLoan.repaymentType === 'fixed' ? 'Фиксированные платежи' : 'Доля от дохода'}</strong>
                    </div>
                    <button 
                      onClick={payOffLoanEarly}
                      className="w-full bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 mt-2"
                    >
                      Досрочное погашение ({formatMoney(gameState.activeLoan.remainingPrincipal)})
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs py-8 text-center">В реестре синдиката нет активных займов и долгов.</div>
                )}
              </div>
            </div>

            {/* NOTIFICATIONS — FULL WEEKLY REPORT */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-white text-base mb-1">Уведомления — полный отчет за неделю</h3>
                  <p className="text-slate-400 text-sm">Детализация всех доходов и расходов синдиката за последнюю завершенную неделю.</p>
                </div>
                {weeklyReport && (
                  <span className="font-mono text-[10px] text-slate-400 border border-slate-700 bg-slate-950 rounded-md px-2 py-1">Неделя {weeklyReport.week}</span>
                )}
              </div>
              {weeklyReport ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-500 mb-3">Доходы</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Площадки синдиката</span><strong className="text-emerald-400">{formatSignedMoney(weeklyReport.revenue.venue)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Торговые караваны</span><strong className="text-emerald-400">{formatSignedMoney(weeklyReport.revenue.caravans)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Операции захвата</span><strong className="text-emerald-400">{formatSignedMoney(weeklyReport.revenue.captureOps)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">VIP-контракты</span><strong className="text-emerald-400">{formatSignedMoney(weeklyReport.revenue.contracts)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Процедуры салона</span><strong className="text-emerald-400">{formatSignedMoney(weeklyReport.revenue.salon)}</strong></div>
                      <div className="flex justify-between gap-2 border-t border-slate-800 pt-2"><span className="text-slate-300 font-bold">Итого доходов</span><strong className="text-emerald-300">{formatSignedMoney(weeklyReport.revenue.venue + weeklyReport.revenue.caravans + weeklyReport.revenue.captureOps + weeklyReport.revenue.contracts + weeklyReport.revenue.salon)}</strong></div>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-500 mb-3">Расходы</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Зарплата сотрудников</span><strong className="text-rose-400">-{formatMoney(weeklyReport.expenses.wages)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Содержание больницы</span><strong className="text-rose-400">-{formatMoney(weeklyReport.expenses.hospital)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Зона отдыха</span><strong className="text-rose-400">-{formatMoney(weeklyReport.expenses.restZone)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Дополнительные места в штате</span><strong className="text-rose-400">-{formatMoney(weeklyReport.expenses.staffSlots)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Платёж по кредиту</span><strong className="text-rose-400">-{formatMoney(weeklyReport.expenses.loanPayment)}</strong></div>
                      <div className="flex justify-between gap-2 border-t border-slate-800 pt-2"><span className="text-slate-300 font-bold">Итого расходов</span><strong className="text-rose-300">-{formatMoney((weeklyReport.expenses.wages + weeklyReport.expenses.hospital + weeklyReport.expenses.restZone + weeklyReport.expenses.staffSlots + weeklyReport.expenses.loanPayment))}</strong></div>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-500 mb-3">Итог недели</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Чистый доход</span><strong className={weeklyReport.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatSignedMoney(weeklyReport.netIncome)}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400">Платёж по кредиту</span><strong className="text-slate-300">-{formatMoney(weeklyReport.expenses.loanPayment)}</strong></div>
                      <div className="flex justify-between gap-2 border-t border-slate-800 pt-2"><span className="text-slate-300 font-bold">Казна на конец недели</span><strong className={weeklyReport.treasuryAfter >= 0 ? 'text-amber-300' : 'text-rose-400'}>{formatMoney(weeklyReport.treasuryAfter)}</strong></div>
                    </div>
                    <p className="mt-4 text-[10px] leading-relaxed text-slate-600">Отчет также публикуется в центре уведомлений при продвижении недели.</p>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs py-8 text-center">Финансовый отчет еще не сформирован — продвиньте неделю, чтобы получить полный отчет.</div>
              )}
            </div>

            {/* FINANCE HISTORY — charts and table */}
            <FinanceHistoryPanel reports={gameState.weeklyReports || []} />
          </div>
        )}

        {/* REGIONS TAB */}
        {activeTab === 'regions' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1">Глобальные регионы и сеть диаспор</h2>
              <p className="text-slate-400 text-sm">Обзор всех активных торговых регионов и этнических диаспор, интегрированных в сеть Emporium.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {REGIONS.map(reg => {
                const count = gameState.roster.filter(c => c.region === reg.id).length;
                return (
                  <div key={reg.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between text-left">
                    <div>
                      <h3 className="font-bold text-white text-sm mb-1">{reg.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">ID региона: {reg.id}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-500 uppercase">Оперативников</div>
                      <div className="text-base font-bold font-mono text-amber-400">{count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* META TAB — achievements, goal and records */}
        {activeTab === 'meta' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> Достижения, цель и рекорды
              </h2>
              <p className="text-slate-400 text-sm">Мета-прогресс кампании: цель синдиката, вехи-achievements и локальная таблица рекордов.</p>
            </div>

            <CampaignGoalPanel
              week={gameState.week}
              funds={gameState.funds}
              reputation={gameState.reputation}
              goalStatus={gameState.metaProgress?.goalStatus ?? 'ongoing'}
              prestigeLevel={gameState.metaProgress?.prestige.level ?? 0}
            />

            <AchievementsPanel metaProgress={gameState.metaProgress ?? { achievements: {}, stats: createEmptyLifetimeStats(), prestige: { level: 0, victories: 0 }, goalStatus: 'ongoing', endingWeek: null }} />

            <LeaderboardPanel records={gameRecords} leaderboard={leaderboard} />
          </div>
        )}

        {/* MEZZANINE — the hub map; the campaign tabs above live on top of it. */}
        {mezzanineView === 'mezzanine' && (
          <MezzanineTab
            gameState={gameState}
            onViewChange={handleMezzanineViewChange}
            onOpenTab={tab => { setActiveTab(tab); setMezzanineView(tab); setIsMobileMenuOpen(false); }}
          />
        )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        Emporium Web Edition v0.3.7 • Симулятор стратегии и управления • Все права защищены.
      </footer>
    </div>
  );
}


