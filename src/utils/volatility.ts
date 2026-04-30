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
  tickersByWindow: Map<string, BinanceTicker24hr[]>,
  rankingTimeframe: string,
): CryptoData[] {
  const windowMaps = new Map<string, Map<string, BinanceTicker24hr>>();
  for (const [tf, tickers] of tickersByWindow) {
    const lookup = new Map<string, BinanceTicker24hr>();
    for (const t of tickers) {
      lookup.set(t.symbol, t);
    }
    windowMaps.set(tf, lookup);
  }

  const processed: CryptoData[] = [];

  for (const ticker24h of tickers24h) {
    const priceChangePercentByWindow: Record<string, number> = {};
    const volatilityByWindow: Record<string, number> = {};
    let hasWindowedTicker = false;

    for (const [tf, lookup] of windowMaps) {
      const windowedTicker = lookup.get(ticker24h.symbol);
      if (windowedTicker) {
        hasWindowedTicker = true;
        volatilityByWindow[tf] = calculatePositiveVolatility(windowedTicker, ticker24h);
        priceChangePercentByWindow[tf] = parseFloat(windowedTicker.priceChangePercent) || 0;
      } else {
        volatilityByWindow[tf] = 0;
        priceChangePercentByWindow[tf] = 0;
      }
    }

    if (!hasWindowedTicker) continue;

    const volatilityScore = volatilityByWindow[rankingTimeframe] ?? volatilityByWindow['1h'] ?? 0;
    const symbol = ticker24h.symbol;
    const displaySymbol = symbol.endsWith('USDT')
      ? symbol.slice(0, -4)
      : symbol;

    processed.push({
      symbol,
      displaySymbol,
      price: parseFloat(ticker24h.lastPrice) || 0,
      priceChangePercent: parseFloat(ticker24h.priceChangePercent) || 0,
      priceChangePercentByWindow,
      volatilityByWindow,
      volatilityScore,
      volume: parseFloat(ticker24h.quoteVolume) || 0,
      highPrice: parseFloat(ticker24h.highPrice) || 0,
      lowPrice: parseFloat(ticker24h.lowPrice) || 0,
      openPrice: parseFloat(ticker24h.openPrice) || 0,
      stochRsi: { k: null, d: null },
      stochRsiByWindow: {},
      sparklineData: [],
    });
  }

  processed.sort((a, b) => b.volatilityScore - a.volatilityScore);

  return processed.slice(0, 50);
}

export function calculateStochRSI(
  closePrices: number[],
  rsiLength = 14,
  stochLength = 14,
  kSmooth = 3,
  dSmooth = 3,
): { k: number | null; d: number | null } {
  if (closePrices.length < rsiLength + stochLength + kSmooth + dSmooth) {
    return { k: null, d: null };
  }

  // Step 1: Compute full RSI series (Wilder's smoothing)
  const rsiValues: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= rsiLength; i++) {
    const change = closePrices[i]! - closePrices[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= rsiLength;
  avgLoss /= rsiLength;
  rsiValues.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = rsiLength + 1; i < closePrices.length; i++) {
    const change = closePrices[i]! - closePrices[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (rsiLength - 1) + gain) / rsiLength;
    avgLoss = (avgLoss * (rsiLength - 1) + loss) / rsiLength;
    rsiValues.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  // Step 2: Stochastic of RSI
  const validRawK: number[] = [];
  for (let i = stochLength - 1; i < rsiValues.length; i++) {
    const slice = rsiValues.slice(i - stochLength + 1, i + 1);
    const mn = Math.min(...slice);
    const mx = Math.max(...slice);
    validRawK.push((mx - mn) === 0 ? 0 : (rsiValues[i]! - mn) / (mx - mn) * 100);
  }

  // Step 3: SMA(kSmooth) over validRawK
  const smoothKSeries: number[] = [];
  for (let i = kSmooth - 1; i < validRawK.length; i++) {
    const slice = validRawK.slice(i - kSmooth + 1, i + 1);
    smoothKSeries.push(slice.reduce((a, b) => a + b, 0) / kSmooth);
  }

  // Step 4: SMA(dSmooth) over smoothKSeries
  const smoothDSeries: number[] = [];
  for (let i = dSmooth - 1; i < smoothKSeries.length; i++) {
    const slice = smoothKSeries.slice(i - dSmooth + 1, i + 1);
    smoothDSeries.push(slice.reduce((a, b) => a + b, 0) / dSmooth);
  }

  return {
    k: smoothKSeries.length > 0 ? smoothKSeries[smoothKSeries.length - 1]! : null,
    d: smoothDSeries.length > 0 ? smoothDSeries[smoothDSeries.length - 1]! : null,
  };
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
