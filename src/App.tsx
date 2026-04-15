import { useCryptoData } from './hooks/useCryptoData';
import Header from './components/Header';
import CryptoTable from './components/CryptoTable';
import LoadingOverlay from './components/LoadingOverlay';

function App() {
  const { data, isLoading, error, lastUpdated, secondsUntilRefresh } = useCryptoData();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <LoadingOverlay isLoading={isLoading} />
      <Header
        lastUpdated={lastUpdated}
        secondsUntilRefresh={secondsUntilRefresh}
        isLoading={isLoading}
      />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        <CryptoTable data={data} isLoading={isLoading} />
      </main>
    </div>
  );
}

export default App;
