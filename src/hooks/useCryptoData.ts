import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  fetchAll24hrTickers,
  fetchFuturesAllWindowedStats,
  fetchSparklineData,
  fetchTodayChangeSinceMidnight,
  fetchKlinesByTimeframes,
  windowToMinutes,
} from '../api/binance';
import { processAndRankTickers, preRankBy24h, calculateStochRSI } from '../utils/volatility';

import type { CryptoData, VolatilityColumn } from '../types';

export interface CryptoSettings {
  columns: VolatilityColumn[];
  rankingTimeframe: string;
  refreshInterval: number;
  klineInterval: string;
}

export const FIXED_COLUMNS: VolatilityColumn[] = [
  { timeframe: '5m', fixed: true },
  { timeframe: '15m', fixed: true },
  { timeframe: '30m', fixed: true },
  { timeframe: '1h', fixed: true },
];

export interface UseCryptoDataReturn {
  data: CryptoData[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
}

export function useCryptoData(settings: CryptoSettings): UseCryptoDataReturn {
  const { columns, rankingTimeframe, refreshInterval, klineInterval } = settings;
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef(refreshInterval);
  const refreshIntervalTimerRef = useRef<ReturnType<typeof setInterval>>();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // StochRSI cache: only re-fetch a timeframe when a new bar has closed.
  const stochRsiCacheRef = useRef<{
    computed: Map<string, Record<string, { k: number | null; d: number | null }>>;
    lastFetchedAtByTf: Record<string, number>;
  }>({ computed: new Map(), lastFetchedAtByTf: {} });

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
      const tickers24h = await fetchAll24hrTickers();
      if (controller.signal.aborted) return;
      const candidates = preRankBy24h(tickers24h, 100);
      const symbols = candidates.map((t) => t.symbol);

      const tickersByWindow = await fetchFuturesAllWindowedStats(symbols, timeframes);
      if (controller.signal.aborted) return;
      const top50 = processAndRankTickers(tickers24h, tickersByWindow, rankingTimeframe);
      const top50Symbols = top50.map((item) => item.symbol);

      // Local-midnight-anchored "Today %" — matches Binance's timezone-locked
      // 24h column (counts from midnight in the user's local timezone).
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const sinceMidnightMs = midnight.getTime();

      const cache = stochRsiCacheRef.current;
      const now = Date.now();

      // A timeframe is stale when a new bar has closed since we last fetched it.
      // e.g. for 1h: floor(now / 3600000) !== floor(lastFetch / 3600000)
      const staleTfs = timeframes.filter((tf) => {
        const periodMs = windowToMinutes(tf) * 60_000;
        const last = cache.lastFetchedAtByTf[tf] ?? 0;
        return Math.floor(now / periodMs) !== Math.floor(last / periodMs);
      });

      // New symbols that entered the top50 since last cache fill
      const newSymbols = top50Symbols.filter((s) => !cache.computed.has(s));

      // Fetch only what's needed
      const tfsToFetch = newSymbols.length > 0 ? timeframes : staleTfs;

      const [sparklineMap, todayChangeMap] = await Promise.all([
        fetchSparklineData(top50Symbols, klineInterval, 100),
        fetchTodayChangeSinceMidnight(top50Symbols, sinceMidnightMs),
      ]);

      if (tfsToFetch.length > 0) {
        const klinesMap = await fetchKlinesByTimeframes(top50Symbols, tfsToFetch, 200);
        if (controller.signal.aborted) return;

        for (const symbol of top50Symbols) {
          const existing = cache.computed.get(symbol) ?? {};
          const tfKlines = klinesMap.get(symbol) ?? {};
          const updated = { ...existing };
          for (const tf of tfsToFetch) {
            const closes = tfKlines[tf] ?? [];
            updated[tf] = closes.length > 0 ? calculateStochRSI(closes) : { k: null, d: null };
          }
          cache.computed.set(symbol, updated);
        }
        for (const tf of tfsToFetch) {
          cache.lastFetchedAtByTf[tf] = now;
        }
      }

      if (controller.signal.aborted) return;
      const merged = top50.map((item) => {
        const prices = sparklineMap.get(item.symbol) ?? [];
        const todayPct = todayChangeMap.get(item.symbol);
        const stochRsiByWindow = cache.computed.get(item.symbol) ?? {};
        return {
          ...item,
          priceChangePercent: todayPct ?? item.priceChangePercent,
          sparklineData: prices,
          stochRsi: prices.length > 0 ? calculateStochRSI(prices) : { k: null, d: null },
          stochRsiByWindow,
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
  }, [columnsKey, rankingTimeframe, klineInterval]);

  // Initial fetch + auto-refresh; restart whenever columns, ranking, or refreshInterval changes
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
