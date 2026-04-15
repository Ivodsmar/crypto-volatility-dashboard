import type { BinanceTicker24hr, CryptoData } from '../types';

export function calculatePositiveVolatility(ticker: BinanceTicker24hr): number {
  const priceChangePercent = parseFloat(ticker.priceChangePercent) || 0;
  const highPrice = parseFloat(ticker.highPrice) || 0;
  const lowPrice = parseFloat(ticker.lowPrice) || 0;
  const openPrice = parseFloat(ticker.openPrice) || 0;
  const quoteVolume = parseFloat(ticker.quoteVolume) || 0;

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

export function processAndRankTickers(tickers: BinanceTicker24hr[]): CryptoData[] {
  const processed: CryptoData[] = tickers.map((ticker) => {
    const volatilityScore = calculatePositiveVolatility(ticker);
    const symbol = ticker.symbol;
    const displaySymbol = symbol.endsWith('USDT')
      ? symbol.slice(0, -4)
      : symbol;

    return {
      symbol,
      displaySymbol,
      price: parseFloat(ticker.lastPrice) || 0,
      priceChangePercent: parseFloat(ticker.priceChangePercent) || 0,
      volatilityScore,
      volume: parseFloat(ticker.quoteVolume) || 0,
      highPrice: parseFloat(ticker.highPrice) || 0,
      lowPrice: parseFloat(ticker.lowPrice) || 0,
      openPrice: parseFloat(ticker.openPrice) || 0,
      sparklineData: [],
    };
  });

  processed.sort((a, b) => b.volatilityScore - a.volatilityScore);

  return processed.slice(0, 50);
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
