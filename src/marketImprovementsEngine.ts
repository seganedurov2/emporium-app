/**
 * Улучшения глобального рынка — пять независимых треков прокачки,
 * которые предлагает еженедельно администратор аукционного дома
 * и финансист рынка. Треки делятся по автору:
 *
 *  • администратор (Тимур Астори): сеть покупателей, маркетинговые
 *    исследования и логистика поставок — операционная сторона рынка;
 *  • финансист (Грета Кёлер): управление рисками и торговое
 *    финансирование — денежная сторона сделок.
 *
 * Эффекты треков агрегируются в {@link marketImprovementEffects} и
 * применяются движком контрактов (`slaveContractsEngine.ts`).
 */
import type { WeeklyFinanceReport } from './gameEngine';
import { venueFinanceSnapshot, type VenueFinanceSnapshot } from './administratorEngine';
import { AUCTION_HOUSE_ADMINISTRATOR } from './auctionHouseEngine';

export type MarketImprovementId =
  | 'buyer_network'
  | 'market_research'
  | 'logistics'
  | 'risk_management'
  | 'trade_financing';

/** Кто выносит предложение: администратор аукционного дома или финансист. */
export type MarketImprovementAuthor = 'administrator' | 'financier';

export interface MarketImprovementTrack {
  id: MarketImprovementId;
  name: string;
  tagline: string;
  author: MarketImprovementAuthor;
  maxLevel: number;
  /** Стоимость перехода на уровень N (индекс N); costs[0] не используется. */
  costs: number[];
  effectDescriptions: string[];
}

export const MARKET_IMPROVEMENT_TRACKS: Record<MarketImprovementId, MarketImprovementTrack> = {
  buyer_network: {
    id: 'buyer_network',
    name: 'Сеть покупателей',
    tagline: 'Брокеры и посредники, расширяющие круг легальных покупателей',
    author: 'administrator',
    maxLevel: 5,
    costs: [0, 20000, 45000, 90000, 160000, 250000],
    effectDescriptions: [
      'Базовая сеть покупателей.',
      'Уровень 1: первые брокерские контакты, +8% к ценам контрактов покупателей.',
      'Уровень 2: региональные агенты, +16% к ценам контрактов.',
      'Уровень 3: дипломатические каналы, +24% к ценам контрактов.',
      'Уровень 4: привилегированные покупатели, +32% к ценам контрактов.',
      'Уровень 5: закрытый клуб покупателей, +40% к ценам контрактов.'
    ]
  },
  market_research: {
    id: 'market_research',
    name: 'Маркетинговые исследования',
    tagline: 'Аналитика спроса, увеличивающая размер заказов покупателей',
    author: 'administrator',
    maxLevel: 5,
    costs: [0, 15000, 35000, 70000, 120000, 190000],
    effectDescriptions: [
      'Базовая аналитика спроса.',
      'Уровень 1: отчёты по спросу, +1 пленник к заказам покупателей.',
      'Уровень 2: профили покупателей, +2 пленника к заказам.',
      'Уровень 3: прогнозы рынка, +3 пленника к заказам.',
      'Уровень 4: эксклюзивные заказы, +4 пленника к заказам.',
      'Уровень 5: полный охват рынка, +5 пленников к заказам.'
    ]
  },
  logistics: {
    id: 'logistics',
    name: 'Логистика поставок',
    tagline: 'Маршруты и склады, удешевляющие закупки на рынке',
    author: 'administrator',
    maxLevel: 5,
    costs: [0, 18000, 40000, 80000, 140000, 220000],
    effectDescriptions: [
      'Базовые маршруты.',
      'Уровень 1: собственные караванные пути, +3% скидки партнёра и -4% к цене лотов.',
      'Уровень 2: региональные склады, +6% скидки и -8% к цене лотов.',
      'Уровень 3: экспедиторы, +9% скидки и -12% к цене лотов.',
      'Уровень 4: сопровождение грузов, +12% скидки и -16% к цене лотов.',
      'Уровень 5: монополия на маршруты, +15% скидки и -20% к цене лотов.'
    ]
  },
  risk_management: {
    id: 'risk_management',
    name: 'Управление рисками',
    tagline: 'Страховки и юридическое прикрытие сделок',
    author: 'financier',
    maxLevel: 5,
    costs: [0, 22000, 50000, 100000, 175000, 270000],
    effectDescriptions: [
      'Базовая оценка рисков.',
      'Уровень 1: страховки сделок, -2 п.п. риска скандала.',
      'Уровень 2: юридическое прикрытие, -4 п.п. риска.',
      'Уровень 3: офшорные структуры, -6 п.п. риска.',
      'Уровень 4: компромат на проверяющих, -8 п.п. риска.',
      'Уровень 5: полная невидимость, -10 п.п. риска.'
    ]
  },
  trade_financing: {
    id: 'trade_financing',
    name: 'Торговое финансирование',
    tagline: 'Кредиты и авансы, повышающие выручку от сделок',
    author: 'financier',
    maxLevel: 5,
    costs: [0, 25000, 55000, 110000, 190000, 300000],
    effectDescriptions: [
      'Базовый расчёт по сделкам.',
      'Уровень 1: авансы покупателей, +6% к выручке от контрактов.',
      'Уровень 2: факторинг, +12% к выручке.',
      'Уровень 3: кредитные линии, +18% к выручке.',
      'Уровень 4: синдикация сделок, +24% к выручке.',
      'Уровень 5: финансовая империя, +30% к выручке.'
    ]
  }
};

export const MARKET_IMPROVEMENT_IDS: MarketImprovementId[] = [
  'buyer_network',
  'market_research',
  'logistics',
  'risk_management',
  'trade_financing'
];

/** Финансист рынка — NPC, предлагающий денежные улучшения рынка. */
export const MARKET_FINANCIER = {
  name: 'Грета Кёлер',
  role: 'Финансист рынка',
  workplace: 'Глобальный рынок',
  blurb: 'Считает маржу каждой сделки, страхует риски и финансирует торговые операции синдиката.'
};

/** Администратор, отвечающий за операционные улучшения рынка. */
export const MARKET_ADMINISTRATOR_NAME = AUCTION_HOUSE_ADMINISTRATOR;

/** Агрегированные эффекты всех треков улучшений рынка. */
export interface MarketImprovementEffects {
  /** Множитель цены контрактов покупателей (сеть покупателей). */
  buyerPriceMultiplier: number;
  /** Дополнительные пленники в заказах покупателей (маркетинговые исследования). */
  buyerQuantityBonus: number;
  /** Дополнительные пункты скидки партнёра на поставках (логистика). */
  supplyDiscountBonus: number;
  /** Множитель цены лотов пленников (логистика). */
  lotCostMultiplier: number;
  /** Снижение риска скандала в процентных пунктах (управление рисками). */
  riskReduction: number;
  /** Множитель выручки от контрактов (торговое финансирование). */
  proceedsMultiplier: number;
}

/** Нейтральные эффекты — все треки на нуле. */
export const NO_MARKET_EFFECTS: MarketImprovementEffects = {
  buyerPriceMultiplier: 1,
  buyerQuantityBonus: 0,
  supplyDiscountBonus: 0,
  lotCostMultiplier: 1,
  riskReduction: 0,
  proceedsMultiplier: 1
};

/** Считает суммарные эффекты текущих уровней улучшений рынка. */
export function marketImprovementEffects(
  levels: Partial<Record<MarketImprovementId, number>>
): MarketImprovementEffects {
  const buyerNetwork = Math.max(0, Math.min(5, Math.floor(levels.buyer_network ?? 0)));
  const marketResearch = Math.max(0, Math.min(5, Math.floor(levels.market_research ?? 0)));
  const logistics = Math.max(0, Math.min(5, Math.floor(levels.logistics ?? 0)));
  const riskManagement = Math.max(0, Math.min(5, Math.floor(levels.risk_management ?? 0)));
  const tradeFinancing = Math.max(0, Math.min(5, Math.floor(levels.trade_financing ?? 0)));
  return {
    buyerPriceMultiplier: 1 + buyerNetwork * 0.08,
    buyerQuantityBonus: marketResearch,
    supplyDiscountBonus: logistics * 0.03,
    lotCostMultiplier: 1 - logistics * 0.04,
    riskReduction: riskManagement * 2,
    proceedsMultiplier: 1 + tradeFinancing * 0.06
  };
}

/** Стоимость перехода на следующий уровень трека, или null на максимуме. */
export function nextMarketImprovementCost(
  track: MarketImprovementId,
  level: number
): number | null {
  const definition = MARKET_IMPROVEMENT_TRACKS[track];
  const next = Math.max(0, Math.floor(level)) + 1;
  if (next > definition.maxLevel) return null;
  return definition.costs[next];
}

/** Запрос на улучшение рынка, вынесенный администратором или финансистом. */
export interface MarketImprovementRequest {
  requestId: string;
  type: 'upgrade';
  track: MarketImprovementId;
  author: MarketImprovementAuthor;
  authorName: string;
  description: string;
  cost: number;
  benefit: string;
  priority: 'Low' | 'Medium' | 'High';
}

export interface MarketImprovementContext {
  week: number;
  funds: number;
  marketImprovements: Partial<Record<MarketImprovementId, number>>;
  lastWeeklyReport: WeeklyFinanceReport | null;
}

/**
 * Приоритет предложения: High — казна и доходы позволяют вернуть
 * вложения за ~5 недель; Medium — позволяют просто оплатить; Low —
 * либо денег нет, либо синдикат в убытке и тратить рискованно.
 */
function marketRequestPriority(
  cost: number,
  funds: number,
  finance: VenueFinanceSnapshot
): 'Low' | 'Medium' | 'High' {
  if (funds < cost) return 'Low';
  if (!finance.healthy) return 'Low';
  if (finance.netIncome >= cost * 0.2) return 'High';
  return 'Medium';
}

/**
 * Генерирует еженедельное предложение по улучшению глобального рынка.
 * Треки крутятся по неделям, пропуская вышедшие на максимум; автор
 * определяется треком — операционные треки предлагает администратор
 * аукционного дома, денежные — финансист рынка. Когда все треки
 * прокачаны, предложения больше не выдаётся.
 */
export function generateMarketImprovementRequest(
  context: MarketImprovementContext
): MarketImprovementRequest | null {
  const finance = venueFinanceSnapshot(context.lastWeeklyReport);
  const start = context.week % MARKET_IMPROVEMENT_IDS.length;
  for (let offset = 0; offset < MARKET_IMPROVEMENT_IDS.length; offset++) {
    const trackId = MARKET_IMPROVEMENT_IDS[(start + offset) % MARKET_IMPROVEMENT_IDS.length];
    const track = MARKET_IMPROVEMENT_TRACKS[trackId];
    const level = Math.max(0, Math.floor(context.marketImprovements[trackId] ?? 0));
    if (level >= track.maxLevel) continue;
    const cost = track.costs[level + 1];
    const authorName = track.author === 'administrator'
      ? `Администратор аукционного дома ${MARKET_ADMINISTRATOR_NAME}`
      : `Финансист рынка ${MARKET_FINANCIER.name}`;
    return {
      requestId: `market_${trackId}_${context.week}`,
      type: 'upgrade',
      track: trackId,
      author: track.author,
      authorName,
      description: `Улучшить глобальный рынок: «${track.name}» (уровень ${level} → ${level + 1}).`,
      cost,
      benefit: track.effectDescriptions[level + 1],
      priority: marketRequestPriority(cost, context.funds, finance)
    };
  }
  return null;
}
