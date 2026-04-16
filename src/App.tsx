import { useState } from 'react';
import { useCryptoData } from './hooks/useCryptoData';
import type { CryptoSettings } from './hooks/useCryptoData';
import Header from './components/Header';
import SettingsBar from './components/SettingsBar';
import CryptoTable from './components/CryptoTable';
import LoadingOverlay from './components/LoadingOverlay';

const DEFAULT_SETTINGS: CryptoSettings = {
  windowSize: '1h',
  refreshInterval: 300,
  futuresOnly: false,
};

function App() {
  const [settings, setSettings] = useState<CryptoSettings>(DEFAULT_SETTINGS);
  const { data, isLoading, error, lastUpdated, secondsUntilRefresh } = useCryptoData(settings);

  return (
    <div className="min-h-screen bg-[#181a20] text-white">
      <LoadingOverlay isLoading={isLoading} />
      <Header
        lastUpdated={lastUpdated}
        secondsUntilRefresh={secondsUntilRefresh}
        isLoading={isLoading}
      />
      <SettingsBar settings={settings} onChange={setSettings} />
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg text-[#f6465d] text-sm">
            {error}
          </div>
        )}
        <CryptoTable data={data} isLoading={isLoading} windowSize={settings.windowSize} />
      </main>
      <footer className="max-w-[1400px] mx-auto px-4 py-4 text-center text-[11px] text-[#474d57]">
        Data from Binance API · Ranked by {settings.windowSize} volatility
        {settings.futuresOnly ? ' · Futures pairs only' : ''}
        {' '}· Refreshes every {settings.refreshInterval >= 60 ? `${settings.refreshInterval / 60}m` : `${settings.refreshInterval}s`}
      </footer>
    </div>
  );
}

export default App;
