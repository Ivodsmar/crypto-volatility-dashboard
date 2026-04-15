import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAll24hrTickers, fetch1hrTickers, fetchSparklineData } from '../api/binance';
import { processAndRankTickers } from '../utils/volatility';
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
      const [tickers24h, tickers1h] = await Promise.all([
        fetchAll24hrTickers(),
        fetch1hrTickers(),
      ]);
      const top50 = processAndRankTickers(tickers24h, tickers1h);
      const symbols = top50.map((item) => item.symbol);
      const sparklineMap = await fetchSparklineData(symbols);

      const merged = top50.map((item) => ({
        ...item,
        sparklineData: sparklineMap.get(item.symbol) ?? item.sparklineData,
      }));

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
