import { FC } from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
}

const LoadingOverlay: FC<LoadingOverlayProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-[#0b0e11] overflow-hidden">
      <div
        className="h-full bg-[#F0B90B]"
        style={{
          animation: 'loading-bar 1.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 40%;
            margin-left: 30%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
