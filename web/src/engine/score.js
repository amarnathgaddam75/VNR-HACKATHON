// Intelligence layer (design doc §6): per bed → { risk, uncertainty, crash flag, top factors }.
// `riskModel` is a transparent logistic STAND-IN for the LightGBM model. Swap it for the
// backend's score(patient_state) once Member 2's model is trained — the outputs keep the same shape.
import { VITALS, SCORED_VITALS, KEY_VITALS, fmtVital } from '../config/vitals.js';
import { ENGINE } from '../config/engine.js';
import { baselineFor, series } from './baseline.js';
import { news2 } from './news2.js';
import { crashCheck } from './crash.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export const MODEL_INFO = {
  name: 'Heuristic logistic (LightGBM stand-in)',
  version: 'heuristic-0.3',
  note: 'Replace with calibrated LightGBM + SHAP from the backend; output contract is identical.',
};

/** Patient state at `now`: latest value per vital + personal baselines. */
export function bedState(patient, readings, now) {
  const rs = readings.filter((r) => r.t <= now).sort((a, b) => a.t - b.t);
  const base = {};
  for (const k of SCORED_VITALS) base[k] = baselineFor(series(rs, k), k, now);
  const dbpS = series(rs, 'dbp');
  const lastObs = rs.length ? rs[rs.length - 1] : null;
  // AVPU / O2 from the most recent observation set
  const avpu = lastObs?.vitals.avpu ?? 'A';
  const o2 = lastObs?.vitals.o2 ?? !!patient.o2;
  const latest = { avpu, o2 };
  for (const k of SCORED_VITALS) latest[k] = base[k].latest?.v;
  latest.dbp = dbpS.length ? dbpS[dbpS.length - 1].v : undefined;
  const validCount = SCORED_VITALS.filter((k) => base[k].valid).length;
  return { patient, readings: rs, base, latest, lastObs, now, coldStart: validCount < 3 };
}

/** Feature vector (with optional value overrides used for the uncertainty what-ifs). */
export function features(state, override = {}) {
  const { base, patient } = state;
  const L = { ...state.latest, ...override };
  const drift = {};
  for (const k of SCORED_VITALS) {
    const b = base[k];
    if (!b.valid || L[k] == null) { drift[k] = { z: 0, d: 0 }; continue; }
    const z = (L[k] - b.median) / b.spread;
    const def = VITALS[k];
    const bad = def.bad === 'up' ? z : def.bad === 'down' ? -z : Math.abs(z);
    drift[k] = { z, d: clamp(bad - 1.5, 0, 3) };
  }
  const scale2 = !!patient.copdTarget;
  const nNow = news2(L, { scale2 });
  let nBase = null;
  if (!state.coldStart) {
    const bv = { avpu: 'A', o2: L.o2 };
    for (const k of SCORED_VITALS) bv[k] = base[k].valid ? base[k].median : L[k];
    nBase = news2(bv, { scale2 });
  }
  const news2Delta = nBase ? Math.max(0, nNow.total - nBase.total) : nNow.total;
  const si = L.hr != null && L.sbp ? L.hr / L.sbp : 0.7;
  const siExcess = clamp((si - 0.85) * 4, 0, 2);
  let trend = 0;
  for (const k of SCORED_VITALS) {
    const b = base[k];
    if (!b.valid) continue;
    const def = VITALS[k];
    const s = (b.slope * 6) / def.floor;
    trend += clamp(def.bad === 'up' ? s : def.bad === 'down' ? -s : Math.abs(s), 0, 3);
  }
  const avpuFlag = L.avpu && L.avpu !== 'A' ? 1 : 0;
  return { L, drift, news2: nNow, news2Base: nBase, news2Delta, si, siExcess, trend, avpuFlag, coldStart: state.coldStart };
}

/** Logistic stand-in. Returns probability + additive contributions (SHAP-like, in logit units). */
export function riskModel(f) {
  const contrib = [];
  const add = (key, w, phrase) => { if (Math.abs(w) > 0.01) contrib.push({ key, w, phrase }); };
  let logit = -4.2;
  if (f.coldStart) {
    add('news2', 0.42 * f.news2.total, `NEWS2 ${f.news2.total} (no baseline yet)`);
  } else {
    let drifting = 0;
    for (const k of SCORED_VITALS) {
      const d = f.drift[k].d;
      if (d > 0) add(k, 0.7 * d, null);
      if (d > 0.4) drifting++;
    }
    add('multi', drifting >= 2 ? 0.8 : 0, `${drifting} vitals drifting together`);
    add('news2', 0.25 * f.news2Delta, `NEWS2 +${f.news2Delta} vs own normal`);
  }
  add('si', 0.9 * f.siExcess, `Shock index ${f.si.toFixed(2)}`);
  add('avpu', 2.6 * f.avpuFlag, `New confusion / AVPU ${f.L.avpu}`);
  add('trend', 0.12 * Math.min(f.trend, 6), 'Vitals trending the wrong way');
  for (const c of contrib) logit += c.w;
  return { p: sigmoid(logit), logit, contrib: contrib.sort((a, b) => b.w - a.w) };
}

function expectedInterval(risk, coldStart) {
  const E = ENGINE.expectedIntervalH;
  if (coldStart) return E.coldStart;
  return risk >= 0.5 ? E.high : risk >= 0.2 ? E.moderate : E.stable;
}

/** Full score for one bed — the contract the prioritisation engine consumes. */
export function scoreBed(state) {
  const { base, now, patient } = state;
  const f = features(state);
  const m = riskModel(f);
  const interval = expectedInterval(m.p, state.coldStart);

  // Freshness: staleness ratio per vital
  const staleness = {};
  for (const k of SCORED_VITALS) {
    const age = base[k].age;
    staleness[k] = { age, ratio: age / interval, stale: age / interval >= 1 };
  }

  // Uncertainty = gap between worst- and best-case risk if each stale key vital were measured now
  let uncertainty = 0, uncVital = null, riskWorst = m.p;
  for (const k of KEY_VITALS) {
    if (!staleness[k].stale) continue;
    const b = base[k];
    const def = VITALS[k];
    const centre = b.latest ? b.latest.v : b.median;
    if (centre == null) continue;
    const width = 2 * b.spread * Math.sqrt(Math.min(staleness[k].ratio, 4));
    const worseSign = def.bad === 'down' ? -1 : 1;
    const worst = riskModel(features(state, { [k]: centre + worseSign * width })).p;
    const best = riskModel(features(state, { [k]: centre - worseSign * width })).p;
    const gap = Math.max(0, worst - best);
    if (gap > uncertainty) { uncertainty = gap; uncVital = k; riskWorst = Math.max(m.p, worst); }
  }

  const crash = crashCheck(state.lastObs, patient, now);

  // Human-readable top factors (templated — the LLM may only rephrase these, never add new numbers)
  const factors = m.contrib.slice(0, 4).map((c) => {
    if (VITALS[c.key]) {
      const b = base[c.key];
      const def = VITALS[c.key];
      const delta = f.L[c.key] - b.median;
      const sign = delta >= 0 ? '+' : '−';
      return {
        key: c.key, weight: c.w,
        phrase: `${def.label} ${sign}${fmtVital(c.key, Math.abs(delta))} vs own baseline`,
        value: f.L[c.key], baseline: b.median, arrow: delta >= 0 ? '↑' : '↓',
      };
    }
    return { key: c.key, weight: c.w, phrase: c.phrase };
  });
  if (uncVital) {
    factors.push({ key: `stale_${uncVital}`, weight: uncertainty, phrase: `${VITALS[uncVital].label} ${fmtAgeShort(staleness[uncVital].age)} old`, stale: true });
  }

  return {
    bed: patient.bed, risk: m.p, logit: m.logit, uncertainty, uncVital, riskWorst,
    crash, crashFlag: crash.length > 0, factors, features: f, staleness, interval,
    baselines: Object.fromEntries(SCORED_VITALS.map((k) => [k, base[k].median])),
    coldStart: state.coldStart, trend: f.trend, model: MODEL_INFO.version,
  };
}

function fmtAgeShort(h) {
  if (!Number.isFinite(h)) return 'never measured —';
  return h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`;
}
