import { FC } from 'react';

interface HeaderProps {
  lastUpdated: Date | null;
  secondsUntilRefresh: number;
  isLoading: boolean;
}

const Header: FC<HeaderProps> = ({ lastUpdated, secondsUntilRefresh, isLoading }) => {
  const minutes = Math.floor(secondsUntilRefresh / 60);
  const seconds = secondsUntilRefresh % 60;
  const isUrgent = secondsUntilRefresh < 30;

  const formatLastUpdated = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Crypto Volatility Dashboard</h1>
          <p className="text-sm text-gray-400">Top 50 positively volatile coins on Binance</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-gray-400">
            {isLoading && !lastUpdated ? (
              <span className="text-gray-500">Loading...</span>
            ) : lastUpdated ? (
              <span>Updated at {formatLastUpdated(lastUpdated)}</span>
            ) : (
              <span className="text-gray-500">No data yet</span>
            )}
          </div>
          <div
            className={`font-mono text-gray-300 ${isUrgent ? 'animate-pulse text-emerald-400' : ''}`}
          >
            Next refresh in {minutes}m {seconds.toString().padStart(2, '0')}s
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
