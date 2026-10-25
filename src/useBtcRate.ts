import { useEffect, useState } from 'react';
import { getBtcRate, refreshBtcRate, subscribeBtcRate } from './currency';

/**
 * Live BTC/USD rate. Fetches the real spot rate on mount, refreshes
 * every 5 minutes, and re-renders subscribers whenever the rate changes.
 */
export function useBtcRate(): number {
  const [rate, setRate] = useState(getBtcRate);

  useEffect(() => {
    const unsubscribe = subscribeBtcRate(setRate);
    void refreshBtcRate();
    const interval = setInterval(() => {
      void refreshBtcRate();
    }, 5 * 60 * 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return rate;
}
