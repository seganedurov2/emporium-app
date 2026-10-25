import { refreshMarketPool } from './gameEngine';
import type { Character } from './gameEngine';

/**
 * Weekly refresh of the global marketplace.
 *
 * The previous design spawned a Node process to generate new
 * portraits, which cannot run in a browser, the Telegram
 * WebView or the Android APK. The marketplace now restocks
 * entirely client-side: reserved, non-acquired candidates keep
 * their slots for one refresh, everything else is replaced
 * with fresh faces from the existing portrait pool.
 */

/** Chance that a week announces a "new shipment" in the journal. */
const SHIPMENT_ANNOUNCE_CHANCE = 0.4;

export interface MarketRefreshResult {
  /** True when the journal announces a new shipment this week. */
  triggered: boolean;
  message: string;
  /** The restocked marketplace pool. */
  pool: Character[];
}

/**
 * Restocks the global market pool for the new week.
 * Reserved candidates survive one refresh; acquired listings
 * are always replaced.
 */
export function triggerWeeklyMarketRefresh(
  pool: Character[],
  reservedCharacterIds: string[] = []
): MarketRefreshResult {
  const nextPool = refreshMarketPool(pool, reservedCharacterIds);
  const triggered = Math.random() < SHIPMENT_ANNOUNCE_CHANCE;
  return {
    triggered,
    message: triggered
      ? 'Глобальный рынок: из регионов прибыла новая партия кандидатов.'
      : 'Глобальный рынок обновлён: свободные места заняли новые кандидаты.',
    pool: nextPool
  };
}
