import React from 'react';

interface Props {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  barWidth?: number;
}

/* Brand series — chartreuse / mint / soft-violet / teal, cycled. No outer glow. */
export const CHART_SERIES = ['#E0FF4F', '#D6FFF6', '#6E5BB0', '#56C8B0', '#B8E04F', '#9FE8D8', '#8A7AC0'];

export default function TimeChart({ data, maxValue, height = 150, barWidth = 28 }: Props) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  const padding = 26;
  const gap = 16;
  const chartWidth = data.length * (barWidth + gap) + padding * 2;
  const chartHeight = height + padding * 2;
  const mono = "'Geist Mono', ui-monospace, monospace";

  const formatShort = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`;
  };

  return (
    <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = padding + height * (1 - ratio);
        return (
          <g key={ratio}>
            <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="rgba(214,255,246,0.10)" strokeWidth={1} />
            <text x={padding - 8} y={y + 4} textAnchor="end" fill="rgba(214,255,246,0.38)" fontSize={9} fontFamily={mono}>
              {formatShort(Math.round(max * ratio))}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = padding + i * (barWidth + gap) + 8;
        const barHeight = Math.max((d.value / max) * height, d.value > 0 ? 2 : 0);
        const y = padding + height - barHeight;
        const color = d.color || CHART_SERIES[i % CHART_SERIES.length];
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity={0.9} />
            <rect x={x} y={y} width={barWidth} height={Math.min(barHeight, 3)} fill="#ffffff" opacity={0.25} />
            {d.value > 0 && (
              <text x={x + barWidth / 2} y={y - 7} textAnchor="middle" fill="rgba(214,255,246,0.6)" fontSize={9} fontFamily={mono}>
                {formatShort(d.value)}
              </text>
            )}
            <text x={x + barWidth / 2} y={padding + height + 16} textAnchor="middle" fill="rgba(214,255,246,0.38)" fontSize={9} fontFamily={mono}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
