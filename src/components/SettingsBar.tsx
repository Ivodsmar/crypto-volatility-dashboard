import { FC } from 'react';
import type { CryptoSettings } from '../hooks/useCryptoData';

interface SettingsBarProps {
  settings: CryptoSettings;
  onChange: (next: CryptoSettings) => void;
}

const WINDOW_OPTIONS = [
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h',  label: '1h'  },
  { value: '2h',  label: '2h'  },
  { value: '4h',  label: '4h'  },
];

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

const SettingsBar: FC<SettingsBarProps> = ({ settings, onChange }) => {
  return (
    <div className="border-b border-[#2b3139] bg-[#0b0e11]/60 px-6 py-2">
      <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-5">
        <PillGroup
          label="Window"
          options={WINDOW_OPTIONS}
          active={settings.windowSize}
          onSelect={(v) => onChange({ ...settings, windowSize: v as string })}
        />
        <PillGroup
          label="Refresh"
          options={REFRESH_OPTIONS}
          active={settings.refreshInterval}
          onSelect={(v) => onChange({ ...settings, refreshInterval: v as number })}
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-[#848e9c] font-medium">Futures Only</span>
          <button
            onClick={() => onChange({ ...settings, futuresOnly: !settings.futuresOnly })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings.futuresOnly ? 'bg-[#F0B90B]' : 'bg-[#2b3139]'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.futuresOnly ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsBar;
