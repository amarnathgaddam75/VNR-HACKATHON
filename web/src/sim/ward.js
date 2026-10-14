// Ward simulator: true physiology on a 15-min grid + a realistic, sparse charting schedule.
// Pure + seeded, so every replay (and both demo modes) see identical data.
import { BEDS, EVENTS, FORCED_READINGS, MISSED, SCRIPTS, WARD } from './scenario.js';

const GRID_H = 0.25;
const NOISE_SD = { hr: 2.2, sbp: 3.5, dbp: 2.5, rr: 0.6, spo2: 0.5, temp: 0.08 };
const MEAS_SD = { hr: 2, sbp: 3, dbp: 3, rr: 0.8, spo2: 0.6, temp: 0.1 };
const AR = 0.85;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (k, v) => (k === 'temp' ? Math.round(v * 10) / 10 : Math.round(v));

/** Build the static part of the ward: noise tracks + charting schedule. */
export function buildWard(seed = 7) {
  const rng = mulberry32(seed);
  const t0 = -WARD.historyH;
  const n = Math.round((WARD.durationH - t0) / GRID_H) + 1;

  const beds = BEDS.map((p) => {
    // AR(1) noise tracks per vital (scripted story beds are a little less noisy so the demo lands)
    const ns = p.noiseScale ?? (p.script ? 0.5 : 1);
    const noise = {};
    for (const k of Object.keys(NOISE_SD)) {
      const arr = new Float32Array(n);
      let x = 0;
      for (let i = 0; i < n; i++) {
        x = AR * x + NOISE_SD[k] * Math.sqrt(1 - AR * AR) * gauss(rng) * 1.6 * ns;
        arr[i] = x;
      }
      noise[k] = arr;
    }

    // Charting schedule: 4-hourly rounds (2-hourly for post-op day ≤1), jitter ±45 min,
    // 15 % chance per vital of not being charted, 6 % chance of a whole missed round.
    const admitted = p.admittedAt ?? t0;
    const times = [];
    const every = (t) => (p.postOp && t < 24 ? 2 : 4);
    for (let t = t0 + 2; t <= WARD.durationH; ) {
      if (t >= admitted) times.push(t + (rng() - 0.5) * 1.5);
      t += every(t);
    }
    if (p.admittedAt != null) {
      for (let t = p.admittedAt; t < p.admittedAt + 6; t += 2) times.push(t + 0.1 + rng() * 0.3);
    }
    // Escalated obs: hourly once the patient is visibly unwell (informative missingness).
    if (p.script === 'postOpDrift') for (let t = 20; t <= 26; t += 1) times.push(t + rng() * 0.4);
    if (p.script === 'sepsisCrash') for (let t = 24; t < 30; t += 1) times.push(t + rng() * 0.4);
    for (const ft of FORCED_READINGS[p.bed] || []) times.push(ft);

    const schedule = times
      .filter((t) => t >= admitted && t <= WARD.durationH)
      .sort((a, b) => a - b)
      .map((t, i) => {
        const forced = (FORCED_READINGS[p.bed] || []).includes(t);
        const skipRound = !forced && !p.reliable && rng() < 0.06;
        const present = {};
        for (const k of ['hr', 'sbp', 'rr', 'spo2', 'temp']) present[k] = forced || (!skipRound && (rng() > 0.15 || p.reliable));
        present.dbp = present.sbp;
        for (const m of MISSED[p.bed] || []) {
          if (t >= m.from && t <= m.to) for (const k of m.vitals) present[k] = false;
        }
        const meas = {};
        for (const k of Object.keys(MEAS_SD)) meas[k] = gauss(rng) * MEAS_SD[k] * (ns < 1 ? 0.6 : 1);
        return { id: `c${p.bed}-${i}`, t, present, meas, skipRound };
      })
      .filter((s) => !s.skipRound);

    return { ...p, admitted, noise, schedule };
  });

  return { seed, t0, n, beds, events: EVENTS };
}

/** True physiology for a bed at time t, given the interventions so far. */
export function truthAt(ward, bed, t, interventions = []) {
  const i = clamp(Math.round((t - ward.t0) / GRID_H), 0, ward.n - 1);
  const iv = interventions.filter((x) => x.bed === bed.bed && x.t <= t);
  const d = bed.script ? SCRIPTS[bed.script](t, iv) : {};
  const v = {};
  for (const k of ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp']) {
    v[k] = bed.base[k] + (d[k] || 0) + bed.noise[k][i];
  }
  v.spo2 = Math.min(100, v.spo2);
  v.avpu = d.avpu || 'A';
  v.o2 = !!bed.o2;
  return v;
}

/** Charted (observed) readings for a bed up to `now`: what a ward actually has. */
export function chartedReadings(ward, bed, now, interventions = []) {
  if (bed.fixedReadings) return bed.fixedReadings.filter((r) => r.t <= now); // loaded from a dataset
  const out = [];
  for (const s of bed.schedule) {
    if (s.t > now) break;
    const truth = truthAt(ward, bed, s.t, interventions);
    const vitals = { avpu: truth.avpu, o2: truth.o2 };
    for (const k of ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp']) {
      if (s.present[k]) vitals[k] = round(k, clamp(truth[k] + s.meas[k], 0, k === 'spo2' ? 100 : 400));
    }
    out.push({ id: s.id, bed: bed.bed, t: s.t, vitals, source: 'chart', by: 'round' });
  }
  return out;
}

/** "Read from device" in the demo: the true value right now, with a little measurement noise. */
export function deviceReading(ward, bed, now, interventions = []) {
  if (bed.fixedReadings) {
    const last = bed.fixedReadings.filter((r) => r.t <= now).pop();
    return last ? { ...last.vitals } : {};
  }
  const truth = truthAt(ward, bed, now, interventions);
  const v = { avpu: truth.avpu, o2: truth.o2 };
  for (const k of ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp']) v[k] = round(k, truth[k]);
  return v;
}

export function fmtClock(t, startClock = WARD.startClock) {
  const total = Math.round((t + startClock) * 60);
  const day = Math.floor(total / (24 * 60)) + 1;
  const mins = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return { day, hhmm: `${hh}:${mm}`, label: `Day ${day} · ${hh}:${mm}` };
}

export function fmtAge(hours) {
  if (hours == null || !Number.isFinite(hours)) return 'never';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 10) return `${hours.toFixed(1).replace(/\.0$/, '')} h`;
  return `${Math.round(hours)} h`;
}
