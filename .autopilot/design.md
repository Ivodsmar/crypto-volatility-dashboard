# Crypto Volatility Dashboard — Design

## Goal
A web dashboard showing the top 50 most positively volatile cryptocurrencies on Binance, auto-refreshing every 5 minutes.

## Tech Stack
- **React 18 + Vite** — fast, lightweight, no SSR needed for a data dashboard
- **TypeScript** — type safety for API responses and data processing
- **Tailwind CSS** — rapid styling with a clean, modern look
- **Recharts** — lightweight charting for sparklines
- **No backend** — Binance public API is CORS-friendly, call directly from browser

## Architecture
Single-page app, no routing needed. Three layers:

1. **API Layer** (`src/api/`) — fetches from Binance REST API
2. **Data Processing** (`src/utils/`) — calculates volatility metrics, ranks, sorts
3. **UI Components** (`src/components/`) — table, sparklines, header, auto-refresh indicator

## Binance API Strategy
- `GET /api/v3/ticker/24hr` — 24h stats for all symbols (single call, returns ~2000 pairs)
- `GET /api/v3/klines` — candlestick data for sparklines (per-symbol, 1h interval, last 24h)
- Filter to USDT pairs only (most liquid, comparable pricing)
- Rate limit: 1200 req/min weight — ticker/24hr costs 40 weight, klines costs 2 each. 50 kline calls = 100 + 40 = 140 weight per refresh cycle. Well within limits.

## Positive Volatility Score
Focus on upward movement potential, not just raw volatility:

```
positiveVolatility = (priceChangePercent > 0 ? priceChangePercent * 1.5 : priceChangePercent * 0.5)
                   + (highPrice - openPrice) / openPrice * 100  // upward wick strength
                   + volume * weightFactor                       // volume confirms momentum
```

Simplified approach: rank by a composite of 24h change %, high/open ratio, and volume-weighted momentum. Coins with strong upward moves and high volume rank highest.

## UI Layout
- **Header** — title, last refresh time, countdown to next refresh
- **Table** — rank, symbol, price, 24h change %, volatility score, 24h volume, sparkline
- **Color coding** — green shades for positive, intensity scales with magnitude
- **Dark theme** — standard for crypto dashboards
- **Responsive** — works on desktop and tablet

## Auto-Refresh
- `setInterval` at 5 minutes (300,000ms)
- Visual countdown timer in header
- Loading state overlay during refresh (non-blocking)
