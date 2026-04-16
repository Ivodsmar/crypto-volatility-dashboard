import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchAll24hrTickers, fetch1hrTickers, fetchSparklineData, fetchFuturesSymbols } from '../api/binance';
import { processAndRankTickers, preRankBy24h, calculateRSI } from '../utils/volatility';
import type { CryptoData, VolatilityColumn, BinanceTicker24hr } from '../types';

export interface CryptoSettings {
  columns: VolatilityColumn[];
  rankingTimeframe: string;
  refreshInterval: number;
  futuresOnly: boolean;
}

export const FIXED_COLUMNS: VolatilityColumn[] = [
  { timeframe: '1h', fixed: true },
  { timeframe: '30m', fixed: true },
  { timeframe: '15m', fixed: true },
];

export interface UseCryptoDataReturn {
  data: CryptoData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
}

export function useCryptoData(settings: CryptoSettings): UseCryptoDataReturn {
  const { columns, rankingTimeframe, refreshInterval, futuresOnly } = settings;
  const columnsKey = useMemo(() => columns.map((c) => c.timeframe).join(','), [columns]);
  const timeframes = useMemo(
    () => Array.from(new Set(columns.map((c) => c.timeframe))),
    [columnsKey],
  );

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

      const symbols = candidates.map((t) => t.symbol);
      const perTfResults = await Promise.all(timeframes.map((tf) => fetch1hrTickers(symbols, tf)));
      const tickersByWindow = new Map<string, BinanceTicker24hr[]>();
      timeframes.forEach((tf, i) => tickersByWindow.set(tf, perTfResults[i] ?? []));

      // Step 3: Re-rank by window volatility, return top 50
      const top50 = processAndRankTickers(filtered24h, tickersByWindow, rankingTimeframe);
      const top50Symbols = top50.map((item) => item.symbol);
      const sparklineMap = await fetchSparklineData(top50Symbols);

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
  }, [columnsKey, rankingTimeframe, futuresOnly]);

  // Initial fetch + auto-refresh; restart whenever columns, ranking, futuresOnly, or refreshInterval changes
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
