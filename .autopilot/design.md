# Multi-Volatility Columns + Settings Page — Design (2026-04-16)

## Goal
Replace the single `windowSize` rolling-window volatility column with multiple
simultaneously visible columns: **fixed** (1h, 30m, 15m) that cannot be
removed, plus **custom** columns (any Binance windowSize like 5m, 3m, 1m, 2h,
4h, 1d, …) that the user manages via a Settings page.

## Data Model

`src/types/index.ts`:
```ts
export interface VolatilityColumn {
  timeframe: string; // Binance windowSize: 1m–59m, 1h–23h, 1d–7d
  fixed: boolean;    // true for 1h, 30m, 15m
}

export interface CryptoData {
  symbol; displaySymbol; price; priceChangePercent (24h); volume;
  highPrice; lowPrice; openPrice; rsi; sparklineData;
  volatilityScore: number;                              // for rankingTimeframe
  priceChangePercentByWindow: Record<string, number>;   // keyed by timeframe
  volatilityByWindow:         Record<string, number>;
}
```

`src/hooks/useCryptoData.ts`:
```ts
export interface CryptoSettings {
  columns: VolatilityColumn[];   // ordered: fixed first, then custom (add order)
  rankingTimeframe: string;      // default '1h'
  refreshInterval: number;
  futuresOnly: boolean;
}
```

## Defaults

```ts
const FIXED_COLUMNS = [
  { timeframe: '1h',  fixed: true },
  { timeframe: '30m', fixed: true },
  { timeframe: '15m', fixed: true },
];
const DEFAULT_CUSTOM_COLUMNS = [];     // user adds e.g. 5m / 3m / 1m
const DEFAULT_RANKING = '1h';
```

## Fetching Strategy

1. `preRankBy24h(tickers24h, 100)` to get 100 candidates.
2. For each active timeframe in `settings.columns`, fire
   `fetch1hrTickers(symbols, tf)` in parallel via `Promise.all`.
3. Build a `Map<tf, Map<symbol, ticker>>`.
4. For each surviving symbol, build `CryptoData` with
   `volatilityByWindow[tf]` + `priceChangePercentByWindow[tf]` populated.
5. Rank final list by `volatilityByWindow[rankingTimeframe]` (fallback '1h').
6. Top 50 → sparkline + RSI as today.

### Cost
3 fixed + up to ~4 custom ≈ 7 timeframes × 10 batches × 10 symbols = 70 calls.
Weight ≈ 2 per call at 10 symbols ⇒ 140 weight per refresh, well under
6000/min.

## Binance windowSize Validation

Regex `/^(\d+)(m|h|d)$/` with ranges m:1–59, h:1–23, d:1–7. Invalid values
rejected in Settings with inline error. Never sent to Binance.

## Table Column Order

```
# | Name | Price | 1h% | 30m% | 15m% | [custom%…] | 24h% | Volatility | RSI(14) | Volume(24h) | Last 24h
```

- Fixed in order 1h, 30m, 15m.
- Custom in user-added order.
- `Volatility` column shows the rankingTimeframe score+bar.

## Settings Panel

Modal (no router dep). Launched via gear button in `SettingsBar`.
Sections:
1. **Fixed columns** — read-only rows with lock icon (1h, 30m, 15m).
2. **Custom columns** — list with × per row to remove.
3. **Add column** — preset chips (1m, 3m, 5m, 2h, 4h) + free-form input with
   inline validation + Enter-to-add.
4. **Ranking timeframe** — pill group over all active timeframes.

Dismiss: backdrop, Esc, Close button.

## Persistence

`localStorage['crypto-volatility-dashboard/settings/v1']`:
```json
{
  "customColumns": ["5m", "1m"],
  "rankingTimeframe": "1h",
  "refreshInterval": 300,
  "futuresOnly": false
}
```

Fixed columns are constants, never persisted. Invalid/stale JSON → silently
fall back to defaults.

## SettingsBar vs Panel

- **SettingsBar** — primary hot controls: ranking timeframe pills, refresh
  interval, futures-only toggle, Settings gear button.
- **SettingsPanel** (modal) — column set management.

## Backward Compat

- `CryptoData.priceChangePercent1h` → replaced by
  `priceChangePercentByWindow['1h']`.
- `CryptoSettings.windowSize` → replaced by `rankingTimeframe` + `columns`.
- Table `${windowSize} %` column → replaced by per-timeframe columns.

## Risks

- Rolling-window cost scales with column count. Mitigated by parallelism + low
  BATCH_SIZE.
- Many custom columns widen the table; horizontal scroll already exists
  (`overflow-x-auto`).
- URL length is fine (batched per timeframe, <3 KB per request).
