import type { BinanceTicker24hr, BinanceKline } from '../types';

const BASE_URL = 'https://api.binance.com';
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

export async function fetchAll24hrTickers(): Promise<BinanceTicker24hr[]> {
  const response = await fetchWithTimeout(`${BASE_URL}/api/v3/ticker/24hr`);
  const tickers: BinanceTicker24hr[] = await response.json();

  return tickers.filter(
    (t) => t.symbol.endsWith('USDT') && !isLeveragedToken(t.symbol),
  );
}

export async function fetchFuturesSymbols(): Promise<Set<string>> {
  const response = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/exchangeInfo');
  const data: { symbols: { symbol: string; status: string }[] } = await response.json();
  return new Set(
    data.symbols
      .filter((s) => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
      .map((s) => s.symbol),
  );
}

export async function fetch1hrTickers(symbols: string[], windowSize = '1h'): Promise<BinanceTicker24hr[]> {
  const result: BinanceTicker24hr[] = [];

  // Binance /api/v3/ticker?windowSize=Xh requires a symbols param, max ~100 per call
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const symbolsParam = encodeURIComponent(JSON.stringify(batch));
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/v3/ticker?windowSize=${windowSize}&symbols=${symbolsParam}`,
    );
    const tickers: BinanceTicker24hr[] = await response.json();
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
): Promise<BinanceKline[]> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  return response.json();
}

export async function fetchSparklineData(
  symbols: string[],
  interval = '15m',
  limit = 100,
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map((symbol) => fetchKlines(symbol, interval, limit)),
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
