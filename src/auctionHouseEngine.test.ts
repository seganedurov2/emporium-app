import { describe, expect, it } from 'vitest';
import {
  AUCTION_INSPECTION_BALANCE,
  countCounterfeitLots,
  createEmptyAuctionHouse,
  getLotInspection,
  inspectAuctionLot,
  normalizeAuctionHouseState,
  sellAuctionLot,
  sellCounterfeitsBulk,
  type AuctionGoodsLot,
  type AuctionHouseStaff
} from './auctionHouseEngine';

const goodsLot = (overrides: Partial<AuctionGoodsLot> = {}): AuctionGoodsLot => ({
  id: 'g1',
  productName: 'Шёлк',
  category: 'Текстиль',
  quantity: 2,
  caravanId: 'c1',
  caravanName: 'Караван',
  arrivalWeek: 3,
  appraisedBy: 'Оценщик',
  appraisedValue: 1000,
  authenticity: 'genuine',
  revealedAuthenticity: false,
  ...overrides
});

const staff: AuctionHouseStaff = { auctioneer: null, appraiser: null, buildingLevel: 0 };
const appraiserStaff: AuctionHouseStaff = {
  auctioneer: null,
  appraiser: { id: 'a1', name: 'Оценщик', specialty: 'appraiser', status: 'active', weeklyWage: 0, morale: 100, skill: 50, assignedBuildingId: 'auction_house' } as never,
  buildingLevel: 1
};

describe('auctionHouseEngine (inspect/counterfeit/junkyard)', () => {
  it('normalizes legacy saves with defaults', () => {
    const state = normalizeAuctionHouseState({ pendingLots: [], recentSales: [], pendingSaleConsents: [] });
    expect(state.inspections).toEqual([]);
    expect(state.inspectWeek).toBe(1);
    expect(state.inspectChargesUsed).toBe(0);
  });

  it('limits free inspections without appraiser and reveals counterfeit with appraiser', () => {
    let state: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'x', authenticity: 'counterfeit' })], inspectWeek: 5, inspectChargesUsed: 0 };
    for (let i = 0; i < AUCTION_INSPECTION_BALANCE.freeChargesPerWeek; i++) {
      const r = inspectAuctionLot(state, 'x', 5, staff, () => 0.9);
      state = r.state;
      expect(r.inspection).toBeTruthy();
    }
    const blocked = inspectAuctionLot(state, 'x', 5, staff, () => 0.9);
    expect(blocked.inspection).toBeNull();
    expect(blocked.reason).toMatch(/Лимит/);

    const withAppraiser: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ id: 'y', authenticity: 'counterfeit' })], inspectWeek: 5, inspectChargesUsed: 99 };
    const revealed = inspectAuctionLot(withAppraiser, 'y', 5, appraiserStaff, () => 0.9);
    expect(revealed.inspection?.verdict).toBe('counterfeit');
    expect(getLotInspection(revealed.state, 'y')?.revealedCounterfeit).toBe(true);
    expect(revealed.state.pendingLots[0]?.revealedAuthenticity).toBe(true);
  });

  it('penalizes revealed counterfeit sale and creates scandal for undisclosed counterfeit', () => {
    const revealedState: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ authenticity: 'counterfeit', revealedAuthenticity: true })] };
    const revealedSale = sellAuctionLot(revealedState, 'g1', 6, null, 0, 0, 0, () => 0);
    expect(revealedSale.sale?.saleProceeds).toBe(Math.round(1000 * AUCTION_INSPECTION_BALANCE.counterfeitSalePenaltyPct));
    expect(revealedSale.sale?.revealedCounterfeit).toBe(true);
    expect(revealedSale.scandal).toBeUndefined();

    const hiddenState: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: [goodsLot({ authenticity: 'counterfeit', revealedAuthenticity: false })] };
    const hiddenSale = sellAuctionLot(hiddenState, 'g1', 6, null, 0, 0, 0, () => 0);
    expect(hiddenSale.reputationDelta).toBe(-AUCTION_INSPECTION_BALANCE.undisclosedScandalReputation);
    expect(hiddenSale.fundsDelta).toBeLessThan(0);
    expect(hiddenSale.scandal).toMatch(/поддел/);
  });

  it('sells counterfeits in bulk via junkyard when threshold met', () => {
    const lots = Array.from({ length: AUCTION_INSPECTION_BALANCE.junkyardUnlockCount }, (_, i) =>
      goodsLot({ id: `c${i}`, authenticity: 'counterfeit', appraisedValue: 1000 })
    );
    const state: ReturnType<typeof createEmptyAuctionHouse> = { ...createEmptyAuctionHouse(), pendingLots: lots };
    expect(countCounterfeitLots(state)).toBe(AUCTION_INSPECTION_BALANCE.junkyardUnlockCount);
    const bulk = sellCounterfeitsBulk(state, 7);
    expect(bulk.count).toBe(AUCTION_INSPECTION_BALANCE.junkyardUnlockCount);
    expect(bulk.proceeds).toBe(Math.round(1000 * AUCTION_INSPECTION_BALANCE.junkyardBulkRate) * bulk.count);
    expect(bulk.state.pendingLots).toHaveLength(0);
    expect(bulk.state.recentSales[0]?.saleChannel).toBe('junkyard');
  });
});
