import React, { useEffect, useState } from 'react';
import { useCryptoData, FIXED_COLUMNS } from './hooks/useCryptoData';
import type { CryptoSettings } from './hooks/useCryptoData';
import Header from './components/Header';
import SettingsBar from './components/SettingsBar';
import CryptoTable from './components/CryptoTable';
import LoadingOverlay from './components/LoadingOverlay';
import SettingsPanel from './components/SettingsPanel';
import type { VolatilityColumn } from './types';
import { isValidWindowSize } from './api/binance';

const STORAGE_KEY = 'crypto-volatility-dashboard/settings/v3';

function loadInitialSettings(): CryptoSettings {
  let customColumns: string[] = [];
  let rankingTimeframe = '1h';
  let refreshInterval = 300;
  let futuresOnly = true;
  let klineInterval = '15m';

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const saved = parsed as {
          customColumns?: unknown;
          rankingTimeframe?: unknown;
          refreshInterval?: unknown;
          futuresOnly?: unknown;
          klineInterval?: unknown;
        };

        if (Array.isArray(saved.customColumns)) {
          const fixedSet = new Set(FIXED_COLUMNS.map((c) => c.timeframe));
          customColumns = saved.customColumns
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.toLowerCase())
            .filter((tf) => isValidWindowSize(tf) && !fixedSet.has(tf));
        }

        if (typeof saved.rankingTimeframe === 'string') rankingTimeframe = saved.rankingTimeframe;
        if (typeof saved.refreshInterval === 'number') refreshInterval = saved.refreshInterval;
        if (typeof saved.futuresOnly === 'boolean') futuresOnly = saved.futuresOnly;
        if (typeof saved.klineInterval === 'string' && /^\d+m$/.test(saved.klineInterval)) klineInterval = saved.klineInterval;
      }
    }
  } catch {
    /* ignore */
  }

  const columns: VolatilityColumn[] = [
    ...FIXED_COLUMNS,
    ...customColumns.map((tf) => ({ timeframe: tf, fixed: false })),
  ];

  return { columns, rankingTimeframe, refreshInterval, futuresOnly, klineInterval };
}

function App(): React.ReactElement {
  const [settings, setSettings] = useState<CryptoSettings>(loadInitialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, isLoading, error, lastUpdated, secondsUntilRefresh } = useCryptoData(settings);

  useEffect(() => {
    try {
      const payload = {
        customColumns: settings.columns.filter((c) => !c.fixed).map((c) => c.timeframe),
        rankingTimeframe: settings.rankingTimeframe,
        refreshInterval: settings.refreshInterval,
        futuresOnly: settings.futuresOnly,
        klineInterval: settings.klineInterval,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [settings]);

  return (
    <div className="min-h-screen bg-[#181a20] text-white">
      <LoadingOverlay isLoading={isLoading} />
      <Header
        lastUpdated={lastUpdated}
        secondsUntilRefresh={secondsUntilRefresh}
        isLoading={isLoading}
      />
      <SettingsBar
        settings={settings}
        onChange={setSettings}
        onOpenSettings={() => setSettingsOpen(true)}
        isLoading={isLoading}
      />
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg text-[#f6465d] text-sm">
            {error}
          </div>
        )}
        <CryptoTable data={data} isLoading={isLoading} columns={settings.columns} />
      </main>
      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />
      <footer className="max-w-[1400px] mx-auto px-4 py-4 text-center text-[11px] text-[#474d57]">
        Data from Binance API · Ranked by {settings.rankingTimeframe} volatility
        {settings.futuresOnly ? ' · Futures pairs only' : ''}
        {' '}· Refreshes every {settings.refreshInterval >= 60 ? `${settings.refreshInterval / 60}m` : `${settings.refreshInterval}s`}
      </footer>
    </div>
  );
}

export default App;
