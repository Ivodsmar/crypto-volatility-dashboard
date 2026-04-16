import { FC, useEffect, useState } from 'react';
import { FIXED_COLUMNS } from '../hooks/useCryptoData';
import type { CryptoSettings } from '../hooks/useCryptoData';
import { isValidWindowSize } from '../api/binance';
import type { VolatilityColumn } from '../types';

interface SettingsPanelProps {
  open: boolean;
  settings: CryptoSettings;
  onChange: (next: CryptoSettings) => void;
  onClose: () => void;
}

const PRESETS = ['1m', '3m', '5m', '2h', '4h', '1d'];

const SettingsPanel: FC<SettingsPanelProps> = ({ open, settings, onChange, onClose }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const fixedColumns: VolatilityColumn[] = settings.columns.filter((c) => c.fixed);
  const customColumns: VolatilityColumn[] = settings.columns.filter((c) => !c.fixed);

  const addColumn = (tf: string) => {
    const normalized = tf.trim().toLowerCase();

    if (!normalized) {
      setError('Enter a timeframe');
      return;
    }

    if (!isValidWindowSize(normalized)) {
      setError('Invalid timeframe (use e.g. 5m, 1h, 4h, 1d)');
      return;
    }

    if (settings.columns.some((c) => c.timeframe === normalized)) {
      setError('Already added');
      return;
    }

    const updated = [...FIXED_COLUMNS, ...customColumns, { timeframe: normalized, fixed: false }];
    setError(null);
    setInput('');
    onChange({ ...settings, columns: updated });
  };

  const removeColumn = (tf: string) => {
    const target = settings.columns.find((c) => c.timeframe === tf);
    if (!target || target.fixed) return;

    const updatedColumns = settings.columns.filter((c) => c.timeframe !== tf);
    const nextRanking = settings.rankingTimeframe === tf ? '1h' : settings.rankingTimeframe;
    onChange({ ...settings, columns: updatedColumns, rankingTimeframe: nextRanking });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#181a20] border border-[#2b3139] rounded-lg w-full max-w-md mx-4 shadow-xl">
        <div className="p-4 border-b border-[#2b3139] flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="text-[#848e9c] hover:text-white text-xl leading-none px-1"
          >
            &times;
          </button>
        </div>
        <div className="p-4 space-y-5">
          <section>
            <span className="text-[11px] uppercase tracking-wider text-[#848e9c] font-medium mb-2 block">
              Fixed columns
            </span>
            {fixedColumns.map((column) => (
              <div key={column.timeframe} className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-2">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                    className="text-[#848e9c]"
                  >
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span className="font-mono text-xs text-white">{column.timeframe}</span>
                </span>
                <span className="text-[#848e9c] text-[11px]">Locked</span>
              </div>
            ))}
          </section>

          <section>
            <span className="text-[11px] uppercase tracking-wider text-[#848e9c] font-medium mb-2 block">
              Custom columns
            </span>
            {customColumns.length === 0 ? (
              <p className="text-[#848e9c] text-xs italic">No custom columns. Add one below.</p>
            ) : (
              customColumns.map((column) => (
                <div key={column.timeframe} className="flex items-center justify-between py-1.5">
                  <span className="font-mono text-xs text-white">{column.timeframe}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${column.timeframe}`}
                    onClick={() => removeColumn(column.timeframe)}
                    className="text-[#848e9c] hover:text-[#f6465d] transition-colors px-2 text-sm leading-none"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </section>

          <section>
            <span className="text-[11px] uppercase tracking-wider text-[#848e9c] font-medium mb-2 block">
              Add column
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => {
                const already = settings.columns.some((c) => c.timeframe === preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={already}
                    onClick={() => addColumn(preset)}
                    className={`px-2.5 py-1 rounded text-xs font-mono bg-[#1e2329] text-[#848e9c] hover:text-white hover:bg-[#2b3139] transition-colors ${
                      already ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addColumn(input);
                }}
                className="bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs text-white font-mono flex-1 focus:outline-none focus:border-[#F0B90B]"
                placeholder="e.g. 5m, 2h, 1d"
              />
              <button
                type="button"
                onClick={() => addColumn(input)}
                className="bg-[#F0B90B] text-[#181a20] px-3 py-1 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </div>
            {error && <p className="text-[#f6465d] text-xs mt-2">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
