import type { BinanceTicker24hr, CryptoData } from '../types';

export function calculatePositiveVolatility(
  ticker1h: BinanceTicker24hr,
  ticker24h: BinanceTicker24hr,
): number {
  // Score from 1h data
  const priceChangePercent = parseFloat(ticker1h.priceChangePercent) || 0;
  const highPrice = parseFloat(ticker1h.highPrice) || 0;
  const lowPrice = parseFloat(ticker1h.lowPrice) || 0;
  const openPrice = parseFloat(ticker1h.openPrice) || 0;

  // Volume boost from 24h data (more reliable)
  const quoteVolume = parseFloat(ticker24h.quoteVolume) || 0;

  const changeScore = priceChangePercent > 0
    ? priceChangePercent * 1.5
    : priceChangePercent * 0.5;

  const wickStrength = openPrice > 0
    ? ((highPrice - openPrice) / openPrice) * 100
    : 0;

  const rangeScore = lowPrice > 0
    ? ((highPrice - lowPrice) / lowPrice) * 100
    : 0;

  const volumeBoost = quoteVolume > 0
    ? Math.log10(quoteVolume) * 0.5
    : 0;

  const score = changeScore + wickStrength * 0.3 + rangeScore * 0.2 + volumeBoost;

  return isNaN(score) ? 0 : score;
}

export function preRankBy24h(tickers: BinanceTicker24hr[], limit: number): BinanceTicker24hr[] {
  return [...tickers]
    .sort((a, b) => {
      const aScore = Math.abs(parseFloat(a.priceChangePercent) || 0);
      const bScore = Math.abs(parseFloat(b.priceChangePercent) || 0);
      return bScore - aScore;
    })
    .slice(0, limit);
}

export function processAndRankTickers(
  tickers24h: BinanceTicker24hr[],
  tickers1h: BinanceTicker24hr[],
): CryptoData[] {
  const map1h = new Map<string, BinanceTicker24hr>();
  for (const t of tickers1h) {
    map1h.set(t.symbol, t);
  }

  const processed: CryptoData[] = [];

  for (const ticker24h of tickers24h) {
    const ticker1h = map1h.get(ticker24h.symbol);
    if (!ticker1h) continue;

    const volatilityScore = calculatePositiveVolatility(ticker1h, ticker24h);
    const symbol = ticker24h.symbol;
    const displaySymbol = symbol.endsWith('USDT')
      ? symbol.slice(0, -4)
      : symbol;

    processed.push({
      symbol,
      displaySymbol,
      price: parseFloat(ticker24h.lastPrice) || 0,
      priceChangePercent: parseFloat(ticker24h.priceChangePercent) || 0,
      priceChangePercent1h: parseFloat(ticker1h.priceChangePercent) || 0,
      volatilityScore,
      volume: parseFloat(ticker24h.quoteVolume) || 0,
      highPrice: parseFloat(ticker24h.highPrice) || 0,
      lowPrice: parseFloat(ticker24h.lowPrice) || 0,
      openPrice: parseFloat(ticker24h.openPrice) || 0,
      rsi: null,
      sparklineData: [],
    });
  }

  processed.sort((a, b) => b.volatilityScore - a.volatilityScore);

  return processed.slice(0, 50);
}

export function calculateRSI(closePrices: number[], period = 14): number | null {
  if (closePrices.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average over first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = closePrices[i]! - closePrices[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed RSI (Wilder's method) for remaining data
  for (let i = period + 1; i < closePrices.length; i++) {
    const change = closePrices[i]! - closePrices[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function formatPrice(price: number): string {
  if (price > 1) return price.toFixed(2);
  if (price > 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}
