import React from 'react';

/* Ambient live plexus constellation — captures FORMA's "live canvas" energy
   with zero dependencies (animated SVG, transform/opacity only). */

type N = { x: number; y: number; k?: 'mint' | 'violet'; r?: number };
const NODES: N[] = [
  { x: 100, y: 28, r: 3 }, { x: 152, y: 54, k: 'mint' }, { x: 168, y: 110, r: 3 },
  { x: 134, y: 162 }, { x: 82, y: 172, k: 'violet', r: 3.4 }, { x: 36, y: 134, r: 3 },
  { x: 28, y: 74, k: 'mint' }, { x: 70, y: 50 }, { x: 100, y: 96, r: 3.6 },
  { x: 122, y: 120 }, { x: 60, y: 104 },
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  [8, 0], [8, 2], [8, 4], [8, 6], [9, 2], [9, 3], [9, 8], [10, 5], [10, 6], [10, 8], [7, 8], [1, 8],
];

export default function PlexusViz() {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g style={{ transformOrigin: '100px 100px', animation: 'px-spin 120s linear infinite' }}>
        <circle cx="100" cy="100" r="86" fill="none" stroke="var(--line)" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="var(--line)" strokeWidth="0.5" opacity="0.6" />
        {EDGES.map(([a, b], i) => (
          <line key={i} className="vline" x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} />
        ))}
        {NODES.map((n, i) => (
          <circle
            key={i}
            className={`vnode${n.k ? ' ' + n.k : ''}`}
            cx={n.x} cy={n.y} r={n.r ?? 2.4}
            style={{ animation: `px-twinkle ${2 + (i % 4) * 0.5}s ease-in-out ${(i % 5) * 0.3}s infinite` }}
          />
        ))}
        <circle cx="100" cy="100" r="4.5" fill="var(--accent)" style={{ animation: 'px-twinkle 2.4s ease-in-out infinite' }} />
      </g>
    </svg>
  );
}
