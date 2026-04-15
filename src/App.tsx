import { useCryptoData } from './hooks/useCryptoData';
import Header from './components/Header';
import CryptoTable from './components/CryptoTable';
import LoadingOverlay from './components/LoadingOverlay';

function App() {
  const { data, isLoading, error, lastUpdated, secondsUntilRefresh } = useCryptoData();

  return (
    <div className="min-h-screen bg-[#181a20] text-white">
      <LoadingOverlay isLoading={isLoading} />
      <Header
        lastUpdated={lastUpdated}
        secondsUntilRefresh={secondsUntilRefresh}
        isLoading={isLoading}
      />
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg text-[#f6465d] text-sm">
            {error}
          </div>
        )}
        <CryptoTable data={data} isLoading={isLoading} />
      </main>
      <footer className="max-w-[1400px] mx-auto px-4 py-4 text-center text-[11px] text-[#474d57]">
        Data from Binance API · Ranked by 1h volatility · Auto-refreshes every 5 minutes
      </footer>
    </div>
  );
}

export default App;
