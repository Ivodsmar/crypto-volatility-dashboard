import { FC } from 'react';
import type { CryptoSettings } from '../hooks/useCryptoData';

interface SettingsBarProps {
  settings: CryptoSettings;
  onChange: (next: CryptoSettings) => void;
  onOpenSettings: () => void;
  isLoading: boolean;
}

const REFRESH_OPTIONS = [
  { value: 60,  label: '1m'  },
  { value: 120, label: '2m'  },
  { value: 300, label: '5m'  },
  { value: 600, label: '10m' },
];


const PillGroup: FC<{
  label: string;
  options: { value: string | number; label: string }[];
  active: string | number;
  onSelect: (v: string | number) => void;
}> = ({ label, options, active, onSelect }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] uppercase tracking-wider text-[#848e9c] font-medium">{label}</span>
    <div className="flex items-center gap-1">
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              isActive
                ? 'bg-[#F0B90B] text-[#181a20] font-semibold'
                : 'bg-[#1e2329] text-[#848e9c] hover:text-white hover:bg-[#2b3139]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

const SettingsBar: FC<SettingsBarProps> = ({ settings, onChange, onOpenSettings, isLoading }) => {
  const rankingOptions = settings.columns.map((c) => ({ value: c.timeframe, label: c.timeframe }));

  return (
    <div className="border-b border-[#2b3139] bg-[#0b0e11]/60 px-6 py-2">
      <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-5">
        <PillGroup
          label="Ranking"
          options={rankingOptions}
          active={settings.rankingTimeframe}
          onSelect={(v) => !isLoading && onChange({ ...settings, rankingTimeframe: v as string })}
        />
        <PillGroup
          label="Refresh"
          options={REFRESH_OPTIONS}
          active={settings.refreshInterval}
          onSelect={(v) => onChange({ ...settings, refreshInterval: v as number })}
        />
        <button
          type="button"
          aria-label="Open settings"
          onClick={onOpenSettings}
          className="ml-auto p-1.5 rounded text-[#848e9c] hover:text-white hover:bg-[#2b3139] transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.36a1.7 1.7 0 0 0-1 .48 1.7 1.7 0 0 0-.5 1.2V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-.5-1.2 1.7 1.7 0 0 0-1-.48 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-.48-1 1.7 1.7 0 0 0-1.2-.5H3a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 1.2-.5 1.7 1.7 0 0 0 .48-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1-.48 1.7 1.7 0 0 0 .5-1.2V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 .5 1.2 1.7 1.7 0 0 0 1 .48 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9a1.7 1.7 0 0 0 .48 1 1.7 1.7 0 0 0 1.2.5H21a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-1.2.5 1.7 1.7 0 0 0-.48 1Z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SettingsBar;
