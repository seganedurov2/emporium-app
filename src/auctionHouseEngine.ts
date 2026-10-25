import type { Caravan, Character } from './gameEngine';
import type { AuxiliaryBuildingState, Employee } from './expansionTypes';
import { formatMoney } from './currency';

export interface AuctionGoodsLot {
  id: string;
  productName: string;
  category: string;
  quantity: number;
  caravanId: string;
  caravanName: string;
  arrivalWeek: number;
  appraisedBy: string;
  /** Automatic appraisal fixed on delivery; it is never re-rolled on render. */
  appraisedValue: number;
}

export interface AuctionCharacterLot {
  id: string;
  productName: string;
  category: 'Сотрудник' | 'Раб';
  characterId: string;
  gender: 'women' | 'men' | 'trans';
  assignedVenue: string;
  isSlave: boolean;
  appraisedBy: string;
  appraisedValue: number;
}

export type AuctionLot = AuctionGoodsLot | AuctionCharacterLot;

export interface SaleMeta {
  soldWeek: number;
  saleProceeds: number;
  auctioneerBonusPercent: number;
  /** Name of the NPC bidder who drove the price above the base, if any. */
  winningNpcBidder?: string;
  /** The winning NPC's bid amount, for display in the sale history. */
  npcWinningBid?: number;
}

export type LotInterest = 'goods' | 'characters' | 'all';

/**
 * Запрос администратора аукционного дома на продажу лота
 * персонала. Персонал (рабы и сотрудники) не продаётся
 * автоматически: продажа состоится только после согласия
 * игрока на этот запрос.
 */
export interface SaleConsentRequest {
  lotId: string;
  lotName: string;
  characterId: string;
  isSlave: boolean;
  category: 'Сотрудник' | 'Раб';
  appraisedValue: number;
  requestedWeek: number;
  administratorName: string;
}

/** Имя администратора аукционного дома, подписывающего запросы на продажу. */
export const AUCTION_HOUSE_ADMINISTRATOR = 'Тимур Астори';

/** Максимум запросов на продажу, хранимых в состоянии. */
export const AUCTION_SALE_CONSENT_LIMIT = 50;

export interface NpcBidder {
  id: string;
  name: string;
  /** 0-1 scale of how aggressively they bid above the base appraised value. */
  aggression: number;
  /** Which lot categories they are interested in buying. */
  interest: LotInterest;
}

export interface NpcAuctionResult {
  /** Final proceeds realized: the max of the base and the winning NPC bid. */
  finalProceeds: number;
  /** Name of the winning NPC bidder, if an NPC bid exceeded the base price. */
  winningNpcBidder?: string;
  /** The winning NPC's bid amount. */
  npcWinningBid?: number;
  /** How many NPC bidders actually placed bids this round. */
  npcBidCount: number;
  /** Names of all NPC bidders interested in this lot type (for UI preview). */
  npcInterest: string[];
}

export const NPC_AUCTION_BIDDERS: NpcBidder[] = [
  { id: 'npc_meridian', name: 'Торговый дом «Меридиан»', aggression: 0.22, interest: 'goods' },
  { id: 'npc_three_masts', name: 'Судоходный консорциум «Три мачи»', aggression: 0.18, interest: 'goods' },
  { id: 'npc_east_gates', name: 'Оптовый рынок «Восточные ворота»', aggression: 0.15, interest: 'goods' },
  { id: 'npc_lorin', name: 'Двор «Лорин»', aggression: 0.25, interest: 'characters' },
  { id: 'npc_collector', name: 'Частный коллекционер', aggression: 0.35, interest: 'characters' },
  { id: 'npc_shadows', name: 'Черный рынок «Тени»', aggression: 0.20, interest: 'characters' },
  { id: 'npc_aurum', name: 'Инвестиционный фонд «Аурум»', aggression: 0.12, interest: 'all' }
];

export type AuctionSale = (AuctionGoodsLot & SaleMeta) | (AuctionCharacterLot & SaleMeta);

export interface AuctionHouseState {
  pendingLots: AuctionLot[];
  recentSales: AuctionSale[];
  /** Запросы администратора на продажу персонала, ожидающие согласия игрока. */
  pendingSaleConsents: SaleConsentRequest[];
}

export interface GoodsSaleQuote {
  appraisedValue: number;
  auctioneerBonusPercent: number;
  saleProceeds: number;
}

export interface AuctionHouseStaff {
  auctioneer: Employee | null;
  appraiser: Employee | null;
  buildingLevel: number;
}

const GOODS_CATALOG = [
  { productName: 'Шёлковая ткань', category: 'Текстиль' },
  { productName: 'Партия специй', category: 'Пряности' },
  { productName: 'Фарфоровая посуда', category: 'Керамика' },
  { productName: 'Резные изделия', category: 'Ремесло' },
  { productName: 'Лекарственные травы', category: 'Медикаменты' },
  { productName: 'Тонкое стекло', category: 'Стекло' },
  { productName: 'Металлические инструменты', category: 'Инструменты' },
  { productName: 'Крашеная шерсть', category: 'Текстиль' }
] as const;

export const AUCTION_SALES_HISTORY_LIMIT = 12;

export function createEmptyAuctionHouse(): AuctionHouseState {
  return { pendingLots: [], recentSales: [], pendingSaleConsents: [] };
}

/** Creates one persistable goods lot from cargo already valued by the caravan route. */
export function createGoodsLot(
  caravan: Caravan,
  arrivalWeek: number,
  random: () => number = Math.random,
  appraiser: Employee | null = null
): AuctionGoodsLot {
  const catalogIndex = Math.min(GOODS_CATALOG.length - 1, Math.floor(random() * GOODS_CATALOG.length));
  const product = GOODS_CATALOG[catalogIndex];
  return {
    id: `goods_${caravan.id}_${arrivalWeek}`,
    productName: product.productName,
    category: product.category,
    quantity: 1 + Math.floor(random() * 4),
    caravanId: caravan.id,
    caravanName: caravan.name,
    arrivalWeek: Math.max(1, Math.floor(arrivalWeek)),
    appraisedBy: appraiser?.status === 'active' && appraiser.specialty === 'appraiser' ? appraiser.name : 'Автоматическая оценка',
    appraisedValue: Math.max(0, Math.round(Number(caravan.potentialProfit) || 0))
  };
}

/** Creates an auction lot for a roster character assigned to the pleasure house. */
export function createCharacterLot(
  character: Character,
  appraiser: Employee | null = null
): AuctionCharacterLot {
  return {
    id: `char_${character.id}`,
    productName: character.name,
    category: character.isSlave ? 'Раб' : 'Сотрудник',
    characterId: character.id,
    gender: character.gender,
    assignedVenue: character.assignedVenue ?? 'unassigned',
    isSlave: character.isSlave ?? false,
    appraisedBy: appraiser?.status === 'active' && appraiser.specialty === 'appraiser' ? appraiser.name : 'Автоматическая оценка',
    appraisedValue: Math.max(0, Math.round(character.price || 0))
  };
}

/** Active staff assigned to the built auction-house posts. */
export function getAuctionHouseStaff(
  buildings: AuxiliaryBuildingState[],
  employees: Employee[]
): AuctionHouseStaff {
  const building = buildings.find(item => item.id === 'auction_house');
  if (!building || building.level <= 0) return { auctioneer: null, appraiser: null, buildingLevel: 0 };

  const assignedIds = new Set(building.assignedEmployeeIds);
  const activeStaff = employees.filter(employee =>
    employee.status === 'active'
    && employee.assignedBuildingId === 'auction_house'
    && assignedIds.has(employee.id)
  );
  return {
    auctioneer: activeStaff.find(employee => employee.specialty === 'auctioneer') ?? null,
    appraiser: activeStaff.find(employee => employee.specialty === 'appraiser') ?? null,
    buildingLevel: building.level
  };
}

/**
 * The automatic appraisal is always available. An assigned auctioneer receives
 * the building-level sale bonus only while the auction house is operating.
 * Appraisers are recorded as the lot assessor but do not gate the appraisal.
 */

export function quoteAuctionLot(
  lot: AuctionLot,
  auctioneer: Employee | null = null,
  auctioneerSaleBonus = 0
): GoodsSaleQuote {
  const eligibleAuctioneer = Boolean(
    auctioneer
    && auctioneer.status === 'active'
    && auctioneer.specialty === 'auctioneer'
    && auctioneer.assignedBuildingId === 'auction_house'
    && auctioneerSaleBonus > 0
  );
  const auctioneerBonusPercent = eligibleAuctioneer ? Math.min(15, Math.max(0, Math.floor(auctioneerSaleBonus))) : 0;
  const appraisedValue = Math.max(0, Math.floor(Number(lot.appraisedValue) || 0));
  return {
    appraisedValue,
    auctioneerBonusPercent,
    saleProceeds: Math.round(appraisedValue * (100 + auctioneerBonusPercent) / 100)
  };
}

/** Backward-compatible alias for the generalized lot quoter. */
export const quoteGoodsSale = quoteAuctionLot;

/**
 * True when the open-market assessment of a lot's character diverges from
 * the auction house appraisal. Any whole-dollar difference counts: the
 * appraiser and the auctioneer then announce their own prices through the
 * message feed, and the sale is confirmed at the auction price.
 */
export function valuationMismatch(marketValue: number, appraisedValue: number): boolean {
  return Math.abs(Math.round(marketValue) - Math.round(appraisedValue)) >= 1;
}

export interface ValuationAnnouncement {
  /** Who posted the message: the appraiser or the auctioneer. */
  speaker: 'appraiser' | 'auctioneer';
  name: string;
  /** The price this staff member states. */
  price: number;
  text: string;
}

const AUTO_APPRAISER_NAME = 'Автоматическая оценка';
const AUTO_AUCTIONEER_NAME = 'Автоматический аукционист';

/**
 * The messages the appraiser and the auctioneer post when the market
 * assessment does not match the auction house appraisal. Each states
 * their own price — the appraiser stands by the appraisal, the
 * auctioneer by the expected sale proceeds — and the auctioneer's
 * message confirms the sale (or the listing, before the sale happens).
 */
export function buildValuationAnnouncements(
  lot: AuctionLot,
  marketValue: number,
  appraiser: Employee | null,
  auctioneer: Employee | null,
  auctioneerSaleBonus = 0,
  /** True when the messages accompany an actual sale; false when the lot is only listed. */
  saleConfirmed = true
): ValuationAnnouncement[] {
  const quote = quoteAuctionLot(lot, auctioneer, auctioneerSaleBonus);
  const appraiserName = appraiser?.status === 'active' && appraiser.specialty === 'appraiser'
    ? appraiser.name
    : AUTO_APPRAISER_NAME;
  const auctioneerName = auctioneer?.status === 'active' && auctioneer.specialty === 'auctioneer'
    ? auctioneer.name
    : AUTO_AUCTIONEER_NAME;
  const market = Math.max(0, Math.round(marketValue));
  const auctioneerClosing = saleConfirmed ? 'Продажа подтверждена.' : 'Лот выставлен.';
  return [
    {
      speaker: 'appraiser',
      name: appraiserName,
      price: quote.appraisedValue,
      text: `Оценщик ${appraiserName}: рыночная оценка ${formatMoney(market)} не совпадает с оценкой аукционного дома ${formatMoney(quote.appraisedValue)}. Моя цена: ${formatMoney(quote.appraisedValue)}.`
    },
    {
      speaker: 'auctioneer',
      name: auctioneerName,
      price: quote.saleProceeds,
      text: `Аукционист ${auctioneerName}: моя цена продажи лота «${lot.productName}» — ${formatMoney(quote.saleProceeds)}${quote.auctioneerBonusPercent ? ` (бонус аукциониста +${quote.auctioneerBonusPercent}%)` : ''}. ${auctioneerClosing}`
    }
  ];
}

/**
 * Simulates NPC buyers competing for a lot. NPC bidders interested in the lot
 * type each have a participation chance influenced by the auction-house level
 * and the syndicate's reputation. Participating bidders submit a bid above the
 * base appraised value scaled by their personal aggression. The highest NPC
 * bid wins; if it exceeds the base proceeds the lot sells at the NPC price,
 * otherwise the syndicate falls back to the standard appraisal+auctioneer bonus.
 *
 * The building level also acts as a "prominence" multiplier: a level-3 auction
 * house draws more aggressive bidding than a freshly built one.
 */
export function simulateNpcBidding(
  lot: AuctionLot,
  baseProceeds: number,
  auctionHouseLevel: number,
  reputation: number,
  random: () => number = Math.random
): NpcAuctionResult {
  const isCharacterLot = 'characterId' in lot;
  const lotType: LotInterest = isCharacterLot ? 'characters' : 'goods';

  const interestedBidders = NPC_AUCTION_BIDDERS.filter(
    bidder => bidder.interest === lotType || bidder.interest === 'all'
  );

  if (auctionHouseLevel <= 0) {
    return { finalProceeds: baseProceeds, npcBidCount: 0, npcInterest: interestedBidders.map(b => b.name) };
  }

  const buildingMultiplier = 1.0 + (auctionHouseLevel - 1) * 0.3;
  const reputationBoost = reputation / 100 * 0.2;
  const participationRate = Math.min(1.0, 0.4 + auctionHouseLevel * 0.15 + reputation / 100 * 0.3);

  let winningBid = 0;
  let winningBidder: string | undefined;
  let bidCount = 0;

  for (const bidder of interestedBidders) {
    if (random() > participationRate) continue;

    bidCount++;
    const variance = 0.7 + random() * 0.6;
    const bid = Math.round(baseProceeds * (1 + bidder.aggression * buildingMultiplier * (1 + reputationBoost) * variance));

    if (bid > winningBid) {
      winningBid = bid;
      winningBidder = bidder.name;
    }
  }

  if (winningBid > baseProceeds && winningBidder) {
    return {
      finalProceeds: winningBid,
      winningNpcBidder: winningBidder,
      npcWinningBid: winningBid,
      npcBidCount: bidCount,
      npcInterest: interestedBidders.map(b => b.name)
    };
  }

  return {
    finalProceeds: baseProceeds,
    npcBidCount: bidCount,
    npcInterest: interestedBidders.map(b => b.name)
  };
}

/**
 * Removes a lot once and stores the realized sale. NPC bidders compete for the
 * lot; if an NPC bid exceeds the base appraisal + auctioneer bonus the lot sells
 * at the NPC price. Stale IDs are a no-op.
 */
export function sellAuctionLot(
  state: AuctionHouseState,
  lotId: string,
  week: number,
  auctioneer: Employee | null = null,
  auctioneerSaleBonus = 0,
  auctionHouseLevel = 0,
  reputation = 0,
  random: () => number = Math.random
): { state: AuctionHouseState; sale: AuctionSale | null } {
  const lot = state.pendingLots.find(item => item.id === lotId);
  if (!lot) return { state, sale: null };
  const quote = quoteAuctionLot(lot, auctioneer, auctioneerSaleBonus);
  const npcResult = simulateNpcBidding(lot, quote.saleProceeds, auctionHouseLevel, reputation, random);
  const sale = {
    ...lot,
    soldWeek: Math.max(1, Math.floor(week)),
    saleProceeds: npcResult.finalProceeds,
    auctioneerBonusPercent: quote.auctioneerBonusPercent,
    winningNpcBidder: npcResult.winningNpcBidder,
    npcWinningBid: npcResult.npcWinningBid
  } as AuctionSale;
  return {
    state: {
      pendingLots: state.pendingLots.filter(item => item.id !== lotId),
      pendingSaleConsents: state.pendingSaleConsents.filter(request => request.lotId !== lotId),
      recentSales: [sale, ...state.recentSales].slice(0, AUCTION_SALES_HISTORY_LIMIT)
    },
    sale
  };
}

/**
 * Выставляет запрос администратора аукционного дома на продажу
 * лота персонала. Товарные лоты не требуют согласия, поэтому
 * для них запрос не создаётся. Повторный запрос для того же
 * лота — no-op.
 */
export function requestCharacterSaleConsent(
  state: AuctionHouseState,
  lotId: string,
  week: number,
  administratorName: string = AUCTION_HOUSE_ADMINISTRATOR
): AuctionHouseState {
  const lot = state.pendingLots.find(item => item.id === lotId);
  if (!lot || !('characterId' in lot)) return state;
  if (state.pendingSaleConsents.some(request => request.lotId === lotId)) return state;
  return {
    ...state,
    pendingSaleConsents: [
      {
        lotId: lot.id,
        lotName: lot.productName,
        characterId: lot.characterId,
        isSlave: lot.isSlave,
        category: lot.category,
        appraisedValue: lot.appraisedValue,
        requestedWeek: Math.max(1, Math.floor(week)),
        administratorName
      },
      ...state.pendingSaleConsents
    ].slice(0, AUCTION_SALE_CONSENT_LIMIT)
  };
}

/** Отзывает запрос администратора на продажу лота. */
export function cancelCharacterSaleConsent(
  state: AuctionHouseState,
  lotId: string
): AuctionHouseState {
  if (!state.pendingSaleConsents.some(request => request.lotId === lotId)) return state;
  return {
    ...state,
    pendingSaleConsents: state.pendingSaleConsents.filter(request => request.lotId !== lotId)
  };
}

/** True, когда администратор уже запросил согласие на продажу лота. */
export function hasPendingSaleConsent(
  state: AuctionHouseState,
  lotId: string
): boolean {
  return state.pendingSaleConsents.some(request => request.lotId === lotId);
}

/** Backward-compatible alias for the generalized lot seller. */
export const sellGoodsLot = sellAuctionLot;

/** Returns the list of NPC bidder names interested in the given lot type. */
export function getLotNpcInterest(lot: AuctionLot): string[] {
  const isCharacterLot = 'characterId' in lot;
  const lotType: LotInterest = isCharacterLot ? 'characters' : 'goods';
  return NPC_AUCTION_BIDDERS.filter(bidder => bidder.interest === lotType || bidder.interest === 'all')
    .map(bidder => bidder.name);
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');
const positiveInteger = (value: unknown, fallback = 0): number => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

function normalizeLot(value: unknown): AuctionLot | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.productName !== 'string') return null;
  if (typeof value.characterId === 'string') {
    const category = (value.category === 'Сотрудник' || value.category === 'Раб') ? value.category : 'Сотрудник';
    const gender = (value.gender === 'women' || value.gender === 'men' || value.gender === 'trans') ? value.gender : 'women';
    return {
      id: value.id,
      productName: value.productName,
      category,
      characterId: value.characterId,
      gender,
      assignedVenue: typeof value.assignedVenue === 'string' ? value.assignedVenue : 'unassigned',
      isSlave: value.isSlave === true,
      appraisedBy: typeof value.appraisedBy === 'string' ? value.appraisedBy : 'Автоматическая оценка',
      appraisedValue: positiveInteger(value.appraisedValue)
    } as AuctionCharacterLot;
  }
  if (typeof value.caravanId !== 'string' || typeof value.caravanName !== 'string' || typeof value.category !== 'string') return null;
  return {
    id: value.id,
    productName: value.productName,
    category: value.category,
    quantity: Math.max(1, positiveInteger(value.quantity, 1)),
    caravanId: value.caravanId,
    caravanName: value.caravanName,
    arrivalWeek: Math.max(1, positiveInteger(value.arrivalWeek, 1)),
    appraisedBy: typeof value.appraisedBy === 'string' ? value.appraisedBy : 'Автоматическая оценка',
    appraisedValue: positiveInteger(value.appraisedValue)
  } as AuctionGoodsLot;
}

function normalizeSale(value: unknown): AuctionSale | null {
  const lot = normalizeLot(value);
  if (!lot || !isRecord(value)) return null;
  return {
    ...lot,
    soldWeek: Math.max(1, positiveInteger(value.soldWeek, 1)),
    saleProceeds: positiveInteger(value.saleProceeds),
    auctioneerBonusPercent: Math.min(20, positiveInteger(value.auctioneerBonusPercent)),
    winningNpcBidder: typeof value.winningNpcBidder === 'string' ? value.winningNpcBidder : undefined,
    npcWinningBid: typeof value.npcWinningBid === 'number' && Number.isFinite(value.npcWinningBid) ? positiveInteger(value.npcWinningBid) : undefined
  } as AuctionSale;
}

function normalizeSaleConsent(value: unknown): SaleConsentRequest | null {
  if (!isRecord(value) || typeof value.lotId !== 'string' || typeof value.characterId !== 'string') return null;
  const category = (value.category === 'Сотрудник' || value.category === 'Раб') ? value.category : 'Сотрудник';
  return {
    lotId: value.lotId,
    lotName: typeof value.lotName === 'string' ? value.lotName : '',
    characterId: value.characterId,
    isSlave: value.isSlave === true,
    category,
    appraisedValue: positiveInteger(value.appraisedValue),
    requestedWeek: Math.max(1, positiveInteger(value.requestedWeek, 1)),
    administratorName: typeof value.administratorName === 'string' ? value.administratorName : AUCTION_HOUSE_ADMINISTRATOR
  };
}

/** Backward-compatible, bounded normalizer for campaign saves. */
export function normalizeAuctionHouseState(value: unknown): AuctionHouseState {
  if (!isRecord(value)) return createEmptyAuctionHouse();
  const pendingLots = Array.isArray(value.pendingLots)
    ? value.pendingLots.map(normalizeLot).filter((lot): lot is AuctionLot => lot !== null).slice(0, 200)
    : [];
  const recentSales = Array.isArray(value.recentSales)
    ? value.recentSales.map(normalizeSale).filter((sale): sale is AuctionSale => sale !== null).slice(0, AUCTION_SALES_HISTORY_LIMIT)
    : [];
  const pendingSaleConsents = Array.isArray(value.pendingSaleConsents)
    ? value.pendingSaleConsents.map(normalizeSaleConsent).filter((request): request is SaleConsentRequest => request !== null).slice(0, AUCTION_SALE_CONSENT_LIMIT)
    : [];
  return { pendingLots, recentSales, pendingSaleConsents };
}
