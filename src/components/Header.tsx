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
    <header className="sticky top-0 z-50 bg-[#0b0e11] border-b border-[#2b3139] px-6 py-3">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="text-lg font-semibold text-white">Crypto Volatility Dashboard</h1>
          </div>
          <span className="text-xs text-[#848e9c] hidden sm:inline">for Flavio, by Ivo</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-[#848e9c]">
            {isLoading && !lastUpdated ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                Loading...
              </span>
            ) : lastUpdated ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {formatLastUpdated(lastUpdated)}
              </span>
            ) : (
              <span>No data yet</span>
            )}
          </div>
          <div
            className={`font-mono px-2 py-1 rounded text-xs ${
              isUrgent
                ? 'text-[#F0B90B] bg-[#F0B90B]/10 animate-pulse'
                : 'text-[#848e9c] bg-[#1e2329]'
            }`}
          >
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
