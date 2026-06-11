import React from 'react';

interface Props {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  barWidth?: number;
}

export default function TimeChart({ data, maxValue, height = 160, barWidth = 32 }: Props) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  const padding = 24;
  const chartWidth = data.length * (barWidth + 16) + padding * 2;
  const chartHeight = height + padding * 2;

  const formatShort = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${m}`;
    return `${m}m`;
  };

  return (
    <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = padding + height * (1 - ratio);
        return (
          <g key={ratio}>
            <line
              x1={padding}
              y1={y}
              x2={chartWidth - padding}
              y2={y}
              stroke="rgba(139,148,158,0.15)"
              strokeWidth={1}
            />
            <text
              x={padding - 6}
              y={y + 4}
              textAnchor="end"
              fill="#8b949e"
              fontSize={10}
            >
              {formatShort(Math.round(max * ratio))}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = padding + i * (barWidth + 16) + 8;
        const barHeight = (d.value / max) * height;
        const y = padding + height - barHeight;
        const color = d.color || '#58a6ff';

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={color}
              opacity={0.85}
            />
            {/* Glow */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={color}
              opacity={0.2}
              filter="blur(4px)"
            />
            {/* Value label */}
            {d.value > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#c9d1d9"
                fontSize={10}
                fontWeight={600}
              >
                {formatShort(d.value)}
              </text>
            )}
            {/* X label */}
            <text
              x={x + barWidth / 2}
              y={padding + height + 16}
              textAnchor="middle"
              fill="#8b949e"
              fontSize={10}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
