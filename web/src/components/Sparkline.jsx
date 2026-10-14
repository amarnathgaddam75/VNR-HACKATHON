// 24 h vital sparkline with the patient's personal-baseline band (design doc §11.1 Bed Detail).
import { VITALS, fmtVital } from '../config/vitals.js';

export default function Sparkline({ vital, points, baseline, now, hours = 24, width = 320, height = 72, compact }) {
  const def = VITALS[vital];
  const t0 = now - hours;
  const pts = points.filter((p) => p.t >= t0 - 0.01 && p.t <= now);
  const vals = pts.map((p) => p.v);
  if (baseline?.median != null) vals.push(baseline.median - 2 * baseline.spread, baseline.median + 2 * baseline.spread);
  if (!vals.length) vals.push(def.min, def.max);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, def.floor);
  lo -= pad; hi += pad;
  const padL = compact ? 2 : 4, padR = compact ? 2 : 34;
  const x = (t) => padL + ((t - t0) / hours) * (width - padL - padR);
  const y = (v) => 6 + (1 - (v - lo) / (hi - lo)) * (height - 14);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const band = baseline?.median != null
    ? { y1: y(baseline.median + 1.5 * baseline.spread), y2: y(baseline.median - 1.5 * baseline.spread), ym: y(baseline.median) }
    : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img"
      aria-label={`${def.name} last ${hours} hours${last ? `, latest ${fmtVital(vital, last.v)} ${def.unit}` : ''}`}>
      {band && (
        <g>
          <rect x={padL} y={band.y1} width={width - padL - padR} height={Math.max(2, band.y2 - band.y1)} fill="rgb(var(--pulse) / 0.10)" rx="3" />
          <line x1={padL} x2={width - padR} y1={band.ym} y2={band.ym} stroke="rgb(var(--pulse) / 0.5)" strokeDasharray="3 4" strokeWidth="1" />
        </g>
      )}
      {/* 4-hourly grid */}
      {Array.from({ length: Math.floor(hours / 4) + 1 }, (_, i) => now - i * 4).map((t) => (
        <line key={t} x1={x(t)} x2={x(t)} y1={4} y2={height - 4} stroke="rgb(var(--line))" strokeWidth="1" />
      ))}
      <path d={path} fill="none" stroke="rgb(var(--ink) / 0.75)" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map((p) => (
        p.src === 'manual' || p.src === 'device'
          ? <rect key={`${p.t}-${p.v}`} x={x(p.t) - 3.5} y={y(p.v) - 3.5} width="7" height="7" transform={`rotate(45 ${x(p.t)} ${y(p.v)})`} fill="rgb(var(--pulse))" />
          : <circle key={`${p.t}-${p.v}`} cx={x(p.t)} cy={y(p.v)} r={p === last ? 3.6 : 2.4} fill={p === last ? 'rgb(var(--ink))' : 'rgb(var(--panel))'} stroke="rgb(var(--ink) / 0.8)" strokeWidth="1.3" />
      ))}
      {last && !compact && (
        <text x={width - padR + 4} y={y(last.v) + 4} className="num" fontSize="11" fontWeight="700" fill="rgb(var(--ink))">{fmtVital(vital, last.v)}</text>
      )}
      {/* now marker */}
      <line x1={x(now)} x2={x(now)} y1={2} y2={height - 2} stroke="rgb(var(--pulse))" strokeWidth="1.5" />
    </svg>
  );
}
