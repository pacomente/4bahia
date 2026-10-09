'use client';
import { useState } from 'react';

// Barras verticales (una serie) con tooltip por barra. data: [{label, value, title}]
export function BarChart({ data, format = (v) => v, height = 200, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = height;
  const pad = { top: 10, right: 8, bottom: 26, left: 40 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(36, Math.max(4, slot - 2));
  const ticks = [0, nice / 2, nice];
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <g className="grid">
          {ticks.map((t) => {
            const y = pad.top + innerH - (t / nice) * innerH;
            return <line key={t} x1={pad.left} x2={W - pad.right} y1={y} y2={y} />;
          })}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.left - 6} y={pad.top + innerH - (t / nice) * innerH + 4} textAnchor="end">{format(t)}</text>
          ))}
          {data.map((d, i) => (i % labelEvery === 0 ? (
            <text key={d.label} x={pad.left + slot * i + slot / 2} y={H - 8} textAnchor="middle">{d.label}</text>
          ) : null))}
        </g>
        {data.map((d, i) => {
          const h = Math.max((d.value / nice) * innerH, d.value > 0 ? 2 : 0);
          const x = pad.left + slot * i + (slot - barW) / 2;
          const y = pad.top + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.label}>
              {/* Barra con extremo superior redondeado y base recta */}
              <path className={`bar ${hover !== null && hover !== i ? 'dim' : ''}`}
                d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`} />
              {/* Zona de hover más grande que la barra */}
              <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent"
                onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="chart-tooltip" style={{
          left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%`,
          top: `${((pad.top + innerH - (data[hover].value / nice) * innerH) / H) * 100}%`,
        }}>
          <strong>{data[hover].title ?? data[hover].label}</strong>: {format(data[hover].value)}
        </div>
      )}
    </div>
  );
}

// Lista de barras horizontales (una serie), etiqueta y valor en texto.
export function HBarList({ data, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="list">
      {data.map((d) => (
        <div key={d.label} className="hbar-row" role="listitem" title={`${d.label}: ${format(d.value)}`}>
          <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          <span className="small mono">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
