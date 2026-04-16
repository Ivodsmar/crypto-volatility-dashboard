import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAll24hrTickers, fetch1hrTickers, fetchSparklineData, fetchFuturesSymbols } from '../api/binance';
import { processAndRankTickers, preRankBy24h, calculateRSI } from '../utils/volatility';
import type { CryptoData } from '../types';

export interface CryptoSettings {
  windowSize: string;   // e.g. '15m', '30m', '1h', '2h', '4h'
  refreshInterval: number; // seconds
  futuresOnly: boolean;
}

export interface UseCryptoDataReturn {
  data: CryptoData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
}

export function useCryptoData(settings: CryptoSettings): UseCryptoDataReturn {
  const { windowSize, refreshInterval, futuresOnly } = settings;

  const [data, setData] = useState<CryptoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(refreshInterval);

  const futuresSymbolsRef = useRef<Set<string> | null>(null);
  const refreshIntervalRef = useRef(refreshInterval);
  const refreshIntervalTimerRef = useRef<ReturnType<typeof setInterval>>();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // Keep refreshInterval ref in sync so fetchData can read it without being in deps
  useEffect(() => {
    refreshIntervalRef.current = refreshInterval;
  }, [refreshInterval]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch futures symbols once and cache for session
      if (futuresOnly && !futuresSymbolsRef.current) {
        futuresSymbolsRef.current = await fetchFuturesSymbols();
      }

      // Step 1: Fetch 24h tickers, optionally filter to futures
      const tickers24h = await fetchAll24hrTickers();
      const filtered24h = futuresOnly && futuresSymbolsRef.current
        ? tickers24h.filter((t) => futuresSymbolsRef.current!.has(t.symbol))
        : tickers24h;

      // Step 2: Pre-rank by 24h change to find top candidates
      const candidates = preRankBy24h(filtered24h, 100);

      // Step 3: Fetch rolling-window data for the selected time window
      const tickersWindow = await fetch1hrTickers(candidates.map((t) => t.symbol), windowSize);

      // Step 4: Re-rank by window volatility, return top 50
      const top50 = processAndRankTickers(filtered24h, tickersWindow);
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
      setSecondsUntilRefresh(refreshIntervalRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch crypto data');
    } finally {
      setIsLoading(false);
    }
  }, [windowSize, futuresOnly]);

  // Initial fetch + auto-refresh; restart whenever windowSize, futuresOnly, or refreshInterval changes
  useEffect(() => {
    fetchData();
    clearInterval(refreshIntervalTimerRef.current);
    refreshIntervalTimerRef.current = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(refreshIntervalTimerRef.current);
  }, [fetchData, refreshInterval]);

  // Countdown timer; resets whenever the interval or fetch cycle changes
  useEffect(() => {
    setSecondsUntilRefresh(refreshInterval);
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? refreshIntervalRef.current : prev - 1));
    }, 1000);
    return () => clearInterval(countdownIntervalRef.current);
  }, [fetchData, refreshInterval]);

  return { data, isLoading, error, lastUpdated, secondsUntilRefresh };
}
