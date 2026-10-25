import type { Character } from './gameEngine';

/**
 * Calculates the final purchase price of a candidate based on market demand 
 * and the syndicate's regional standing.
 * 
 * @param basePrice The raw calculated price based on skill.
 * @param demand The current regional demand multiplier (e.g., 1.15).
 * @param standing The syndicate's regional standing (0-100).
 */
export function calculateFinalMarketPrice(basePrice: number, demand: number, standing: number): number {
  // Standing provides a discount: 0 standing = 1.0x, 100 standing = 0.8x (20% discount)
  const standingDiscount = 1 - (standing / 100) * 0.2;
  return Math.floor(basePrice * demand * standingDiscount);
}

/**
 * Updates the regional demand and standing after a purchase.
 */
export function updateRegionalMarketAfterPurchase(
  demand: Record<string, number>,
  standing: Record<string, number>,
  regionId: string
): { nextDemand: Record<string, number>, nextStanding: Record<string, number> } {
  return {
    nextDemand: {
      ...demand,
      [regionId]: (demand[regionId] ?? 1) + 0.05
    },
    nextStanding: {
      ...standing,
      [regionId]: Math.min(100, (standing[regionId] ?? 50) + 1)
    }
  };
}

/**
 * Weekly decay of market demand and regional standing.
 */
export function decayMarketDynamics(
  demand: Record<string, number>,
  standing: Record<string, number>
): { nextDemand: Record<string, number>, nextStanding: Record<string, number> } {
  const nextDemand: Record<string, number> = {};
  for (const regionId in demand) {
    nextDemand[regionId] = Math.max(1, demand[regionId] - 0.02);
  }

  const nextStanding: Record<string, number> = {};
  for (const regionId in standing) {
    nextStanding[regionId] = Math.max(0, standing[regionId] - 0.5);
  }

  return { nextDemand, nextStanding };
}
