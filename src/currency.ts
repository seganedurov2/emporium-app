/**
 * Bitcoin display layer.
 *
 * The game economy is stored in USD internally; every money display
 * converts to BTC using the real-time BTC/USD spot rate fetched from
 * public market APIs. When offline, the last cached rate (up to 24h
 * old) is reused; a constant fallback covers the very first launch.
 */

export const BTC_FALLBACK_RATE = 100000;

const RATE_CACHE_KEY = 'emporium_btc_rate';
const RATE_TS_KEY = 'emporium_btc_rate_ts';
const REFRESH_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let cachedRate: number | null = null;
let inFlight: Promise<number> | null = null;
const listeners = new Set<(rate: number) => void>();

function readCache(): { rate: number; ts: number } | null {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    const ts = Number(localStorage.getItem(RATE_TS_KEY) ?? 0);
    if (!raw || !Number.isFinite(ts)) return null;
    const rate = Number(raw);
    return rate > 0 ? { rate, ts } : null;
  } catch {
    return null;
  }
}

function writeCache(rate: number): void {
  try {
    localStorage.setItem(RATE_CACHE_KEY, String(rate));
    localStorage.setItem(RATE_TS_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode etc.) — in-memory cache still works.
  }
}

async function fetchRate(url: string, extract: (data: unknown) => number | null): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const rate = extract(await response.json());
    return rate !== null && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/** Fetch the real BTC/USD spot rate; tries several public APIs in order. */
export async function refreshBtcRate(): Promise<number> {
  if (inFlight) return inFlight;
  const fresh = readCache();
  if (fresh && Date.now() - fresh.ts < REFRESH_TTL_MS) {
    cachedRate = fresh.rate;
    return cachedRate;
  }
  inFlight = (async () => {
    const rate =
      (await fetchRate(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        (data) => (data as { bitcoin?: { usd?: number } })?.bitcoin?.usd ?? null,
      )) ??
      (await fetchRate(
        'https://api.coinbase.com/v2/prices/BTC-USD/spot',
        (data) => {
          const amount = (data as { data?: { amount?: string } })?.data?.amount;
          return amount ? Number(amount) : null;
        },
      )) ??
      (await fetchRate(
        'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
        (data) => {
          const price = (data as { price?: string })?.price;
          return price ? Number(price) : null;
        },
      )) ??
      (await fetchRate(
        'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
        (data) => {
          const result = (data as { result?: Record<string, { c?: [string] }> })?.result;
          const pair = result && Object.values(result)[0];
          const close = pair?.c?.[0];
          return close ? Number(close) : null;
        },
      )) ??
      cachedRate ??
      BTC_FALLBACK_RATE;

    cachedRate = rate;
    writeCache(rate);
    listeners.forEach((listener) => listener(rate));
    return rate;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Current BTC/USD rate — cached value, never blocks on the network. */
export function getBtcRate(): number {
  if (cachedRate !== null) return cachedRate;
  const cache = readCache();
  if (cache && Date.now() - cache.ts < CACHE_MAX_AGE_MS) {
    cachedRate = cache.rate;
    return cachedRate;
  }
  return BTC_FALLBACK_RATE;
}

/** Convert a USD amount to BTC at the current real rate. */
export function usdToBtc(usd: number): number {
  return usd / getBtcRate();
}

function formatBtc(usd: number): string {
  if (!Number.isFinite(usd)) return '₿—';
  const btc = usdToBtc(usd);
  const abs = Math.abs(btc);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return `₿${btc.toFixed(digits)}`;
}

/** Format a USD amount as BTC, e.g. ₿0.0612 (sign preserved for negatives). */
export function formatMoney(usd: number): string {
  return formatBtc(usd);
}

/** Format a USD amount as signed BTC, e.g. +₿0.0612 / -₿0.0123. */
export function formatSignedMoney(usd: number): string {
  const sign = usd > 0 ? '+' : usd < 0 ? '-' : '';
  return `${sign}${formatBtc(Math.abs(usd))}`;
}

/** Subscribe to rate updates; returns an unsubscribe function. */
export function subscribeBtcRate(listener: (rate: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
