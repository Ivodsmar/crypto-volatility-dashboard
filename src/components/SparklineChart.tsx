import { FC } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineChartProps {
  data: number[];
  isPositive: boolean;
  width?: number;
  height?: number;
}

const SparklineChart: FC<SparklineChartProps> = ({
  data,
  isPositive,
  width = 120,
  height = 40,
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <div className="w-8 h-px bg-gray-700" />
      </div>
    );
  }

  const color = isPositive ? '#0ecb81' : '#f6465d';
  const gradientId = `sparkline-${isPositive ? 'green' : 'red'}-${Math.random().toString(36).slice(2, 8)}`;
  const chartData = data.map((value, index) => ({ index, value }));

  const min = Math.min(...data);
  const max = Math.max(...data);
  const padding = (max - min) * 0.1 || 1;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[min - padding, max + padding]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SparklineChart;
