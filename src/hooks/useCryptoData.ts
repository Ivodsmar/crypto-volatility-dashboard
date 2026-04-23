import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchAll24hrTickers, fetch1hrTickers, fetchSparklineData, fetchFuturesSymbols } from '../api/binance';
import { processAndRankTickers, preRankBy24h, calculateStochRSI } from '../utils/volatility';
import type { CryptoData, VolatilityColumn, BinanceTicker24hr } from '../types';

export interface CryptoSettings {
  columns: VolatilityColumn[];
  rankingTimeframe: string;
  refreshInterval: number;
  futuresOnly: boolean;
  klineInterval: string;
}

export const FIXED_COLUMNS: VolatilityColumn[] = [
  { timeframe: '1h', fixed: true },
  { timeframe: '30m', fixed: true },
  { timeframe: '15m', fixed: true },
  { timeframe: '3m', fixed: true },
  { timeframe: '1m', fixed: true },
];

export interface UseCryptoDataReturn {
  data: CryptoData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
}

export function useCryptoData(settings: CryptoSettings): UseCryptoDataReturn {
  const { columns, rankingTimeframe, refreshInterval, futuresOnly, klineInterval } = settings;
  const columnsKey = useMemo(() => columns.map((c) => c.timeframe).join(','), [columns]);
  const timeframes = useMemo(
    () => Array.from(new Set(columns.map((c) => c.timeframe))),
    [columns],
  );

  const [data, setData] = useState<CryptoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(refreshInterval);

  const futuresSymbolsRef = useRef<Set<string> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef(refreshInterval);
  const refreshIntervalTimerRef = useRef<ReturnType<typeof setInterval>>();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // Keep refreshInterval ref in sync so fetchData can read it without being in deps
  useEffect(() => {
    refreshIntervalRef.current = refreshInterval;
  }, [refreshInterval]);

  const fetchData = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    try {
      if (futuresOnly && !futuresSymbolsRef.current) {
        futuresSymbolsRef.current = await fetchFuturesSymbols();
      }
      if (controller.signal.aborted) return;
      const tickers24h = await fetchAll24hrTickers();
      if (controller.signal.aborted) return;
      const filtered24h = futuresOnly && futuresSymbolsRef.current
        ? tickers24h.filter((t) => futuresSymbolsRef.current!.has(t.symbol))
        : tickers24h;
      const candidates = preRankBy24h(filtered24h, 100);
      const symbols = candidates.map((t) => t.symbol);
      const perTfResults = await Promise.all(timeframes.map((tf) => fetch1hrTickers(symbols, tf)));
      if (controller.signal.aborted) return;
      const tickersByWindow = new Map<string, BinanceTicker24hr[]>();
      timeframes.forEach((tf, i) => tickersByWindow.set(tf, perTfResults[i] ?? []));
      const top50 = processAndRankTickers(filtered24h, tickersByWindow, rankingTimeframe);
      const top50Symbols = top50.map((item) => item.symbol);
      const sparklineMap = await fetchSparklineData(top50Symbols, klineInterval, 100);
      if (controller.signal.aborted) return;
      const merged = top50.map((item) => {
        const prices = sparklineMap.get(item.symbol) ?? [];
        return {
          ...item,
          sparklineData: prices,
          stochRsi: prices.length > 0 ? calculateStochRSI(prices) : { k: null, d: null },
        };
      });

      setData(merged);
      setLastUpdated(new Date());
      setError(null);
      setSecondsUntilRefresh(refreshIntervalRef.current);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch crypto data');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [columnsKey, rankingTimeframe, futuresOnly, klineInterval]);

  // Initial fetch + auto-refresh; restart whenever columns, ranking, futuresOnly, or refreshInterval changes
  useEffect(() => {
    fetchData();
    clearInterval(refreshIntervalTimerRef.current);
    refreshIntervalTimerRef.current = setInterval(fetchData, refreshInterval * 1000);
    return () => {
      clearInterval(refreshIntervalTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [fetchData, refreshInterval]);

  // Countdown timer; resets whenever the interval or fetch cycle changes
  useEffect(() => {
    setSecondsUntilRefresh(refreshInterval);
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? refreshIntervalRef.current : prev - 1));
    }, 1000);
    return () => clearInterval(countdownIntervalRef.current);
  }, [refreshInterval]);

  return { data, isLoading, error, lastUpdated, secondsUntilRefresh };
}
