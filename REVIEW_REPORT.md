# Crypto Volatility Dashboard — Codebase Review (2026-04-16)

Scope: full review after shipping multi-volatility columns + Settings panel on
`feature/multi-volatility-columns`. This is a **report only** — no code has been
changed based on these findings.

---

## 1. Issues I would fix

### 1.1 `useCallback` dep array is missing `timeframes` / relies on `columnsKey` (useCryptoData.ts:96)
`fetchData` captures `timeframes` from the outer closure but the dep array is
`[columnsKey, rankingTimeframe, futuresOnly]`. It works today because `timeframes`
is derived from `columnsKey` in a `useMemo`, so they always update together, but
this is implicit and React's ESLint rule would flag it. Risk: if somebody adds
another input to `timeframes` later (e.g. deduplication logic changes), the
callback won't refresh. **Fix:** depend on `timeframes` directly (it's memoized
already, so identity is stable across equivalent `columnsKey`).

### 1.2 `processAndRankTickers` iterates all 2,000+ USDT tickers instead of candidates (volatility.ts:63)
The hook passes `filtered24h` (up to ~500 USDT pairs after leveraged-token
filter) into `processAndRankTickers`, but only the 100 candidates have
rolling-window data. The function iterates all of them and relies on
`hasWindowedTicker` to skip. Correct but wasteful — pass `candidates` instead,
or build a `Set<symbol>` of the candidates and filter up front.

### 1.3 `fetch1hrTickers` name is stale (binance.ts:51)
Now called with 1m/3m/5m/15m/30m/1h/2h/etc. Rename to `fetchWindowedTickers` or
`fetchTickersByWindow` — the name still claims 1h as default, which lies.

### 1.4 `SparklineChart` gradient id uses `Math.random()` (SparklineChart.tsx:26)
Non-stable ids thrash defs across re-renders and are not SSR-safe. Not a user
issue today (no SSR), but will cause jitter in dev under fast refresh. Use
`useId()`.

### 1.5 `LoadingOverlay` inlines a `<style>` element on every render (LoadingOverlay.tsx:18)
The keyframes are re-parsed every time `isLoading` flips. Move the keyframes
into `index.css`, keep the component body pure.

### 1.6 `CoinIcon` has no alt-text accessibility for fallback tile
The letter-initials fallback is a div, not an img — screen readers read nothing.
Add `role="img"` + `aria-label={symbol}` on the fallback div.

### 1.7 Settings modal lacks focus trap + initial focus
`SettingsPanel` binds Esc-to-close but doesn't move focus to the modal, so
tabbing continues through the underlying page. Trap focus inside the modal on
open and restore focus to the gear button on close. Small a11y fix.

### 1.8 `rankingTimeframe` can become stale after load (App.tsx:40)
`loadInitialSettings` accepts any string persisted in localStorage as
`rankingTimeframe` without checking it still matches a column. If a user
persisted `rankingTimeframe = "5m"`, then on next boot (without that custom
column) the ranking pills won't highlight any option. Validate against the
reconstructed `columns` list and fall back to `'1h'`.

### 1.9 `priceChangePercent` column (24h) is reported from the 24h ticker but named identically to windowed % columns
Cognitive clash: every column header is `Xh %` / `Xm %` / `24h %`. OK today, but
consider explicitly showing `24h %` always to the right of custom columns (it
already is) and possibly adding a tooltip on hover explaining what each %
measures.

### 1.10 `settings.columns` identity changes on every render of App
`loadInitialSettings()` is called once via lazy init, good. But any
`setSettings({...settings, columns: newArray})` creates a fresh array and
re-renders the table — that's fine. However, `SettingsBar.rankingOptions` is
re-computed on every render because it's a plain `.map`. Memoize with
`useMemo([settings.columns])`. Cheap win.

### 1.11 `refreshInterval` change re-creates the interval AND re-fetches
The fetch-effect depends on both `fetchData` and `refreshInterval`, so changing
the interval also triggers a fresh fetch — possibly surprising to users.
Separate interval registration from the initial-fetch trigger.

### 1.12 No rate-limit awareness on the Binance batcher
`fetch1hrTickers` is called ~7× in parallel now (one per timeframe). At 10
calls each that's 70 requests dispatched instantly. If users add many columns,
this will burst. Track weight or queue through a shared limiter. Low priority
today but the cost scales linearly with columns.

### 1.13 `setError(null)` is set only on success; partial-failure states leak
If one timeframe fetch fails, the whole `Promise.all` rejects and the entire
UI shows an error — even though 6 other timeframes succeeded. Use
`Promise.allSettled`, populate whichever columns succeeded, and surface a
per-column warning.

### 1.14 The sparkline always uses 1h kline interval (useCryptoData.ts / api.ts)
`fetchSparklineData` hardcodes `'1h'` — unchanged regardless of
`rankingTimeframe`. If the user is ranking by 15m, the sparkline showing a 30h
tail doesn't match the column they're looking at. Consider aligning.

### 1.15 Bundle size warning (553 KB min, 161 KB gzip)
Recharts pulls in all of d3. Options: dynamic-import the sparkline bundle
(`React.lazy`), switch to a tiny bespoke SVG sparkline (100 lines, zero dep),
or preload only `Area` + `AreaChart` via the recharts ES tree-shaken entry
points. Gzip 161 KB isn't dire, but for a dashboard with no real "logic" it's
heavy.

### 1.16 `settings.rankingTimeframe` fallback = `'1h'` hardcoded in two places
App.tsx and SettingsPanel.tsx both hardcode `'1h'` as the fallback. Extract to
a named constant `const DEFAULT_RANKING = '1h'` exported from `useCryptoData`.

---

## 2. Improvements I would make

### 2.1 Sort by any column (not only ranking)
Click any header to sort. Persist sort state. This is usually the first
dashboard feature users ask for after "I want more columns."

### 2.2 Highlight the ranking column in the table
Subtle bg tint on the currently-ranked column header so the user sees at a
glance which timeframe drives the ordering.

### 2.3 Colour-code volatility score cells by magnitude
The bar already encodes magnitude, but the score text is always white. Tint
the background of the score cell using the same palette (grey → green → yellow)
for faster scanning.

### 2.4 Sticky header + first two columns on horizontal scroll
With 5+ custom columns the table scrolls horizontally. Sticky rank + name
columns keep context; sticky header keeps column labels visible on vertical
scroll.

### 2.5 Drag-reorder custom columns in the Settings panel
Right now custom columns are always appended and frozen in add-order. A small
up/down button pair per row (no dnd lib) is enough.

### 2.6 "Reset to defaults" button in Settings
Single click clears custom columns, resets ranking to 1h, clears localStorage.
Helpful after experimenting.

### 2.7 Show loading state per column during a timeframe fetch
When the user adds a new column, the table shows `+0.00%` for that column for
a few seconds before data arrives. A per-column skeleton/shimmer is better UX.

### 2.8 Inline per-row link to TradingView / Binance Futures
The coin name already links to Binance spot. Add a second icon for futures if
`futuresOnly` is on (or always).

### 2.9 Local persistence of the filter preset (futures-only)
Already persisted — verify from a clean session that it actually restores
correctly. If I've misread, flag.

### 2.10 Keyboard shortcuts
`s` → open settings, `f` → toggle futures, `1/2/3` → switch ranking to 1h/30m/15m.
Small, high-value for a power-user dashboard.

### 2.11 Unit tests for `volatility.ts`
`calculateRSI`, `calculatePositiveVolatility`, `processAndRankTickers` are pure.
Add vitest. Zero runtime cost, catches regressions when tweaking the score
weights.

### 2.12 Split the Binance client into a typed wrapper
Today: five disparate functions. A small class / module with `get24h`,
`getWindow(tf)`, `getKlines(sym)` wrapping a shared weight-aware fetcher. Makes
rate limiting, retry, and caching much easier to add later.

### 2.13 `displaySymbol` derivation is duplicated
Already derived in `processAndRankTickers` — fine for now. If we ever add
non-USDT quote pairs, centralize.

### 2.14 Consider `react-query` or a tiny cache for 24h tickers
The 24h ticker call fetches 2,000+ rows. Between refreshes they barely change,
but we pay a full payload every cycle. A 60s cache + conditional-refetch saves
bandwidth and lets Binance's CDN hit.

### 2.15 Add a legend/tooltip explaining the Volatility score
`65.0` means nothing without context. Tooltip explaining `1.5× +change + 0.3×
wick + 0.2× range + log10(vol) × 0.5`, or at least a plain-English definition.

### 2.16 `futuresOnly` toggle is boolean but the universe is larger
`'spot' | 'futures' | 'both'` would cover the common cases — "both" is today's
implicit default (off) but the label confuses users.

---

## 3. New feature suggestions

### 3.1 Volatility alerts
Watchlist + threshold ("alert me if any watched coin crosses +5% in the 5m
window"). Browser notification + optional sound.

### 3.2 Favourites / watchlist
Star a coin to pin it above the ranking cutoff. Stored in localStorage.

### 3.3 Historical volatility chart on row expand
Click a row → expand a small chart showing the last 24h of the selected
timeframe's volatility score. Quick "is this trending up?" answer.

### 3.4 Export visible rows to CSV
Copy-to-clipboard or download a CSV snapshot of the currently-rendered table.
Useful for journaling/backtesting.

### 3.5 Dashboard presets
Named column sets — e.g. "Scalping" = 1m+3m+5m+15m+30m, "Swing" = 1h+4h+1d.
Switch between them in one click. Builds on the existing custom-columns
machinery.

### 3.6 Mobile-friendly layout
Today's table is desktop-only (`max-w-[1400px]`, lots of columns). Collapse to
a card list on `< md` with the primary ranking column plus price/volume.

### 3.7 Dark/light theme toggle
The palette is Binance-locked dark. A light theme (using the same brand
yellow as accent) would expand the audience.

### 3.8 Custom score formula
Advanced users: edit the weights in `calculatePositiveVolatility` from the UI
and save the profile. Overkill for general users but powerful for traders.

### 3.9 Inline mini-chart for each custom column
Replace `+3.24%` text with a tiny sparkline of that timeframe's price action.
High info density.

### 3.10 Spot vs Futures funding rate column
For users who care about funding rate edges. Binance publishes
`/fapi/v1/fundingRate`.

### 3.11 Integrate Binance WebSocket for live ticker updates
Instead of 5-minute polling, subscribe to the `!ticker@arr` stream and update
the top 50 in real time. Big UX leap; modest complexity.

### 3.12 Per-coin click-through summary panel
Right-side drawer opens on row click with: full stats, order book snapshot,
1h/1d candles, funding rate, open interest. Stops the user from ever leaving
the dashboard.

### 3.13 Shareable URL state
Encode `columns`, `rankingTimeframe`, `futuresOnly` in the URL so a user can
share their setup. Already have localStorage; add `?cols=5m,3m,1m&rank=15m`
as a second channel.

### 3.14 A11y + keyboard-first shortcuts mode
Full keyboard navigation of the table, ARIA live regions announcing refresh,
screen-reader friendly column headers.

### 3.15 "Why did this coin spike?" — linked news/tweets panel
Pull a feed (Cointelegraph, Twitter) filtered by the top-ranked coin's symbol
as a right-hand context strip. Answers the "what happened?" question users
always have next.
