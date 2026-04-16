// Raw Binance API response types
export interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// Raw kline array from Binance: [openTime, open, high, low, close, volume, closeTime, ...]
export type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

// App-level processed types
export interface VolatilityColumn {
  timeframe: string;
  fixed: boolean;
}

export interface CryptoData {
  symbol: string;
  displaySymbol: string;
  price: number;
  priceChangePercent: number;
  priceChangePercentByWindow: Record<string, number>;
  volatilityByWindow: Record<string, number>;
  volatilityScore: number;
  volume: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  rsi: number | null;
  sparklineData: number[];
}
