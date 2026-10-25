import type { Character } from './gameEngine';

/**
 * Health points a week of duty costs an operative.
 *
 * Fatigue and health feed each other: the venue sets the base cost of the week
 * and a worn-out operative breaks down faster still. Nobody starts the campaign
 * near the hospital threshold, so without this wear nobody would ever be taken
 * to a ward — the clinic, the rest zone and the hospital only have work to do
 * because working costs something.
 */
export function weeklyHealthWear(venue: Character['assignedVenue'], exhaustion: number): number {
  // «Без работы»: no shifts, so the week costs no health and fatigue heals back.
  if (venue === 'unassigned') {
    return -Math.min(2, Math.floor(Math.max(0, Math.min(100, exhaustion)) / 25));
  }
  const shiftCost = venue && venue !== 'trade' ? 2 : 1;
  const fatigueCost = Math.floor(Math.max(0, Math.min(100, exhaustion)) / 25);
  return shiftCost + fatigueCost;
}

export interface ExhaustionUpgrade {
  venueId: 'pleasure_house' | 'strip_club' | 'beauty_salon';
  venueName: string;
  level: number; // 0 to 3
  maxLevel: number;
  costs: number[];
  effectDescriptions: string[];
}

export const EXHAUSTION_UPGRADES: Record<'pleasure_house' | 'strip_club' | 'beauty_salon', ExhaustionUpgrade> = {
  pleasure_house: {
    venueId: 'pleasure_house',
    venueName: 'Дом удовольствия',
    level: 0,
    maxLevel: 3,
    costs: [0, 20000, 50000, 100000],
    effectDescriptions: [
      'Стандартное восстановление усталости.',
      'Уровень 1: -15% к накоплению усталости персонала.',
      'Уровень 2: -30% усталости и +15% к восстановлению за смену.',
      'Уровень 3: полный иммунитет к усталости и автоматические смены оздоровления.'
    ]
  },
  strip_club: {
    venueId: 'strip_club',
    venueName: 'Стрип-клуб',
    level: 0,
    maxLevel: 3,
    costs: [0, 25000, 60000, 120000],
    effectDescriptions: [
      'Стандартное восстановление усталости.',
      'Уровень 1: -15% к накоплению усталости танцовщиц.',
      'Уровень 2: -30% усталости и VIP-зона отдыха для гостей.',
      'Уровень 3: полноценная зона отдыха за сценой и нулевое выгорание.'
    ]
  },
  beauty_salon: {
    venueId: 'beauty_salon',
    venueName: 'Салон красоты',
    level: 0,
    maxLevel: 15000,
    costs: [0, 15000, 40000, 90000],
    effectDescriptions: [
      'Стандартное управление временем персонала и клиентов.',
      'Уровень 1: оптимизированное расписание (-10% времени на процедуру).',
      'Уровень 2: улучшенная эргономика (-25% времени и расходников).',
      'Уровень 3: мастерское управление спа-комплексом (нулевые затраты времени персонала).'
    ]
  }
};
