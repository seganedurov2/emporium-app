import type { Character } from './gameEngine';
import { REGION_COUNTRIES, generateSlaveCharacter } from './gameEngine';
import { regionNameToId } from './caravanRaidsEngine';
import { NO_MARKET_EFFECTS, type MarketImprovementEffects } from './marketImprovementsEngine';
import { formatMoney } from './currency';

/**
 * Slave-purchase contracts.
 *
 * Certain countries and buyers approach the syndicate offering to buy captured
 * slaves. Legitimate fronts (diplomatic households, private estates) surface in
 * the Global Marketplace; discreet criminal buyers (smugglers, cartel brokers,
 * underground auctioneers) surface in the Black Market. Each offer specifies how
 * many slaves it wants, an optional quality requirement, a per-head price and a
 * risk profile that can damage reputation if the operation goes wrong.
 */

export type SlaveContractChannel = 'market' | 'black_market';

export interface SlaveBuyerContract {
  id: string;
  channel: SlaveContractChannel;
  /** Country or cartel the buyer represents. */
  buyerName: string;
  buyerType: string;
  title: string;
  description: string;
  /** Region the buyer operates from, used when the deal spawns new captives. */
  regionId: string;
  regionName: string;
  quantityWanted: number;
  quantityDelivered: number;
  /** Minimum slave quality this buyer accepts, or 'any'. */
  minQuality: 'any' | 'low' | 'medium' | 'high' | 'legendary';
  /** Money earned per delivered slave (region demand + quality + channel). */
  pricePerHead: number;
  /** Demand tier of the buyer's region, for UI badges. */
  demandTier: 'low' | 'medium' | 'high';
  /**
   * Baseline per-head price for a low-quality captive in the syndicate's source
   * region, letting the UI show an arbitrage margin versus this buyer's offer.
   */
  sourcePriceBenchmark: number;
  /** Reputation applied when the contract is fully satisfied. */
  rewardReputation: number;
  /** Reputation penalty if the contract collapses (raid, scandal, failed deal). */
  riskReputation: number;
  /** Percent chance the delivery blows up into a scandal/raid when fulfilled. */
  riskPercent: number;
  weeksRemaining: number;
  status: 'active' | 'completed' | 'failed';
}

const QUALITY_RANK: Record<'low' | 'medium' | 'high' | 'legendary', number> = { low: 1, medium: 2, high: 3, legendary: 4 };

/**
 * Regional demand index for captive labour (0..1). Mirrors REGION_DANGER in
 * caravanRaidsEngine.ts but measures the *pull* side of the market: booming,
 * opaque economies with weak labour protections pay a premium, while the
 * poor source regions where captives are cheaply taken pay almost nothing.
 *
 *   demand = 1.00 (Gulf / wealthy, lawless labour markets)
 *   demand = 0.85-0.95 (Western Europe, East Asia — big money, tight supply)
 *   demand = 0.55-0.70 (mixed middle markets)
 *   demand = 0.10-0.35 (the source regions — captives are cheap here)
 */
export const REGION_SLAVE_DEMAND: Record<string, number> = {
  '01_north_america': 0.65,
  '02_south_america': 0.3,
  '03_western_europe': 0.92,
  '04_eastern_europe': 0.35,
  '05_middle_east': 1.0,
  '06_north_africa': 1.0,   // Gulf & Sahelian transit — the premium market
  '07_west_africa': 0.15,   // source region
  '08_central_africa': 0.1, // source region (cheapest)
  '09_east_south_africa': 0.55,
  '10_central_asia': 0.4,
  '11_east_asia': 0.9,
  '12_south_asia': 0.45,
  '13_southeast_asia': 0.5,
  '14_australia_oceania': 0.65,
  '15_roma': 0.6,
  '16_jewish_diaspora': 0.75,
  '17_pacific_islands': 0.5, // transitional — tourism & military presence
  '99_ceo': 0.85
};

/** Human-readable demand tier for UI badges. */
export function demandTier(regionId: string): 'low' | 'medium' | 'high' {
  const d = REGION_SLAVE_DEMAND[regionId] ?? 0.4;
  if (d >= 0.85) return 'high';
  if (d >= 0.5) return 'medium';
  return 'low';
}

/**
 * Per-head price (before channel modifier) for delivering a captive to a buyer
 * in the given region, scaled further by the captive's quality tier. This is the
 * engine behind the arbitrage loop: a 'high'-quality head sold in a high-demand
 * region can be worth several times one sold in the source region it came from.
 */
export function regionalSlavePrice(
  regionId: string,
  quality: 'low' | 'medium' | 'high' | 'legendary'
): number {
  const demand = REGION_SLAVE_DEMAND[regionId] ?? 0.4;
  const baseByQuality: Record<'low' | 'medium' | 'high' | 'legendary', number> = { low: 5000, medium: 15000, high: 35000, legendary: 80000 };
  // demand 0.1 -> x0.35, demand 1.0 -> x2.0 (wider spread)
  const demandMultiplier = 0.35 + demand * 1.65;
  return Math.round(baseByQuality[quality] * demandMultiplier);
}

/**
 * Returns the slave quality tier of a character from their submission and skill.
 * Mirrors the tiers produced by generateSlaveCharacter.
 */
export function slaveQualityOf(char: Character): 'low' | 'medium' | 'high' | 'legendary' {
  const score = (char.submission || 0) * 0.6 + char.skill * 0.4;
  if (score >= 90) return 'legendary';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function meetsQualityRequirement(
  char: Character,
  minQuality: SlaveBuyerContract['minQuality']
): boolean {
  if (minQuality === 'any') return true;
  return QUALITY_RANK[slaveQualityOf(char)] >= QUALITY_RANK[minQuality];
}

/** Strongest open market on the board, where any head clears the best per-head price. */
export const PREMIUM_MARKET_REGION = '06_north_africa';

/** Lower bound of each quality tier on the 0..100 scale, for appraisal inside a tier. */
const QUALITY_TIER_FLOOR: Record<'low' | 'medium' | 'high' | 'legendary', number> = { low: 0, medium: 45, high: 70, legendary: 90 };

/** Weighted submission/skill score that decides a character's market quality tier. */
function marketScoreOf(char: Character): number {
  return (char.submission || 0) * 0.6 + char.skill * 0.4;
}

/**
 * What a roster member would fetch if the syndicate sold them today: the
 * premium-market price of their quality tier, interpolated inside the tier so
 * submission and skill differences are visible. Buyers pay per tier, but the
 * appraisal between tiers is what lets the syndicate rank its own people — and
 * spot who is worth delivering to a buyer instead of keeping on the floor.
 */
export function marketValueOf(char: Character): number {
  const quality = slaveQualityOf(char);
  const floor = QUALITY_TIER_FLOOR[quality];
  const withinTier = Math.min(1, Math.max(0, (marketScoreOf(char) - floor) / (100 - floor)));
  const tierPrice = regionalSlavePrice(PREMIUM_MARKET_REGION, quality);
  // Tier price is the middle of the band; the edges are 0.85x and 1.15x of it.
  return Math.round(tierPrice * (0.85 + withinTier * 0.3));
}

/** Buyers that surface on the open Global Marketplace (plausible legal fronts). */
const MARKET_BUYERS: { type: string; title: string; blurb: string }[] = [
  { type: 'Дипломатический дом', title: 'Заявка на постоянных домашних слуг', blurb: 'посольство, набирающее постоянных незаметных домашних слуг для дипломатической резиденции' },
  { type: 'Частное имение', title: 'Закупка рабочей силы для имения', blurb: 'закрытый магнат, обставляющий уединённое частное имение постоянной рабочей силой' },
  { type: 'Люксовая гостиничная группа', title: 'Соглашение о персонале курорта', blurb: 'заморский люксовый курорт в поисках обслуживающего экипажа по обезличенному контракту, не числящегося в штате' },
  { type: 'Судоходный консорциум', title: 'Контракт на сопровождающих для офицеров', blurb: 'судоходный консорциум, снабжающий своих офицеров сопровождающим персоналом на долгие рейсы' }
];

/** Buyers that surface on the Black Market (discreet criminal buyers). */
const BLACK_MARKET_BUYERS: { type: string; title: string; blurb: string }[] = [
  { type: 'Подпольный аукционист', title: 'Заказ лота на частном аукционе', blurb: 'подпольный аукционист, собирающий лоты для секретной сети покупателей' },
  { type: 'Брокер картеля', title: 'Заказ рабочей силы для картеля', blurb: 'брокер картеля, скупающий расходный людской материал для удалённых производственных комплексов' },
  { type: 'Контрабандистский синдикат', title: 'Заказ по описи грузового трюма', blurb: 'контрабандистский синдикат, набивающий грузовой трюм человеческим товаром' },
  { type: 'Теневой брокер', title: 'Контракт на тихое приобретение', blurb: 'теневой брокер, оформляющий неотслеживаемый заказ через подставные фирмы' }
];

//
// Region pools are now demand-weighted rather than fixed. High-demand regions
// dominate the marketplace (legitimate, deep-pocketed buyers); lower-demand
// regions appear more on the black market, where captive labour is moved cheap.
// The syndicate's *own* captives come from raids in dangerous/source regions,
// so a smart player buys/sells across this demand gradient.

/** Regions where captives command a high price (overt, deep-pocketed buyers). */
const HIGH_DEMAND_REGIONS = ['05_middle_east', '06_north_africa', '03_western_europe', '11_east_asia', '16_jewish_diaspora'];
/** Regions with a functioning but moderate market for captive labour. */
const MID_DEMAND_REGIONS = ['01_north_america', '14_australia_oceania', '15_roma', '09_east_south_africa', '13_southeast_asia', '12_south_asia', '17_pacific_islands'];
/** The source / transit regions — cheap captives, low end prices. */
const LOW_DEMAND_REGIONS = ['07_west_africa', '08_central_africa', '04_eastern_europe', '10_central_asia', '02_south_america'];

/** Arabic-ish first-name pool for criminal buyer handles. */
const SMUGGLER_ALIASES = [
  'Хорёк', 'Марла Кнут', 'Кобра Васкес', 'Молчаливый Оно', 'Мадам Золотова',
  'Эль Фантасма', 'Барон Каде', 'Сестра Векс'
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function countryFor(regionId: string): string {
  const pool = REGION_COUNTRIES[regionId];
  if (!pool || pool.length === 0) return 'Неизвестная территория';
  return pick(pool);
}

/**
 * Picks a buyer region, biased by the channel. The legitimate marketplace leans
 * toward high/mid-demand regions (where legal fronts hide), while the black
 * market leans toward low/mid-demand regions (where discounted human cargo
 * flows). Some crossover keeps both channels varied.
 */
function pickBuyerRegion(channel: SlaveContractChannel): string {
  const roll = Math.random();
  if (channel === 'market') {
    if (roll < 0.6) return pick(HIGH_DEMAND_REGIONS);
    if (roll < 0.9) return pick(MID_DEMAND_REGIONS);
    return pick(LOW_DEMAND_REGIONS);
  }
  // black market
  if (roll < 0.35) return pick(HIGH_DEMAND_REGIONS);
  if (roll < 0.7) return pick(MID_DEMAND_REGIONS);
  return pick(LOW_DEMAND_REGIONS);
}

/**
 * Generates a fresh slave-purchase contract for the given channel. Quality
 * requirements, quantity and per-head pricing scale with the buyer's channel:
 * black-market brokers buy more, at higher risk and heavier discounts.
 */
export function generateSlaveContract(
  channel: SlaveContractChannel,
  /** Optional per-buyer-type standing (Idea 5) to improve prices & order size. */
  standing = 0,
  /** Aggregate effects of the global market improvements. */
  effects: MarketImprovementEffects = NO_MARKET_EFFECTS
): SlaveBuyerContract {
  const isBlack = channel === 'black_market';
  const buyer = pick(isBlack ? BLACK_MARKET_BUYERS : MARKET_BUYERS);
  const regionId = pickBuyerRegion(channel);
  const regionName = regionLabel(regionId);
  const country = countryFor(regionId);

  // Restrained standing bonus: 0..1 scaled by trusted deals, capped at +20%.
  const standingMultiplier = 1 + Math.min(0.2, standing * 0.04);

  const quantityWanted = (isBlack
    ? Math.floor(Math.random() * 3) + 2      // 2-4
    : Math.floor(Math.random() * 2) + 1)     // 1-2
    + effects.buyerQuantityBonus;
  const qualityRoll = Math.random();
  const regionDemand = REGION_SLAVE_DEMAND[regionId] ?? 0.4;
  let minQuality: SlaveBuyerContract['minQuality'];
  if (regionDemand >= 0.95 && qualityRoll < 0.05) {
    minQuality = 'legendary'; // 5% chance for legendary requirement in top markets
  } else if (qualityRoll < 0.4) {
    minQuality = 'any';
  } else if (qualityRoll < 0.7) {
    minQuality = 'medium';
  } else if (qualityRoll < 0.9) {
    minQuality = 'high';
  } else {
    minQuality = 'legendary';
  }

  // Price now derives from the buyer region's demand index and the quality the
  // buyer is asking for. The black market adds a risk premium on top.
  const pricedQuality: 'low' | 'medium' | 'high' | 'legendary' = minQuality === 'any' ? 'medium' : minQuality;
  const basePrice = regionalSlavePrice(regionId, pricedQuality);
  const channelMultiplier = isBlack ? 1.15 : 1.0;
  const pricePerHead = Math.round(
    basePrice * channelMultiplier * standingMultiplier * (0.92 + Math.random() * 0.16) * effects.buyerPriceMultiplier
  );

  // Benchmark the syndicate's source-region price so the UI can show the margin.
  const sourcePriceBenchmark = regionalSlavePrice('08_central_africa', 'low');

  const buyerName = isBlack
    ? `${pick(SMUGGLER_ALIASES)} (${country})`
    : `${buyer.type} — ${country}`;

  const tier = demandTier(regionId);
  const tierBlurb = tier === 'high'
    ? 'премиальный рынок, где пленные уходят за лучшие деньги'
    : tier === 'medium'
      ? 'стабильный региональный рынок'
      : 'низкоценовой рынок-источник, где пленные стоят дёшево';

  return {
    id: 'slavecontract_' + Math.random().toString(36).substring(2, 9),
    channel,
    buyerName,
    buyerType: buyer.type,
    title: buyer.title,
    description: `Клиент: ${buyer.blurb} — база в ${country} (${regionName}), ${tierBlurb}. Предлагает ${formatMoney(pricePerHead)} за одного пленного, нужно ${quantityWanted} чел.${minQuality === 'any' ? '' : ` качеством не ниже ${minQuality}`}.`,
    regionId,
    regionName,
    quantityWanted,
    quantityDelivered: 0,
    minQuality,
    pricePerHead,
    demandTier: tier,
    sourcePriceBenchmark,
    rewardReputation: isBlack ? Math.floor(quantityWanted * 1.5) : quantityWanted * 3,
    riskReputation: isBlack ? quantityWanted * 3 : quantityWanted * 2,
    riskPercent: isBlack ? 20 + Math.floor(Math.random() * 20) : 5 + Math.floor(Math.random() * 10),
    weeksRemaining: isBlack ? 3 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3),
    status: 'active'
  };
}

function regionLabel(regionId: string): string {
  const labels: Record<string, string> = {
    '01_north_america': 'Северная Америка и Карибы',
    '02_south_america': 'Южная Америка',
    '03_western_europe': 'Западная Европа и Скандинавия',
    '04_eastern_europe': 'Восточная Европа и Балканы',
    '05_middle_east': 'Ближний Восток и Кавказ',
    '06_north_africa': 'Северная Африка и Сахель',
    '07_west_africa': 'Западная Африка',
    '08_central_africa': 'Центральная Африка',
    '09_east_south_africa': 'Восточная и Южная Африка',
    '10_central_asia': 'Центральная Азия и Сибирь',
    '11_east_asia': 'Восточная Азия',
    '12_south_asia': 'Южная Азия',
    '13_southeast_asia': 'Юго-Восточная Азия',
    '14_australia_oceania': 'Австралия и Океания',
    '15_roma': 'Диаспора рома',
    '16_jewish_diaspora': 'Еврейская диаспора',
    '17_pacific_islands': 'Тихоокеанские острова'
  };
  return labels[regionId] || 'Неизвестный регион';
}

/** Roster slaves that a given buyer would accept (available, unassigned-agnostic). */
export function eligibleSlaves(roster: Character[], contract: SlaveBuyerContract): Character[] {
  return roster.filter(c => c.isSlave && meetsQualityRequirement(c, contract.minQuality));
}

/**
 * Delivers as many eligible slaves as possible toward a contract. Returns the
 * updated contract plus the ids of the slaves that were handed over.
 */
export function deliverSlaves(
  contract: SlaveBuyerContract,
  roster: Character[]
): { contract: SlaveBuyerContract; deliveredIds: string[] } {
  const need = contract.quantityWanted - contract.quantityDelivered;
  if (need <= 0) return { contract, deliveredIds: [] };

  const eligible = eligibleSlaves(roster, contract).slice(0, need);
  const deliveredIds = eligible.map(c => c.id);
  const delivered = { ...contract, quantityDelivered: contract.quantityDelivered + deliveredIds.length };

  if (delivered.quantityDelivered >= delivered.quantityWanted) {
    delivered.status = 'completed';
  }
  return { contract: delivered, deliveredIds };
}
// ---------------------------------------------------------------------------
// Caravan-driven supply offers on the Global Market (BUY side).
//
// When a region has received a heavy, *consistent* flow of trading caravans in a
// single week (5..15 dispatched, all bound for the same region and all delivered),
// that region's brokers open their own slave pens to the syndicate as a reward:
// for a fixed term the player may *buy* captives from the region at a privileged
// price. The caravans open the door — the player still pays for the stock.
// ---------------------------------------------------------------------------

/** A region relationship that reached the threshold for a standing supply deal. */
export interface CaravanRegionFlow {
  regionId: string;
  regionName: string;
  /** Caravans that arrived in this region during the qualifying week. */
  caravansDelivered: number;
}

/**
 * A standing slave-supply offer opened by a region on the Global Market.
 *
 * Unlike a one-off buyer order (where the syndicate sells), this is a rolling
 * *purchase* right: every week for `termWeeks` the player may buy up to
 * `weeklyQuantity` captives from the region at `pricePerHead`, until the term
 * runs out. Purchases are recorded in `purchasedThisWeek` / `totalPurchased`.
 */
export interface TradeSupplyContract {
  id: string;
  channel: 'market';
  regionId: string;
  regionName: string;
  /** Local agent the syndicate deals with, for display. */
  buyerName: string;
  title: string;
  description: string;
  /** Caravans that triggered the deal (5..15), for the flavour text. */
  caravansDelivered: number;
  /** Price the region asks per captive bought from it. */
  pricePerHead: number;
  /** Max heads the player may buy from the region per week. */
  weeklyQuantity: number;
  /** Quality tier of the stock the region is offering. */
  quality: 'low' | 'medium' | 'high' | 'legendary';
  /**
   * Whether the player has signed the contract yet. An opened offer is just an
   * invitation; captives can only be bought from a signed contract.
   */
  signed: boolean;
  /** Campaign week the offer was opened. */
  startWeek: number;
  /** Total weeks the offer stays open. */
  termWeeks: number;
  weeksRemaining: number;
  /** Heads bought from the region in the current week. */
  purchasedThisWeek: number;
  /** Heads bought over the life of the offer. */
  totalPurchased: number;
  /** Funds already spent on the offer. */
  totalSpent: number;
  status: 'active' | 'completed';
}

/** Minimum caravans into one region that open a supply offer. */
export const SUPPLY_CONTRACT_MIN_CARAVANS = 5;
/** Maximum caravans counted toward a single region in one week. */
export const SUPPLY_CONTRACT_MAX_CARAVANS = 15;
/** Regional brokers that open their pens to a well-connected syndicate. */
const SUPPLY_REGION_SELLERS: { type: string; blurb: string }[] = [
  { type: 'Региональный торговый дом', blurb: 'торговый дом, связанный с караванными путями, готовый уступить часть своего живого товара со складов' },
  { type: 'Консорциум плантаций', blurb: 'консорциум плантаций, распродающий излишки рабочей силы после расширения маршрутов' },
  { type: 'Гильдия караванщиков', blurb: 'гильдия караванщиков, открывающая свои пены в счёт за открытые маршруты' }
];

/**
 * Does a week's caravan traffic qualify for a standing supply contract? Every
 * dispatched caravan must have been bound for the *same* region and arrived.
 * Returns the qualifying flows, largest first (usually just one).
 */
export function detectCaravanSupplyTriggers(
  caravans: { destRegion: string; status: string }[]
): CaravanRegionFlow[] {
  const arrivedByRegion = new Map<string, number>();
  caravans.forEach(caravan => {
    if (caravan.status !== 'completed') return;
    arrivedByRegion.set(caravan.destRegion, (arrivedByRegion.get(caravan.destRegion) ?? 0) + 1);
  });

  const flows: CaravanRegionFlow[] = [];
  arrivedByRegion.forEach((count, regionName) => {
    if (count < SUPPLY_CONTRACT_MIN_CARAVANS) return;
    const regionId = regionNameToId(regionName);
    if (!regionId) return;
    flows.push({
      regionId,
      regionName,
      caravansDelivered: Math.min(SUPPLY_CONTRACT_MAX_CARAVANS, count)
    });
  });

  return flows.sort((a, b) => b.caravansDelivered - a.caravansDelivered);
}

/**
 * Opens a supply offer for a region that qualified through caravan traffic. The
 * term and the weekly lot scale with how many caravans arrived and the region's
 * demand tier, so a strong corridor opens a fat, long-running pipeline of stock.
 *
 * Pricing is a *purchase* price: the region asks a market price for its stock,
 * but a proven corridor earns a partner discount (up to 30% off).
 */
export function generateTradeSupplyContract(flow: CaravanRegionFlow, week: number, activeContractsCount: number = 0, effects: MarketImprovementEffects = NO_MARKET_EFFECTS): TradeSupplyContract {
  const tier = demandTier(flow.regionId);
  const country = countryFor(flow.regionId);
  const seller = pick(SUPPLY_REGION_SELLERS);
  
  const termWeeks = Math.min(12, 4 + Math.floor(flow.caravansDelivered / 3));
    
  // Base quantity based on caravans and region tier
  let weeklyQuantity = Math.max(1, Math.round(flow.caravansDelivered / 5) + (tier === 'high' ? 1 : 0));
    
  // BONUS: If more than 2 contracts are signed in this region, increase the supply by 2-5 units
  if (activeContractsCount > 2) {
    const bonus = Math.floor(Math.random() * 4) + 2; // 2 to 5
    weeklyQuantity += bonus;
  }
  
  const qualityRoll = Math.random();
  const quality: TradeSupplyContract['quality'] = tier === 'high'
    ? (qualityRoll < 0.4 ? 'medium' : qualityRoll < 0.9 ? 'high' : 'legendary')
    : tier === 'medium'
      ? (qualityRoll < 0.6 ? 'low' : 'medium')
      : 'low';

  // The region asks a market price for its stock; a heavy caravan run earns a
  // partner discount — the reward for a proven corridor. Market logistics
  // improvements shave additional points off the price.
  const discount = Math.min(0.5, Math.min(0.3, 0.08 + flow.caravansDelivered * 0.014) + effects.supplyDiscountBonus);
  const pricePerHead = Math.round(regionalSlavePrice(flow.regionId, quality) * (1 - discount));
  const regionName = regionLabel(flow.regionId);

  return {
    id: 'supplycontract_' + Math.random().toString(36).substring(2, 9),
    channel: 'market',
    regionId: flow.regionId,
    regionName,
    buyerName: `${seller.type} — ${country}`,
    title: `Поставка рабов из региона: ${regionName}`,
    description: `Караваны вышли на ${regionName} крупной партией (${flow.caravansDelivered} прибыли за неделю) — ${seller.blurb}. Регион открывает вам поставку на ${termWeeks} нед.: можно выкупать до ${weeklyQuantity} пленник(ов) в неделю качеством «${quality}» по ${formatMoney(pricePerHead)} за голову (скидка партнёра ${Math.round(discount * 100)}%).`,
    caravansDelivered: flow.caravansDelivered,
    pricePerHead,
    weeklyQuantity,
    quality,
    signed: false,
    startWeek: week,
    termWeeks,
    weeksRemaining: termWeeks,
    purchasedThisWeek: 0,
    totalPurchased: 0,
    totalSpent: 0,
    status: 'active'
  };
}

/**
 * Signs an opened regional supply offer. Only a signed contract may be bought
 * from, so the player must accept the terms before any captives change hands.
 */
export function signTradeSupplyContract(contract: TradeSupplyContract): TradeSupplyContract {
  if (contract.status !== 'active' || contract.signed) return contract;
  return { ...contract, signed: true };
}

/**
 * Buys up to `weeklyQuantity` captives from a region's supply offer. The heads
 * join the roster as slaves («без работы» until assigned) and the cost is taken
 * from the treasury by the caller.
 */
export function buyFromSupplyContract(
  contract: TradeSupplyContract,
  funds: number,
  week: number,
  /** How many heads to buy; defaults to the rest of the week's lot. */
  requested = contract.weeklyQuantity - contract.purchasedThisWeek
): { contract: TradeSupplyContract; bought: Character[]; cost: number } {
  if (contract.status !== 'active' || !contract.signed) return { contract, bought: [], cost: 0 };

  const room = Math.max(0, contract.weeklyQuantity - contract.purchasedThisWeek);
  const affordable = Math.floor(funds / Math.max(1, contract.pricePerHead));
  const quantity = Math.max(0, Math.min(room, affordable, Math.floor(requested)));
  if (quantity <= 0) return { contract, bought: [], cost: 0 };

  const bought: Character[] = [];
  for (let i = 0; i < quantity; i++) {
    bought.push({
      ...generateSlaveCharacter({
        regionId: contract.regionId,
        quality: contract.quality,
        origin: `supply_contract:${contract.regionId}`
      }),
      acquiredWeek: week,
      assignedVenue: 'unassigned'
    });
  }

  const cost = quantity * contract.pricePerHead;
  return {
    contract: {
      ...contract,
      purchasedThisWeek: contract.purchasedThisWeek + quantity,
      totalPurchased: contract.totalPurchased + quantity,
      totalSpent: contract.totalSpent + cost
    },
    bought,
    cost
  };
}

// ---------------------------------------------------------------------------
// Buy-side: captive lots offered for acquisition (the arbitrage entry point).
// ---------------------------------------------------------------------------

export interface CaptiveLotOffer {
  id: string;
  /** Region the lot physically sits in — its demand index sets the asking price. */
  regionId: string;
  regionName: string;
  quality: 'low' | 'medium' | 'high' | 'legendary';
  quantity: number;
  /** Price to acquire the whole lot (already demand-scaled). */
  cost: number;
  /** Per-head asking price, for tooltip/compare. */
  pricePerHead: number;
}

/**
 * Generates a captive lot available for purchase. Lots sit in *low or mid* demand
 * regions (that is where they are cheap), which is exactly the arbitrage
 * opportunity: buy here, deliver to a high-demand buyer contract for a margin.
 */
export function generateCaptiveLotOffer(effects: MarketImprovementEffects = NO_MARKET_EFFECTS): CaptiveLotOffer {
  const regionId = Math.random() < 0.6 ? pick(LOW_DEMAND_REGIONS) : pick(MID_DEMAND_REGIONS);
  const qualityRoll = Math.random();
  let quality: CaptiveLotOffer['quality'];
  if (qualityRoll < 0.5) quality = 'low';
  else if (qualityRoll < 0.85) quality = 'medium';
  else if (qualityRoll < 0.98) quality = 'high';
  else quality = 'legendary'; // 2% chance for legendary lot
  const quantity = Math.floor(Math.random() * 2) + 1; // 1-2

  const pricePerHead = regionalSlavePrice(regionId, quality);
  // A small acquisition discount versus the sell-side buyer price,
  // deepened by the market logistics improvements.
  const cost = Math.round(pricePerHead * quantity * 0.85 * effects.lotCostMultiplier);

  return {
    id: 'lot_' + Math.random().toString(36).substring(2, 9),
    regionId,
    regionName: regionLabel(regionId),
    quality,
    quantity,
    cost,
    pricePerHead
  };
}

// ---------------------------------------------------------------------------
// Idea 5: per-buyer-type standing ("favours").
// ---------------------------------------------------------------------------

export interface BuyerStanding {
  /** Buyer type key (e.g. 'Cartel Broker'). */
  buyerType: string;
  /** Trusted, cleanly completed deals. */
  reputation: number;
  /** Clean scandals booked against this buyer relationship. */
  scandals: number;
  /** Week number until which this buyer is locked out, or 0 when open. */
  lockedUntilWeek: number;
}

/** Standing tiers that gate order size and price bonuses. */
export function standingTier(standing: number): 'cold' | 'neutral' | 'trusted' | 'favoured' {
  if (standing >= 6) return 'favoured';
  if (standing >= 3) return 'trusted';
  if (standing >= 1) return 'neutral';
  return 'cold';
}

/**
 * Max simultaneous active contracts a buyer type will offer, gated by standing.
 * Cold relationships still trade, but only in small numbers.
 */
export function maxOrdersForStanding(standing: number): number {
  const tier = standingTier(standing);
  return tier === 'favoured' ? 3 : tier === 'trusted' ? 2 : 1;
}

export type StandingMap = Record<string, BuyerStanding>;

/** Reads standing for a buyer type, creating a default entry when absent. */
export function getStanding(map: StandingMap | undefined, buyerType: string): BuyerStanding {
  return map?.[buyerType] ?? { buyerType, reputation: 0, scandals: 0, lockedUntilWeek: 0 };
}

/**
 * Applies the outcome of a fulfilled contract to the buyer-standing map and
 * returns a new map. A clean completion raises standing; a scandal tanks it and
 * locks the buyer out for several weeks.
 */
export function applyStandingOutcome(
  map: StandingMap | undefined,
  buyerType: string,
  opts: { completed: boolean; scandal: boolean; week: number; lockWeeks?: number }
): StandingMap {
  const next: StandingMap = { ...(map || {}) };
  const current = getStanding(map, buyerType);

  if (opts.scandal) {
    next[buyerType] = {
      ...current,
      reputation: Math.max(0, current.reputation - 3),
      scandals: current.scandals + 1,
      lockedUntilWeek: opts.week + (opts.lockWeeks ?? 4)
    };
  } else if (opts.completed) {
    const bonus = opts.week >= current.lockedUntilWeek ? 1 : 1; // always +1 on clean completion
    next[buyerType] = {
      ...current,
      reputation: Math.min(10, current.reputation + bonus)
    };
  }
  return next;
}

/** Whether a buyer type is currently locked out by a prior scandal. */
export function isBuyerLocked(standing: BuyerStanding | undefined, week: number): boolean {
  return !!standing && standing.lockedUntilWeek > week;
}

/**
 * Effective scandal risk for a contract, after the Legal Department's
 * paperwork reduces it. Clamped to 0 so a top-tier legal team removes the risk
 * entirely rather than pushing it negative.
 */
export function effectiveRiskPercent(contract: SlaveBuyerContract, reductionPoints = 0, effects: MarketImprovementEffects = NO_MARKET_EFFECTS): number {
  if (reductionPoints <= 0 && effects.riskReduction <= 0) return contract.riskPercent;
  return Math.max(0, contract.riskPercent - reductionPoints - effects.riskReduction);
}
// ---------------------------------------------------------------------------
// Idea 1: Slave unrest & escape risk.
// ---------------------------------------------------------------------------

export interface UnrestAssessment {
  /** Aggregate unrest index 0..100 (higher = more dangerous). */
  unrestIndex: number;
  /** Per-slave escape chance (in %) for the coming week. */
  escapeChance: number;
  /** Slaves that are at immediate risk (individually flagged). */
  atRiskIds: string[];
}

/**
 * Computes the unrest index and per-slave escape chance for the coming week.
 *
 * Drivers, all reusing existing Character fields:
 *  - low loyalty raises unrest;
 *  - exhaustion (Tired/Exhausted/Burned Out) raises unrest;
 *  - poor health raises unrest;
 *  - total captive count amplifies unrest (harder to control a large holding);
 *  - assigning a captives to `trade`/`security` work is treated as more secure
 *    (fewer opportunities to run), while venue work (pleasure_house/strip_club)
 *    is more exposed.
 */
export function assessSlaveUnrest(slaves: Character[], roster: Character[]): UnrestAssessment {
  if (slaves.length === 0) return { unrestIndex: 0, escapeChance: 0, atRiskIds: [] };

  const crowding = Math.min(1, slaves.length / 12); // 0..1, saturates at 12+

  let unrestSum = 0;
  const atRiskIds: string[] = [];

  slaves.forEach(s => {
    const loyalty = s.loyalty ?? 50;
    const loyaltyUnrest = Math.max(0, (60 - loyalty)) / 60; // 0..1
    const exhaustUnrest = s.exhaustionLevel === 'Burned Out' ? 0.35
      : s.exhaustionLevel === 'Exhausted' ? 0.22
      : s.exhaustionLevel === 'Tired' ? 0.1 : 0;
    const healthUnrest = s.healthLevel === 'Critical' ? 0.3
      : s.healthLevel === 'Poor' ? 0.18
      : s.healthLevel === 'Fair' ? 0.08 : 0;
    const venueExposure = s.assignedVenue === 'trade' || s.assignedVenue === 'security' ? -0.12
      : s.assignedVenue === 'pleasure_house' || s.assignedVenue === 'strip_club' ? 0.08
      : s.assignedVenue === 'unassigned' ? -0.04
      : 0;

    // --- OVERSEER BONUS ---
    let overseerBonus = 0;
    if (s.managedBy) {
      const overseer = roster.find(r => r.id === s.managedBy);
      if (overseer) {
        // Skill 100 gives -25% unrest, Skill 0 gives 0%
        overseerBonus = -(overseer.skill * 0.0025); 
      }
    }

    const individual = clamp01(loyaltyUnrest * 0.6 + exhaustUnrest + healthUnrest + venueExposure + overseerBonus);
    unrestSum += individual;

    // Rough individual escape chance for flagging.
    const chance = Math.round(clamp01(individual * 0.5 + crowding * 0.15) * 100);
    if (chance >= 12) atRiskIds.push(s.id);
  });

  const avgUnrest = unrestSum / slaves.length;
  const unrestIndex = Math.round(clamp01(avgUnrest * 0.7 + crowding * 0.3) * 100);

  // Global weekly chance that at least one slave makes a run for it.
  const escapeChance = Math.round(clamp01(avgUnrest * 0.55 + crowding * 0.2) * 55);

  return { unrestIndex, escapeChance, atRiskIds };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Rolls escapes for the week. Returns the ids of slaves that fled. The number of
 * escapees scales with the global escape chance and the individual risk each
 * slave carries, so a large, demoralised holding can lose several captives.
 */
export function rollSlaveEscapes(
  slaves: Character[],
  escapeChance: number,
  /** Optional security multiplier (e.g. 0.7 when guards are assigned). */
  securityFactor = 1
): string[] {
  if (slaves.length === 0) return [];
  const escaped: string[] = [];

  slaves.forEach(s => {
    const loyalty = s.loyalty ?? 50;
    // Individual risk is higher for the least loyal, most exhausted captives.
    const individualMod = 1 + Math.max(0, (50 - loyalty)) / 50
      + (s.exhaustionLevel === 'Burned Out' ? 0.4 : s.exhaustionLevel === 'Exhausted' ? 0.2 : 0);
    const chance = clamp01((escapeChance / 100) * individualMod * securityFactor);
    if (Math.random() < chance) escaped.push(s.id);
  });

  return escaped;
}

/**
 * "Breaking" a slave: a week of indoctrination that nudges submission up and
 * loyalty up a little, at the cost handled by the caller. This is what makes the
 * unrest loop solvable without selling every captive.
 */
export function applySlaveBreaking(char: Character): Character {
  const newSubmission = Math.min(100, (char.submission ?? 50) + Math.floor(Math.random() * 4) + 3);
  const newLoyalty = Math.min(100, (char.loyalty ?? 20) + Math.floor(Math.random() * 3) + 1);
  return { ...char, submission: newSubmission, loyalty: newLoyalty };
}

/**
 * A week of instruction at the BDSM Room. The posted mistress/master works the
 * house's captives: submission rises (so they are calmer and worth more on the
 * market) and loyalty rises a little. Unlike {@link applySlaveBreaking} this is a
 * passive weekly effect on everyone, not a paid one-off action.
 */
export function applyBdsmTraining(char: Character, gain: number): Character {
  if (gain <= 0 || !char.isSlave) return char;
  const newSubmission = Math.min(100, (char.submission ?? 50) + gain);
  const newLoyalty = Math.min(100, (char.loyalty ?? 20) + Math.max(1, Math.round(gain / 2)));
  return { ...char, submission: newSubmission, loyalty: newLoyalty };
}

/** Lifetime slave revenue from a roster (sums pleasureStats.totalEarnings). */
export function lifetimeSlaveRevenue(slaves: Character[]): number {
  return slaves.reduce((sum, c) => sum + (c.pleasureStats?.totalEarnings || 0), 0);
}
