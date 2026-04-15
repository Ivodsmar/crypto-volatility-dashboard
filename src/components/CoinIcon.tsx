import { FC, useState } from 'react';

const ICON_CDN = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color';

interface CoinIconProps {
  symbol: string;
  size?: number;
}

const CoinIcon: FC<CoinIconProps> = ({ symbol, size = 24 }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="rounded-full bg-[#2b3139] flex items-center justify-center text-[#848e9c] font-bold"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={`${ICON_CDN}/${symbol.toLowerCase()}.png`}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setFailed(true)}
    />
  );
};

export default CoinIcon;
