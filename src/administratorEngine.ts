/**
 * Администраторы площадок — NPC-менеджеры зон синдиката.
 *
 * Каждый администратор нанимает сотрудников и еженедельно выдаёт
 * запросы и предложения по улучшению своей зоны: покупку мест
 * (базовое число мест — 100), улучшения или найм персонала.
 * Все предложения выносятся с учётом доходов и расходов: администратор
 * читает финансовый отчёт прошлой недели и не советует тратить
 * казну, когда синдикат работает в убыток.
 */
import type { Character, WeeklyFinanceReport } from './gameEngine';
import type { BeautySalonState } from './beautySalonEngine';
import { SALON_LEVELS } from './beautySalonEngine';
import type { PleasureHouseUpgradeId } from './pleasureHouseEngine';
import { PLEASURE_HOUSE_UPGRADES, PLEASURE_HOUSE_UPGRADE_IDS } from './pleasureHouseEngine';
import type { StripClubUpgradeId } from './stripClubEngine';
import { STRIP_CLUB_UPGRADES, STRIP_CLUB_UPGRADE_IDS } from './stripClubEngine';
import type {
  AuxiliaryBuildingState,
  BuildingId,
  Employee,
  EmployeeSpecialty
} from './expansionTypes';
import { specialtyDefinitionOf } from './employeesEngine';
import { getBuildingActionCost, getBuildingDefinition } from './buildingsEngine';
import type { RestZoneState } from './restZoneEngine';
import {
  REST_SEAT_UPKEEP,
  nextRestSeatCost,
  recommendedAttendantCount
} from './restZoneEngine';
import { formatMoney } from './currency';

/** Площадки с purchasable capacity (базовое число мест: 100). */
export type VenueId =
  | 'pleasure_house'
  | 'strip_club'
  | 'beauty_salon'
  | 'auction_house'
  | 'bdsm_room';

/** Зона отдыха живёт в своём движке, но её администратор выдаёт запросы в той же очереди. */
export type RequestVenueId = VenueId | 'rest_zone';

export type VenueRequestType = 'hire' | 'upgrade' | 'expansion';
export type VenueRequestPriority = 'Low' | 'Medium' | 'High';

/**
 * Запрос/предложение администратора. Форма совпадает с
 * `ManagedCampaignState.venueRequests`; `target` — машинночитаемая
 * цель эффекта (трек улучшения, специальность для найма, 'seat').
 */
export interface VenueAdministratorRequest {
  requestId: string;
  type: VenueRequestType;
  description: string;
  cost: number;
  benefit: string;
  priority: VenueRequestPriority;
  target?: string;
}

export interface VenueAdministratorProfile {
  venue: RequestVenueId;
  /** Должность администратора. */
  role: string;
  /** Имя управляющего (он или она). */
  name: string;
  workplace: string;
  /** Роли, доступные на рабочем месте зоны. */
  workplaceRoles: string[];
  blurb: string;
}

export const VENUE_ADMINISTRATORS: Record<RequestVenueId, VenueAdministratorProfile> = {
  rest_zone: {
    venue: 'rest_zone',
    role: 'Администратор зоны отдыха',
    name: 'Ада Вельская',
    workplace: 'Зона отдыха',
    workplaceRoles: ['Смотритель зоны отдыха'],
    blurb: 'Нанимает смотрителей и расширяет места восстановления, следя за расходами синдиката.'
  },
  pleasure_house: {
    venue: 'pleasure_house',
    role: 'Администратор дома удовольствия',
    name: 'Мариса Калье',
    workplace: 'Дом удовольствия',
    workplaceRoles: ['Работница дома удовольствия'],
    blurb: 'Продаёт клиентам больше мест и услуг, скупая вместимость только когда доходы это позволяют.'
  },
  strip_club: {
    venue: 'strip_club',
    role: 'Администратор стрип-клуба',
    name: 'Роксана Дюваль',
    workplace: 'Стрип-клуб',
    workplaceRoles: ['Танцовщица', 'Работник стрип-клуба'],
    blurb: 'Ведёт зал и кассу клуба; в клубе работают только пленницы или работники клуба.'
  },
  beauty_salon: {
    venue: 'beauty_salon',
    role: 'Администратор салона красоты',
    name: 'Оливия Стрэнг',
    workplace: 'Салон красоты',
    workplaceRoles: ['Мастер салона'],
    blurb: 'Закупает рабочие места и расходники, сверяясь с выручкой и зарплатным фондом.'
  },
  auction_house: {
    venue: 'auction_house',
    role: 'Администратор аукционного дома',
    name: 'Тимур Астори',
    workplace: 'Аукционный дом',
    workplaceRoles: ['Аукционист', 'Оценщик товаров'],
    blurb: 'Выставляет лоты и нанимает аукционистов с оценщиками, считая каждый рубль дохода.'
  },
  bdsm_room: {
    venue: 'bdsm_room',
    role: 'Администратор БДСМ-комнаты',
    name: 'Госпожа Вера',
    workplace: 'БДСМ-комната',
    workplaceRoles: ['Уборщик', 'Уборщица (госпожа)'],
    blurb: 'Рабочее место — БДСМ-комната: уборщик или уборщица (госпожа) держат порядок и покорность.'
  }
};

/** Базовое число мест каждой площадки. */
export const VENUE_BASE_CAPACITY = 100;
/** Цена первого купленного места сверх базовых 100. */
export const VENUE_SEAT_BASE_COST = 5000;
/** Каждое следующее место дороже предыдущего на эту долю. */
export const VENUE_SEAT_COST_GROWTH = 0.15;
/** Недельное содержание одного купленного места. */
export const VENUE_SEAT_UPKEEP = 60;

/** Цена следующего места площадки. */
export function nextVenueSeatCost(capacity: number): number {
  const extraSeats = Math.max(0, capacity - VENUE_BASE_CAPACITY);
  return Math.round(VENUE_SEAT_BASE_COST * Math.pow(1 + VENUE_SEAT_COST_GROWTH, extraSeats));
}

/** Недельное содержание купленных мест (базовые 100 — бесплатно). */
export function venueSeatUpkeep(capacity: number): number {
  return Math.max(0, capacity - VENUE_BASE_CAPACITY) * VENUE_SEAT_UPKEEP;
}

export interface VenueSeatQuote {
  cost: number;
  affordable: boolean;
  seatsAfter: number;
  upkeep: number;
}

/** Цена следующего места, или null, когда казна не тянет. */
export function quoteVenueSeat(
  capacity: number,
  funds: number
): VenueSeatQuote {
  const cost = nextVenueSeatCost(capacity);
  return {
    cost,
    affordable: funds >= cost,
    seatsAfter: capacity + 1,
    upkeep: venueSeatUpkeep(capacity + 1)
  };
}

/** Доходы, расходы и чистый доход прошлой недели — основа всех предложений. */
export interface VenueFinanceSnapshot {
  weeklyIncome: number;
  weeklyExpenses: number;
  netIncome: number;
  /** Синдикат не работает в убыток. */
  healthy: boolean;
}

export function venueFinanceSnapshot(report: WeeklyFinanceReport | null): VenueFinanceSnapshot {
  if (!report) return { weeklyIncome: 0, weeklyExpenses: 0, netIncome: 0, healthy: true };
  const weeklyIncome = report.revenue.venue + report.revenue.salon;
  const weeklyExpenses = report.expenses.wages
    + report.expenses.hospital
    + report.expenses.restZone
    + report.expenses.staffSlots
    + (report.expenses.loanPayment ?? 0)
    + (report.expenses.city ?? 0);
  return {
    weeklyIncome,
    weeklyExpenses,
    netIncome: report.netIncome,
    healthy: report.netIncome >= 0
  };
}

/**
 * Приоритет предложения: High — казна и доходы позволяют вернуть вложения
 * за ~5 недель; Medium — позволяют просто оплатить; Low — либо денег нет,
 * либо синдикат в убытке и тратить рискованно.
 */
function requestPriority(
  cost: number,
  funds: number,
  finance: VenueFinanceSnapshot
): VenueRequestPriority {
  if (funds < cost) return 'Low';
  if (!finance.healthy) return 'Low';
  if (finance.netIncome >= cost * 0.2) return 'High';
  return 'Medium';
}

export interface VenueRequestContext {
  week: number;
  funds: number;
  venueCapacity: Record<VenueId, number>;
  lastWeeklyReport: WeeklyFinanceReport | null;
  pleasureHouseUpgrades: Record<PleasureHouseUpgradeId, number>;
  stripClubUpgrades: Record<StripClubUpgradeId, number>;
  beautySalon: BeautySalonState;
  employees: Employee[];
  auxiliaryBuildings: AuxiliaryBuildingState[];
  roster: Character[];
  restZone: RestZoneState;
}

const VENUE_ORDER: VenueId[] = [
  'pleasure_house',
  'strip_club',
  'beauty_salon',
  'auction_house',
  'bdsm_room'
];

const VENUE_LABELS: Record<VenueId, string> = {
  pleasure_house: 'Дом удовольствия',
  strip_club: 'Стрип-клуб',
  beauty_salon: 'Салон красоты',
  auction_house: 'Аукционный дом',
  bdsm_room: 'БДСМ-комната'
};

/** Человеческое название площадки. */
export function venueLabel(venue: RequestVenueId): string {
  if (venue === 'rest_zone') return 'Зона отдыха';
  return VENUE_LABELS[venue];
}

interface UpgradeCandidate {
  target: string;
  cost: number;
  benefit: string;
  name: string;
}

/** Следующий доступный трек улучшений дома удовольствия. */
function nextPleasureHouseUpgrade(
  upgrades: Record<PleasureHouseUpgradeId, number>
): UpgradeCandidate | null {
  for (const trackId of PLEASURE_HOUSE_UPGRADE_IDS) {
    const upgrade = PLEASURE_HOUSE_UPGRADES[trackId];
    const level = upgrades[trackId] ?? 0;
    if (level < upgrade.maxLevel) {
      return {
        target: trackId,
        cost: upgrade.costs[level + 1],
        benefit: upgrade.effectDescriptions[level + 1],
        name: upgrade.name
      };
    }
  }
  return null;
}

/** Следующий доступный трек улучшений стрип-клуба. */
function nextStripClubUpgrade(
  upgrades: Record<StripClubUpgradeId, number>
): UpgradeCandidate | null {
  for (const trackId of STRIP_CLUB_UPGRADE_IDS) {
    const upgrade = STRIP_CLUB_UPGRADES[trackId];
    const level = upgrades[trackId] ?? 0;
    if (level < upgrade.maxLevel) {
      return {
        target: trackId,
        cost: upgrade.costs[level + 1],
        benefit: upgrade.effectDescriptions[level + 1],
        name: upgrade.name
      };
    }
  }
  return null;
}

/** Следующий уровень салона красоты. */
function nextSalonUpgrade(salon: BeautySalonState): UpgradeCandidate | null {
  const levelInfo = SALON_LEVELS.find(level => level.level === salon.level + 1);
  if (!levelInfo) return null;
  return {
    target: 'salon_level',
    cost: levelInfo.upgradeCost,
    benefit: `«${levelInfo.name}»: ${levelInfo.workstations} рабочих места, расходники ${levelInfo.supplyCapacity}.`,
    name: 'Уровень салона'
  };
}

/** Предложение о покупке ещё одного места площадки. */
function seatExpansionRequest(
  venue: VenueId,
  context: VenueRequestContext,
  finance: VenueFinanceSnapshot
): VenueAdministratorRequest {
  const capacity = context.venueCapacity[venue] ?? VENUE_BASE_CAPACITY;
  const quote = quoteVenueSeat(capacity, context.funds);
  return {
    requestId: `${venue}_seat_${context.week}`,
    type: 'expansion',
    target: 'seat',
    description: `Купить ещё одно место для «${VENUE_LABELS[venue]}» (сейчас ${capacity}, будет ${quote.seatsAfter}). Содержание нового места — ${formatMoney(quote.upkeep)}/нед.`,
    cost: quote.cost,
    benefit: '+1 место: больше работников на площадке и выше потенциальная выручка.',
    priority: requestPriority(quote.cost, context.funds, finance)
  };
}

/**
 * Площадки «дом удовольствия / стрип-клуб / салон красоты»: администратор
 * чередует предложения об улучшениях и покупке мест, но только когда
 * доходы покрывают расходы — в убыток предлагает копить.
 */
function seatVenueRequest(
  venue: 'pleasure_house' | 'strip_club' | 'beauty_salon',
  context: VenueRequestContext,
  finance: VenueFinanceSnapshot
): VenueAdministratorRequest {
  const upgrade = venue === 'pleasure_house'
    ? nextPleasureHouseUpgrade(context.pleasureHouseUpgrades)
    : venue === 'strip_club'
      ? nextStripClubUpgrade(context.stripClubUpgrades)
      : nextSalonUpgrade(context.beautySalon);

  // Улучшение предлагается, когда оно есть, финансы здоровы и
  // либо все треки ещё на нуле, либо пришла очередь по неделе.
  const allTracksFresh = venue === 'pleasure_house'
    ? PLEASURE_HOUSE_UPGRADE_IDS.every(id => (context.pleasureHouseUpgrades[id] ?? 0) === 0)
    : venue === 'strip_club'
      ? STRIP_CLUB_UPGRADE_IDS.every(id => (context.stripClubUpgrades[id] ?? 0) === 0)
      : context.beautySalon.level <= 1;
  const upgradeTurn = (context.week + VENUE_ORDER.indexOf(venue)) % 3 === 0;

  if (upgrade && finance.healthy && (allTracksFresh || upgradeTurn)) {
    return {
      requestId: `${venue}_upgrade_${context.week}`,
      type: 'upgrade',
      target: upgrade.target,
      description: `Улучшить «${VENUE_LABELS[venue]}»: ${upgrade.name}.`,
      cost: upgrade.cost,
      benefit: upgrade.benefit,
      priority: requestPriority(upgrade.cost, context.funds, finance)
    };
  }

  return seatExpansionRequest(venue, context, finance);
}

/**
 * Специальности, посты которых открыты в здании, но не заняты
 * действующим сотрудником.
 */
function missingBuildingSpecialties(
  building: AuxiliaryBuildingState,
  employees: Employee[]
): EmployeeSpecialty[] {
  const definition = getBuildingDefinition(building.id);
  const missing: EmployeeSpecialty[] = [];
  const accepted = [
    ...definition.compatibleSpecialties,
    ...(definition.optionalSpecialties ?? [])
  ];
  for (const specialty of accepted) {
    const posted = building.assignedEmployeeIds.some(id => {
      const employee = employees.find(item => item.id === id);
      return Boolean(employee && employee.status === 'active' && employee.specialty === specialty);
    });
    if (!posted && !missing.includes(specialty)) missing.push(specialty);
  }
  return missing;
}

/**
 * Аукционный дом и БДСМ-комната — вспомогательные здания: администратор
 * сначала просит построить, потом нанять персонал, потом улучшить,
 * и только потом докупать места.
 */
function buildingVenueRequest(
  venue: 'auction_house' | 'bdsm_room',
  context: VenueRequestContext,
  finance: VenueFinanceSnapshot
): VenueAdministratorRequest {
  const buildingId: BuildingId = venue;
  const building = context.auxiliaryBuildings.find(item => item.id === buildingId);
  const definition = getBuildingDefinition(buildingId);

  if (!building || building.level <= 0) {
    const cost = getBuildingActionCost(building ?? { id: buildingId, level: 0, assignedEmployeeIds: [] });
    return {
      requestId: `${venue}_build_${context.week}`,
      type: 'upgrade',
      target: 'construct',
      description: `Построить «${definition.name}»: ${definition.shortDescription}`,
      cost: cost ?? 0,
      benefit: definition.effectDescriptions[1] ?? 'Открывает новый пост синдиката.',
      priority: requestPriority(cost ?? 0, context.funds, finance)
    };
  }

  const missing = missingBuildingSpecialties(building, context.employees);
  if (missing.length > 0) {
    const specialty = missing[0];
    const specialtyDef = specialtyDefinitionOf(specialty);
    const wage = specialtyDef.wageRange[0];
    return {
      requestId: `${venue}_hire_${specialty}_${context.week}`,
      type: 'hire',
      target: specialty,
      description: `Нанять ${specialtyDef.role.toLowerCase()} для «${definition.name}» (пост свободен, зарплата от ${formatMoney(wage)}/нед.).`,
      cost: 0,
      benefit: `Здание заработает в полную силу: ${definition.effectDescriptions[building.level] ?? ''}`.trim(),
      priority: finance.healthy ? 'High' : 'Low'
    };
  }

  const actionCost = getBuildingActionCost(building);
  if (actionCost !== null) {
    return {
      requestId: `${venue}_upgrade_${context.week}`,
      type: 'upgrade',
      target: 'building_level',
      description: `Улучшить «${definition.name}» до уровня ${building.level + 1}.`,
      cost: actionCost,
      benefit: definition.effectDescriptions[building.level + 1] ?? 'Больше эффекта от здания.',
      priority: requestPriority(actionCost, context.funds, finance)
    };
  }

  return seatExpansionRequest(venue, context, finance);
}

/**
 * Зона отдыха: администратор нанимает смотрителей (его главная работа)
 * и докупает места восстановления — с учётом доходов и расходов.
 */
function restZoneRequest(
  context: VenueRequestContext,
  finance: VenueFinanceSnapshot
): VenueAdministratorRequest {
  const recommended = recommendedAttendantCount(context.restZone.seats);
  const posted = context.restZone.attendantIds.length;

  if (posted < recommended) {
    return {
      requestId: `rest_zone_hire_attendant_${context.week}`,
      type: 'hire',
      target: 'attendant',
      description: `Нанять смотрителя зоны отдыха (постов занято ${posted} из рекомендуемых ${recommended}).`,
      cost: 0,
      benefit: 'Смотритель сам отправляет уставших оперативников на программу восстановления и повышает покорность отдыхающих.',
      priority: finance.healthy ? 'High' : 'Low'
    };
  }

  const cost = nextRestSeatCost(context.restZone);
  return {
    requestId: `rest_zone_seat_${context.week}`,
    type: 'expansion',
    target: 'seat',
    description: `Купить ещё одно место в зоне отдыха (сейчас ${context.restZone.seats}, будет ${context.restZone.seats + 1}). Содержание ${formatMoney(REST_SEAT_UPKEEP)}/нед. за место.`,
    cost,
    benefit: '+1 место восстановления для оперативников синдиката.',
    priority: requestPriority(cost, context.funds, finance)
  };
}

/**
 * Генерирует свежие запросы всех администраторов на текущую неделю.
 * Вызывается после подсчёта финансового отчёта, так что каждое
 * предложение уже учитывает доходы и расходы прошедшей недели.
 */
export function generateVenueRequests(
  context: VenueRequestContext
): Record<RequestVenueId, VenueAdministratorRequest | null> {
  const finance = venueFinanceSnapshot(context.lastWeeklyReport);
  return {
    rest_zone: restZoneRequest(context, finance),
    pleasure_house: seatVenueRequest('pleasure_house', context, finance),
    strip_club: seatVenueRequest('strip_club', context, finance),
    beauty_salon: seatVenueRequest('beauty_salon', context, finance),
    auction_house: buildingVenueRequest('auction_house', context, finance),
    bdsm_room: buildingVenueRequest('bdsm_room', context, finance)
  };
}

/**
 * Правило комплектации стрип-клуба: в клубе работают только
 * пленники (рабы) или уже работники стрип-клуба.
 */
export function canWorkInStripClub(character: Character): boolean {
  return character.isSlave === true || character.assignedVenue === 'strip_club';
}

/** Причина отказа в назначении в стрип-клуб, или null когда назначение законно. */
export function stripClubAssignmentError(character: Character): string | null {
  if (canWorkInStripClub(character)) return null;
  return `${character.name} не может работать в стрип-клубе: в клубе только пленники или работники клуба.`;
}

/** Рабочие места БДСМ-комнаты: уборщик или уборщица (госпожа). */
export const BDSM_WORKPLACE_ROLES: readonly string[] = [
  'Уборщик',
  'Уборщица (госпожа)'
] as const;

/** Специальность, соответствующая роли на рабочем месте БДСМ-комнаты. */
export function bdsmSpecialtyForRole(role: string): EmployeeSpecialty | null {
  if (role === 'Уборщик') return 'janitor';
  if (role.includes('госпожа')) return 'mistress';
  return null;
}
