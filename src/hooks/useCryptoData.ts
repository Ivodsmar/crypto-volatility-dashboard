import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAll24hrTickers, fetch1hrTickers, fetchSparklineData } from '../api/binance';
import { processAndRankTickers, preRankBy24h, calculateRSI } from '../utils/volatility';
import type { CryptoData } from '../types';

const REFRESH_INTERVAL = 300; // 5 minutes in seconds

export interface UseCryptoDataReturn {
  data: CryptoData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
}

export function useCryptoData(): UseCryptoDataReturn {
  const [data, setData] = useState<CryptoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Step 1: Fetch 24h tickers and pre-rank to find top candidates
      const tickers24h = await fetchAll24hrTickers();
      const candidates = preRankBy24h(tickers24h, 100);

      // Step 2: Fetch 1h data only for top candidates (API requires symbol list)
      const tickers1h = await fetch1hrTickers(candidates.map((t) => t.symbol));

      // Step 3: Re-rank by 1h volatility, return top 50
      const top50 = processAndRankTickers(tickers24h, tickers1h);
      const symbols = top50.map((item) => item.symbol);
      const sparklineMap = await fetchSparklineData(symbols);

      const merged = top50.map((item) => {
        const prices = sparklineMap.get(item.symbol) ?? [];
        return {
          ...item,
          sparklineData: prices,
          rsi: prices.length > 0 ? calculateRSI(prices) : null,
        };
      });

      setData(merged);
      setLastUpdated(new Date());
      setError(null);
      setSecondsUntilRefresh(REFRESH_INTERVAL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch crypto data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData();
    refreshIntervalRef.current = setInterval(fetchData, REFRESH_INTERVAL * 1000);
    return () => clearInterval(refreshIntervalRef.current);
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    countdownIntervalRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);
    return () => clearInterval(countdownIntervalRef.current);
  }, []);

  return { data, isLoading, error, lastUpdated, secondsUntilRefresh };
}
