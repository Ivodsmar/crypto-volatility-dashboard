import { FC, useMemo } from 'react';
import type { CryptoData, VolatilityColumn } from '../types';
import { formatPrice, formatPercent, formatVolume } from '../utils/volatility';
import SparklineChart from './SparklineChart';
import CoinIcon from './CoinIcon';

interface CryptoTableProps {
  data: CryptoData[];
  isLoading: boolean;
  columns: VolatilityColumn[];
}

const SkeletonRow: FC<{ index: number; columnCount: number }> = ({ index, columnCount }) => (
  <tr className="border-b border-[#2b3139]">
    {Array.from({ length: 8 + columnCount }).map((_, colIdx) => (
      <td key={colIdx} className="px-3 py-3">
        <div
          className="h-4 bg-[#2b3139] rounded animate-pulse"
          style={{
            width: colIdx === 7 + columnCount ? '100px' : `${40 + ((index + colIdx) % 4) * 15}px`,
            animationDelay: `${(index * 8 + colIdx) * 50}ms`,
          }}
        />
      </td>
    ))}
  </tr>
);

const CryptoTable: FC<CryptoTableProps> = ({ data, isLoading, columns }) => {
  const maxVolatility = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d.volatilityScore));
  }, [data]);

  if (!isLoading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[#848e9c] text-base">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2b3139]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0b0e11]">
            <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[#848e9c] w-12">
              #
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              Name
            </th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              Price
            </th>
            {columns.map((c) => (
              <th
                key={c.timeframe}
                className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-[#848e9c]"
              >
                {c.timeframe} %
              </th>
            ))}
            <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              24h %
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              Volatility
            </th>
            <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              RSI (14)
            </th>
            <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              Volume (24h)
            </th>
            <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-[#848e9c]">
              Last 24h
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && data.length === 0
            ? Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} index={i} columnCount={columns.length} />
              ))
            : data.map((coin, index) => {
                const volRatio = coin.volatilityScore / maxVolatility;
                return (
                  <tr
                    key={coin.symbol}
                    className="border-b border-[#2b3139] transition-colors hover:bg-[#1e2329]/60"
                  >
                    <td className="px-3 py-2.5 text-[#848e9c] text-xs">{index + 1}</td>
                    <td className="px-3 py-2.5">
                      <a
                        href={`https://www.binance.com/en/trade/${coin.displaySymbol}_USDT`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 group"
                      >
                        <CoinIcon symbol={coin.displaySymbol} size={24} />
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-white text-sm group-hover:text-[#F0B90B] transition-colors">{coin.displaySymbol}</span>
                          <span className="text-[#848e9c] text-[11px]">/USDT</span>
                        </div>
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white text-sm">
                      ${formatPrice(coin.price)}
                    </td>
                    {columns.map((c) => {
                      const v = coin.priceChangePercentByWindow[c.timeframe] ?? 0;
                      return (
                        <td key={c.timeframe} className="px-3 py-2.5 text-right font-mono text-xs">
                          <span className={v >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                            {formatPercent(v)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      <span
                        className={
                          coin.priceChangePercent >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                        }
                      >
                        {formatPercent(coin.priceChangePercent)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-xs w-9 text-right">
                          {coin.volatilityScore.toFixed(1)}
                        </span>
                        <div className="flex-1 max-w-[60px] h-1 bg-[#2b3139] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${volRatio * 100}%`,
                              backgroundColor:
                                volRatio > 0.7
                                  ? '#F0B90B'
                                  : volRatio > 0.4
                                    ? '#0ecb81'
                                    : '#474d57',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {coin.rsi !== null ? (
                        <span
                          className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                            coin.rsi >= 70
                              ? 'text-[#f6465d] bg-[#f6465d]/10'
                              : coin.rsi <= 30
                                ? 'text-[#0ecb81] bg-[#0ecb81]/10'
                                : 'text-[#b7bdc6]'
                          }`}
                        >
                          {coin.rsi.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[#474d57] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-[#b7bdc6]">
                      {formatVolume(coin.volume)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <SparklineChart
                          data={coin.sparklineData}
                          isPositive={coin.priceChangePercent >= 0}
                          width={100}
                          height={32}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
};

export default CryptoTable;
