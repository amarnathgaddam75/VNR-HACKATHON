// Personal baseline engine (design doc §6.1): median + MAD over the last 24 h, drift z, slope.
import { VITALS } from '../config/vitals.js';
import { ENGINE } from '../config/engine.js';

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mad = (xs) => {
  const m = median(xs);
  return m == null ? null : median(xs.map((x) => Math.abs(x - m)));
};

/** Series [{t, v}] for one vital from observation sets, ascending in time. */
export function series(readings, key) {
  const out = [];
  for (const r of readings) if (r.vitals[key] != null) out.push({ t: r.t, v: r.vitals[key], src: r.source });
  return out;
}

/** Least-squares slope (units/hour) over points within the window; handles irregular timestamps. */
export function slope(points, now, windowH = ENGINE.slopeWindowH) {
  const pts = points.filter((p) => p.t >= now - windowH && p.t <= now);
  if (pts.length < 2) return 0;
  const mt = pts.reduce((a, p) => a + p.t, 0) / pts.length;
  const mv = pts.reduce((a, p) => a + p.v, 0) / pts.length;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.t - mt) * (p.v - mv); den += (p.t - mt) ** 2; }
  return den > 1e-6 ? num / den : 0;
}

/**
 * Baseline for one vital at time `now`.
 * Window = 24 h ending `baselineGapH` before now, thinned to one reading per 2 h bin, so
 *  (a) a slow slide over the last few hours is measured against what came before it, and
 *  (b) hourly "escalated obs" on a sick patient don't drag the baseline toward the deterioration.
 * Falls back to all earlier readings in the last 24 h for recent admissions.
 */
export function baselineFor(points, key, now) {
  const def = VITALS[key];
  const latest = points.length ? points[points.length - 1] : null;
  const hi = now - ENGINE.baselineGapH;
  const lo = hi - ENGINE.baselineWindowH;
  let prior = thin(points.filter((p) => p !== latest && p.t >= lo && p.t <= hi));
  if (prior.length < ENGINE.baselineMinReadings) prior = thin(points.filter((p) => p !== latest && p.t >= now - ENGINE.baselineWindowH));
  const valid = prior.length >= ENGINE.baselineMinReadings;
  const vals = prior.map((p) => p.v);
  const med = valid ? median(vals) : null;
  const spread = valid ? Math.max(mad(vals) * 1.4826, def.floor) : def.floor;
  let z = 0;
  if (latest && valid) z = (latest.v - med) / spread;
  // direction-aware "bad" drift
  const badZ = def.bad === 'up' ? z : def.bad === 'down' ? -z : Math.abs(z);
  return {
    key, latest, valid, n: prior.length, median: med, spread, z, badZ, window: [lo, hi],
    slope: slope(points, now),
    age: latest ? now - latest.t : Infinity,
  };
}

function thin(points, binH = 2) {
  const bins = new Map();
  for (const p of points) {
    const b = Math.floor(p.t / binH);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b).push(p);
  }
  return [...bins.values()].map((arr) => ({ t: arr[arr.length - 1].t, v: median(arr.map((p) => p.v)) }));
}
