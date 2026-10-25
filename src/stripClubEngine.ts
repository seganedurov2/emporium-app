/**
 * Улучшения «Стрип-клуба» — пять независимых треков прокачки:
 * места для клиентов и персонала, места для танцовщиц, VIP-зоны,
 * еда и алкоголь, интерьер и музыка. Каждый трек — 3 уровня.
 *
 * Структура повторяет PLEASURE_HOUSE_UPGRADES: уровни 0..3, стоимость
 * индексируется номером уровня, описания эффектов — текущим уровнем.
 */
export type StripClubUpgradeId =
  | 'client_capacity'
  | 'dancer_capacity'
  | 'vip_zones'
  | 'food_alcohol'
  | 'interior_music';

export interface StripClubUpgrade {
  id: StripClubUpgradeId;
  name: string;
  tagline: string;
  maxLevel: number;
  costs: number[];
  effectDescriptions: string[];
}

export const STRIP_CLUB_UPGRADES: Record<StripClubUpgradeId, StripClubUpgrade> = {
  client_capacity: {
    id: 'client_capacity',
    name: 'Места для клиентов и персонала',
    tagline: 'Вместимость зала и штат обслуживающего персонала',
    maxLevel: 3,
    costs: [0, 20000, 50000, 100000],
    effectDescriptions: [
      'Стандартная вместимость зала.',
      'Уровень 1: расширенный зал и барная стойка, +10% дохода стрип-клуба.',
      'Уровень 2: второй этаж и VIP-обслуживание, +20% дохода.',
      'Уровень 3: грандиозный зал на всех гостей, +30% дохода.'
    ]
  },
  dancer_capacity: {
    id: 'dancer_capacity',
    name: 'Места для танцовщиц',
    tagline: 'Сцена, раздевалки и гримёрки для танцовщиц',
    maxLevel: 3,
    costs: [0, 25000, 60000, 120000],
    effectDescriptions: [
      'Одна сцена и общая гримёрка.',
      'Уровень 1: вторая сцена и отдельные кабинки, +12% дохода стрип-клуба.',
      'Уровень 2: зал танцевальных номеров и приватные кабинеты, +24% дохода.',
      'Уровень 3: три сцены и люксовые гримёрки, +36% дохода.'
    ]
  },
  vip_zones: {
    id: 'vip_zones',
    name: 'Улучшение VIP-зон',
    tagline: 'Приватные ложи и обслуживание постоянных клиентов',
    maxLevel: 3,
    costs: [0, 30000, 75000, 150000],
    effectDescriptions: [
      'Стандартный зал без выделенных зон.',
      'Уровень 1: оборудованные VIP-ложи, +15% дохода стрип-клуба.',
      'Уровень 2: приватные салоны с баром, +30% дохода.',
      'Уровень 3: элитные апартаменты для постоянцев, +45% дохода.'
    ]
  },
  food_alcohol: {
    id: 'food_alcohol',
    name: 'Еда и алкоголь',
    tagline: 'Кухня и барная карта стрип-клуба',
    maxLevel: 3,
    costs: [0, 15000, 40000, 80000],
    effectDescriptions: [
      'Базовое барное обслуживание.',
      'Уровень 1: расширенное меню и закуски, +8% дохода, +2 усталости за смену.',
      'Уровень 2: кухня премиум-класса и импортный алкоголь, +16% дохода, +4 усталости.',
      'Уровень 3: круглосуточное обслуживание номеров, +24% дохода, +6 усталости.'
    ]
  },
  interior_music: {
    id: 'interior_music',
    name: 'Интерьер и музыка',
    tagline: 'Атмосфера зала, свет и звук',
    maxLevel: 3,
    costs: [0, 18000, 45000, 90000],
    effectDescriptions: [
      'Стандартный интерьер и фоновая музыка.',
      'Уровень 1: дизайнерский интерьер и диджей-пульт, -10% накопления усталости.',
      'Уровень 2: световые шоу и живое звучание, -20% усталости.',
      'Уровень 3: иммерсивная сцена с оркестровой ямой, -30% усталости.'
    ]
  }
};

export const STRIP_CLUB_UPGRADE_IDS: StripClubUpgradeId[] = [
  'client_capacity',
  'dancer_capacity',
  'vip_zones',
  'food_alcohol',
  'interior_music'
];

/** Множитель выручки стрип-клуба с учётом сервисных треков. */
export function stripClubRevenueMultiplier(
  upgrades: Partial<Record<StripClubUpgradeId, number>>
): number {
  return 1
    + 0.10 * (upgrades.client_capacity ?? 0)
    + 0.12 * (upgrades.dancer_capacity ?? 0)
    + 0.15 * (upgrades.vip_zones ?? 0)
    + 0.08 * (upgrades.food_alcohol ?? 0);
}

/**
 * Базовый прирост усталости смены в стрип-клубе с учётом комфорта
 * интерьера/музыки и алкогольной нагрузки.
 */
export function stripClubExhaustionBump(
  upgrades: Partial<Record<StripClubUpgradeId, number>>,
  baseBump: number
): number {
  const interiorReduction = 0.10 * (upgrades.interior_music ?? 0);
  const alcoholPenalty = 2 * (upgrades.food_alcohol ?? 0);
  return Math.max(1, Math.round(baseBump * (1 - interiorReduction))) + alcoholPenalty;
}
