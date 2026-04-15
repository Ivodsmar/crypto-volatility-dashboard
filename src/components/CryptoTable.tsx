import { FC, useMemo } from 'react';
import { CryptoData } from '../types';
import { formatPrice, formatPercent, formatVolume } from '../utils/volatility';
import SparklineChart from './SparklineChart';

interface CryptoTableProps {
  data: CryptoData[];
  isLoading: boolean;
}

const SkeletonRow: FC<{ index: number }> = ({ index }) => (
  <tr className="border-b border-gray-800">
    {Array.from({ length: 7 }).map((_, colIdx) => (
      <td key={colIdx} className="px-4 py-3">
        <div
          className="h-4 bg-gray-800 rounded animate-pulse"
          style={{
            width: colIdx === 6 ? '120px' : `${40 + ((index + colIdx) % 4) * 20}px`,
            animationDelay: `${(index * 7 + colIdx) * 50}ms`,
          }}
        />
      </td>
    ))}
  </tr>
);

const CryptoTable: FC<CryptoTableProps> = ({ data, isLoading }) => {
  const maxVolatility = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d.volatilityScore));
  }, [data]);

  if (!isLoading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 text-lg">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-[73px] z-40 bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              Symbol
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
              Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
              24h Change
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              Volatility
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
              Volume
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
              24h Chart
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && data.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} index={i} />)
            : data.map((coin, index) => (
                <tr
                  key={coin.symbol}
                  className="border-b border-gray-800 transition-colors hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-white">{coin.displaySymbol}</span>
                    <span className="text-gray-500 text-xs ml-1">/USDT</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    {formatPrice(coin.price)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span
                      className={
                        coin.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {coin.priceChangePercent >= 0 ? '▲' : '▼'}{' '}
                      {formatPercent(coin.priceChangePercent)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono w-10">
                        {coin.volatilityScore.toFixed(1)}
                      </span>
                      <div className="flex-1 max-w-[80px] h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(coin.volatilityScore / maxVolatility) * 100}%`,
                            backgroundColor:
                              coin.volatilityScore / maxVolatility > 0.7
                                ? '#f59e0b'
                                : coin.volatilityScore / maxVolatility > 0.4
                                  ? '#22c55e'
                                  : '#6b7280',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {formatVolume(coin.volume)}
                  </td>
                  <td className="px-4 py-3">
                    <SparklineChart
                      data={coin.sparklineData}
                      isPositive={coin.priceChangePercent >= 0}
                    />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
};

export default CryptoTable;
