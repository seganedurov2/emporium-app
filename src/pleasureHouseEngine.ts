/**
 * Улучшения «Дома удовольствия» — четыре независимых трека прокачки
 * (БДСМ-услуги, фетиш-услуги, алкоголь, комнаты), каждый по 3 уровня.
 *
 * Структура повторяет EXHAUSTION_UPGRADES: уровни 0..3, стоимость
 * индексируется номером уровня, описания эффектов — текущим уровнем.
 */
export type PleasureHouseUpgradeId = 'bdsm_services' | 'fetish_services' | 'alcohol_service' | 'room_upgrades';

export interface PleasureHouseUpgrade {
  id: PleasureHouseUpgradeId;
  name: string;
  tagline: string;
  maxLevel: number;
  costs: number[];
  effectDescriptions: string[];
}

export const PLEASURE_HOUSE_UPGRADES: Record<PleasureHouseUpgradeId, PleasureHouseUpgrade> = {
  bdsm_services: {
    id: 'bdsm_services',
    name: 'БДСМ-услуги',
    tagline: 'Оказание БДСМ-услуг клиентам дома удовольствия',
    maxLevel: 3,
    costs: [0, 30000, 75000, 150000],
    effectDescriptions: [
      'Стандартный перечень услуг.',
      'Уровень 1: оборудованный БДСМ-кабинет, +15% дохода дома удовольствия.',
      'Уровень 2: тренировочная комната и подготовленный персонал, +30% дохода.',
      'Уровень 3: полная БДСМ-программа для VIP-клиентов, +45% дохода.'
    ]
  },
  fetish_services: {
    id: 'fetish_services',
    name: 'Фетиш-услуги',
    tagline: 'Премиальные фетиш-услуги по запросу',
    maxLevel: 3,
    costs: [0, 25000, 60000, 120000],
    effectDescriptions: [
      'Стандартный перечень услуг.',
      'Уровень 1: фетиш-каталог и реквизит, +10% дохода дома удовольствия.',
      'Уровень 2: персональные фетиш-сессии, +20% дохода.',
      'Уровень 3: эксклюзивные фетиш-вечера для постоянцев, +30% дохода.'
    ]
  },
  alcohol_service: {
    id: 'alcohol_service',
    name: 'Алкоголь',
    tagline: 'Расширенная барная карта и запасы алкоголя',
    maxLevel: 3,
    costs: [0, 15000, 40000, 80000],
    effectDescriptions: [
      'Базовое барное обслуживание.',
      'Уровень 1: больше алкоголя в зале, +8% дохода, +2 усталости за смену.',
      'Уровень 2: барная карта премиум-класса, +16% дохода, +4 усталости за смену.',
      'Уровень 3: круглосуточное барное обслуживание, +24% дохода, +6 усталости за смену.'
    ]
  },
  room_upgrades: {
    id: 'room_upgrades',
    name: 'Улучшение комнат',
    tagline: 'Комфорт и обстановка номеров дома удовольствия',
    maxLevel: 3,
    costs: [0, 20000, 50000, 100000],
    effectDescriptions: [
      'Стандартные номера.',
      'Уровень 1: обновлённая обстановка, -10% накопления усталости.',
      'Уровень 2: люксовые номера и зоны восстановления, -20% усталости.',
      'Уровень 3: персональные апартаменты для каждого работника, -30% усталости.'
    ]
  }
};

export const PLEASURE_HOUSE_UPGRADE_IDS: PleasureHouseUpgradeId[] = [
  'bdsm_services',
  'fetish_services',
  'alcohol_service',
  'room_upgrades'
];

/** Множитель выручки дома удовольствия с учётом сервисных треков. */
export function pleasureHouseRevenueMultiplier(
  upgrades: Partial<Record<PleasureHouseUpgradeId, number>>
): number {
  return 1
    + 0.15 * (upgrades.bdsm_services ?? 0)
    + 0.10 * (upgrades.fetish_services ?? 0)
    + 0.08 * (upgrades.alcohol_service ?? 0);
}

/**
 * Базовый прирост усталости смены в доме удовольствия с учётом
 * комфорта комнат и алкогольной нагрузки.
 */
export function pleasureHouseExhaustionBump(
  upgrades: Partial<Record<PleasureHouseUpgradeId, number>>,
  baseBump: number
): number {
  const roomReduction = 0.10 * (upgrades.room_upgrades ?? 0);
  const alcoholPenalty = 2 * (upgrades.alcohol_service ?? 0);
  return Math.max(1, Math.round(baseBump * (1 - roomReduction))) + alcoholPenalty;
}
