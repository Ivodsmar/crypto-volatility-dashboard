import type { BinanceTicker24hr, BinanceKline } from '../types';

const BASE_URL = 'https://api.binance.com';
const FUTURES_BASE = 'https://fapi.binance.com';
const FETCH_TIMEOUT = 10000;
const BATCH_SIZE = 10;
const BATCH_DELAY = 200;

const LEVERAGED_TOKENS = ['UP', 'DOWN', 'BEAR', 'BULL'];

async function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  } finally {
    clearTimeout(id);
  }
}

function isLeveragedToken(symbol: string): boolean {
  return LEVERAGED_TOKENS.some((token) => symbol.includes(token));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAll24hrTickers(futuresOnly: boolean): Promise<BinanceTicker24hr[]> {
  const url = futuresOnly
    ? `${FUTURES_BASE}/fapi/v1/ticker/24hr`
    : `${BASE_URL}/api/v3/ticker/24hr`;
  const response = await fetchWithTimeout(url);
  let tickers: BinanceTicker24hr[];
  try {
    tickers = (await response.json()) as BinanceTicker24hr[];
  } catch {
    throw new Error('Failed to parse 24hr ticker response from Binance');
  }

  return tickers.filter(
    (t) => t.symbol.endsWith('USDT') && !t.symbol.includes('_') && !isLeveragedToken(t.symbol),
  );
}

export function windowToMinutes(windowSize: string): number {
  const match = /^([0-9]+)(m|h|d)$/.exec(windowSize);
  if (!match) throw new Error(`Invalid windowSize: ${windowSize}`);
  const n = Number(match[1]);
  const unit = match[2];
  if (unit === 'h') return n * 60;
  if (unit === 'd') return n * 1440;
  return n;
}

function computeStatsFromKlines(symbol: string, klines: BinanceKline[]): BinanceTicker24hr | null {
  if (klines.length === 0) return null;
  const firstKline = klines[0];
  const lastKline = klines[klines.length - 1];
  if (!firstKline || !lastKline) return null;

  const openPrice = parseFloat(firstKline[1]);
  const closePrice = parseFloat(lastKline[4]);
  let highPrice = -Infinity;
  let lowPrice = Infinity;
  let volume = 0;
  let quoteVolume = 0;
  for (const k of klines) {
    const h = parseFloat(k[2]);
    const l = parseFloat(k[3]);
    const v = parseFloat(k[5]);
    const qv = parseFloat(k[7]);
    if (h > highPrice) highPrice = h;
    if (l < lowPrice) lowPrice = l;
    volume += v;
    quoteVolume += qv;
  }
  const priceChange = closePrice - openPrice;
  const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0;

  return {
    symbol,
    priceChange: priceChange.toString(),
    priceChangePercent: priceChangePercent.toString(),
    weightedAvgPrice: '0',
    prevClosePrice: openPrice.toString(),
    lastPrice: closePrice.toString(),
    lastQty: '0',
    bidPrice: '0',
    bidQty: '0',
    askPrice: '0',
    askQty: '0',
    openPrice: openPrice.toString(),
    highPrice: highPrice.toString(),
    lowPrice: lowPrice.toString(),
    volume: volume.toString(),
    quoteVolume: quoteVolume.toString(),
    openTime: firstKline[0] as number,
    closeTime: lastKline[6] as number,
    firstId: 0,
    lastId: 0,
    count: 0,
  } as unknown as BinanceTicker24hr;
}

async function fetchFuturesWindowedStats(
  symbols: string[],
  windowSize: string,
): Promise<BinanceTicker24hr[]> {
  const minutes = windowToMinutes(windowSize);
  const limit = Math.min(Math.max(minutes, 1), 1500);
  const result: BinanceTicker24hr[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const response = await fetchWithTimeout(
          `${FUTURES_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=${limit}`,
        );
        const klines = (await response.json()) as BinanceKline[];
        return { symbol, klines };
      }),
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const ticker = computeStatsFromKlines(outcome.value.symbol, outcome.value.klines);
      if (ticker) result.push(ticker);
    }

    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }

  return result;
}

// Fetches 1m klines ONCE per symbol for the largest requested window, then derives
// per-window stats from the cached klines. Reduces futures requests from N*symbols
// to 1*symbols per refresh cycle.
export async function fetchFuturesAllWindowedStats(
  symbols: string[],
  windowSizes: string[],
): Promise<Map<string, BinanceTicker24hr[]>> {
  const result = new Map<string, BinanceTicker24hr[]>();
  if (windowSizes.length === 0) return result;

  const windowMinutes = windowSizes.map((w) => ({ w, m: windowToMinutes(w) }));
  const maxMinutes = Math.max(...windowMinutes.map((x) => x.m));
  const limit = Math.min(Math.max(maxMinutes, 1), 1500);

  for (const { w } of windowMinutes) result.set(w, []);

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const response = await fetchWithTimeout(
          `${FUTURES_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=${limit}`,
        );
        const klines = (await response.json()) as BinanceKline[];
        return { symbol, klines };
      }),
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { symbol, klines } = outcome.value;
      if (klines.length === 0) continue;

      for (const { w, m } of windowMinutes) {
        const sliced = klines.length > m ? klines.slice(-m) : klines;
        const ticker = computeStatsFromKlines(symbol, sliced);
        if (ticker) result.get(w)!.push(ticker);
      }
    }

    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }

  return result;
}

export async function fetch1hrTickers(
  symbols: string[],
  windowSize = '1h',
  futuresOnly = false,
): Promise<BinanceTicker24hr[]> {
  if (futuresOnly) {
    return fetchFuturesWindowedStats(symbols, windowSize);
  }
  const result: BinanceTicker24hr[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const symbolsParam = encodeURIComponent(JSON.stringify(batch));
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/v3/ticker?windowSize=${windowSize}&symbols=${symbolsParam}`,
    );
    let tickers: BinanceTicker24hr[];
    try {
      tickers = (await response.json()) as BinanceTicker24hr[];
    } catch {
      throw new Error('Failed to parse windowed ticker response from Binance');
    }
    result.push(...tickers);
    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }
  return result;
}

export async function fetchKlines(
  symbol: string,
  interval = '1h',
  limit = 24,
  futuresOnly = false,
): Promise<BinanceKline[]> {
  const base = futuresOnly ? FUTURES_BASE : BASE_URL;
  const path = futuresOnly ? '/fapi/v1/klines' : '/api/v3/klines';
  const response = await fetchWithTimeout(
    `${base}${path}?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  return response.json();
}

export async function fetchSparklineData(
  symbols: string[],
  interval = '15m',
  limit = 100,
  futuresOnly = false,
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map((symbol) => fetchKlines(symbol, interval, limit, futuresOnly)),
    );

    batch.forEach((symbol, index) => {
      const outcome = settled[index];
      if (outcome && outcome.status === 'fulfilled') {
        const closePrices = outcome.value.map((kline: BinanceKline) => parseFloat(kline[4]));
        result.set(symbol, closePrices);
      }
    });

    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }

  return result;
}

// Fetches close-price arrays for each symbol × timeframe combination.
// Used to compute per-timeframe StochRSI client-side.
export async function fetchKlinesByTimeframes(
  symbols: string[],
  timeframes: string[],
  limit = 50,
  futuresOnly = false,
): Promise<Map<string, Record<string, number[]>>> {
  const result = new Map<string, Record<string, number[]>>();
  const base = futuresOnly ? FUTURES_BASE : BASE_URL;
  const path = futuresOnly ? '/fapi/v1/klines' : '/api/v3/klines';

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const tfCloses: Record<string, number[]> = {};
        await Promise.all(
          timeframes.map(async (tf) => {
            try {
              const response = await fetchWithTimeout(
                `${base}${path}?symbol=${symbol}&interval=${tf}&limit=${limit}`,
              );
              const klines = (await response.json()) as BinanceKline[];
              tfCloses[tf] = klines.map((k) => parseFloat(k[4]));
            } catch {
              tfCloses[tf] = [];
            }
          }),
        );
        return { symbol, tfCloses };
      }),
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      result.set(outcome.value.symbol, outcome.value.tfCloses);
    }

    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }

  return result;
}

// Fetches % change since `sinceUtcMs` for each symbol using 15m klines.
// Used for the "Today %" column: user's local midnight as UTC ms -> change from
// the first kline's open to the last kline's close. Matches Binance's
// timezone-locked 24h column behavior (counts from midnight in selected tz).
export async function fetchTodayChangeSinceMidnight(
  symbols: string[],
  sinceUtcMs: number,
  futuresOnly = false,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const base = futuresOnly ? FUTURES_BASE : BASE_URL;
  const path = futuresOnly ? '/fapi/v1/klines' : '/api/v3/klines';

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const response = await fetchWithTimeout(
          `${base}${path}?symbol=${symbol}&interval=15m&startTime=${sinceUtcMs}&limit=100`,
        );
        const klines = (await response.json()) as BinanceKline[];
        return { symbol, klines };
      }),
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { symbol, klines } = outcome.value;
      if (klines.length === 0) continue;
      const first = klines[0];
      const last = klines[klines.length - 1];
      if (!first || !last) continue;
      const open = parseFloat(first[1]);
      const close = parseFloat(last[4]);
      if (!(open > 0)) continue;
      result.set(symbol, ((close - open) / open) * 100);
    }

    if (i + BATCH_SIZE < symbols.length) {
      await delay(BATCH_DELAY);
    }
  }

  return result;
}

export function isValidWindowSize(tf: string): boolean {
  const match = /^([0-9]+)(m|h|d)$/.exec(tf);
  if (!match) return false;

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === 'm') return value >= 1 && value <= 59;
  if (unit === 'h') return value >= 1 && value <= 23;
  if (unit === 'd') return value >= 1 && value <= 7;
  return false;
}
