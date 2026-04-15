# Crypto Volatility Dashboard — Implementation Plan
> **For Claude:** This plan is executed by autopilot. Independent tasks run in parallel.

**Goal:** Build a React+Vite dashboard showing top 50 positively volatile Binance cryptos with 5-min auto-refresh.
**Architecture:** SPA with API layer (Binance REST), data processing utils, and Recharts-based UI components. Dark theme, Tailwind CSS.
**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Recharts

## Task Dependency Graph
- Task 1: Project scaffolding — no dependencies
- Task 2: Binance API layer — depends on Task 1
- Task 3: Volatility calculation utils — depends on Task 1
- Task 4: UI components (table, sparklines, header) — depends on Task 1
- Task 5: Main App integration (wire API + utils + UI, auto-refresh) — depends on Tasks 2, 3, 4
- Task 6: Polish and final styling — depends on Task 5

## Tasks

### Task 1: Project Scaffolding
**Files:** package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, src/main.tsx, src/App.tsx, src/index.css, index.html, .gitignore
**Steps:**
1. Initialize Vite React-TS project
2. Install dependencies: tailwindcss, postcss, autoprefixer, recharts
3. Configure Tailwind with dark theme defaults
4. Create minimal App.tsx placeholder
5. Verify `npm run dev` starts without errors

### Task 2: Binance API Layer
**Files:** src/api/binance.ts, src/types/index.ts
**Steps:**
1. Define TypeScript types for Binance API responses (Ticker24hr, Kline)
2. Define app-level types (CryptoData, VolatilityMetrics)
3. Implement `fetchAll24hrTickers()` — GET /api/v3/ticker/24hr, filter USDT pairs
4. Implement `fetchKlines(symbol, interval, limit)` — GET /api/v3/klines
5. Implement `fetchSparklineData(symbols: string[])` — batch fetch 1h klines for top 50
6. Add error handling and timeout

### Task 3: Volatility Calculation Utils
**Files:** src/utils/volatility.ts
**Steps:**
1. Implement `calculatePositiveVolatility(ticker)` — composite score from 24h change, high/open ratio, volume weight
2. Implement `rankByVolatility(tickers[])` — sort descending, return top 50
3. Implement `formatPrice()`, `formatPercent()`, `formatVolume()` helper formatters

### Task 4: UI Components
**Files:** src/components/Header.tsx, src/components/CryptoTable.tsx, src/components/SparklineChart.tsx, src/components/LoadingOverlay.tsx
**Steps:**
1. Header — title, last updated timestamp, countdown timer to next refresh
2. CryptoTable — responsive table with rank, symbol, price, 24h%, volatility score, volume, sparkline column
3. SparklineChart — small Recharts LineChart, green for positive trend, shows 24h price movement
4. LoadingOverlay — subtle loading indicator during data refresh
5. All components use Tailwind dark theme classes

### Task 5: Main App Integration
**Files:** src/App.tsx, src/hooks/useCryptoData.ts
**Steps:**
1. Create `useCryptoData` hook — manages fetch cycle, state, auto-refresh timer (5 min)
2. Wire up App.tsx: call hook, pass data to Header + CryptoTable
3. Handle loading, error, and empty states
4. Show countdown timer synced to refresh interval
5. Initial fetch on mount, then every 300s

### Task 6: Polish and Final Styling
**Files:** src/index.css, src/App.tsx, src/components/*.tsx
**Steps:**
1. Ensure dark theme is cohesive (bg-gray-900, text colors, borders)
2. Add green intensity scaling for positive values
3. Add hover effects on table rows
4. Responsive layout adjustments
5. Add favicon and page title
