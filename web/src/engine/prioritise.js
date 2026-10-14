// Prioritisation engine (design doc §7): candidate tasks → priority → K-card budget + crash bypass.
import { ENGINE } from '../config/engine.js';
import { CATALOGUE } from '../config/catalogue.js';
import { VITALS, KEY_VITALS, fmtVital } from '../config/vitals.js';

export const TASK_TYPES = {
  CRASH:    { label: 'CRASH',          tone: 'crash',    icon: 'siren' },
  ESCALATE: { label: 'ESCALATE',       tone: 'escalate', icon: 'phone' },
  ACTION:   { label: 'BEDSIDE ACTION', tone: 'action',   icon: 'hand' },
  MEASURE:  { label: 'MEASURE',        tone: 'measure',  icon: 'gauge' },
  ROUTINE:  { label: 'ROUTINE',        tone: 'calm',     icon: 'clock' },
};

const WORDS = { rr: 'breathing', hr: 'pulse', sbp: 'BP falling', spo2: 'oxygen falling', temp: 'temperature' };

/** Map the top factors to catalogue actions (closed set — nothing outside CATALOGUE). */
function driverActions(score) {
  const f = score.features;
  const codes = [];
  const drifting = (k) => f.drift[k]?.d > 0.3;
  if (drifting('spo2') && f.L.o2) codes.push('A02', 'A01');
  else if (drifting('spo2') || drifting('rr')) codes.push('A01');
  if (drifting('sbp') || score.features.siExcess > 0.3) codes.push('A07');
  if (drifting('sbp')) codes.push('A03');
  if (drifting('temp')) codes.push('A05');
  if (f.avpuFlag) codes.push('A06');
  return [...new Set(codes)];
}

function reasonLine(type, score, patient) {
  const f = score.features;
  if (type === 'CRASH') return score.crash.length ? `${score.crash.map((c) => c.label).join(' · ')} — collapse rule` : 'Nurse is worried — clinical concern';
  if (type === 'MEASURE') {
    const k = score.uncVital;
    const age = score.staleness[k]?.age;
    return `${VITALS[k].label} ${Number.isFinite(age) ? `${age.toFixed(0)} h` : ''} old — could change the picture`.replace('  ', ' ');
  }
  if (type === 'ROUTINE') return 'Routine observations due';
  if (f.coldStart) return 'New patient — NEWS2 raised, no baseline yet';
  const top = score.factors.filter((x) => VITALS[x.key]).slice(0, 2).map((x) => WORDS[x.key]);
  if (f.drift.spo2?.d > 0.3 && f.L.o2 && type === 'ACTION') return 'Oxygen falling despite O₂ — check delivery';
  if (!top.length) return f.siExcess > 0.3 ? 'Shock index rising' : 'Risk rising vs own baseline';
  const rising = top.filter((w) => w === 'breathing' || w === 'pulse' || w === 'temperature');
  const other = top.filter((w) => !rising.includes(w));
  const parts = [];
  if (rising.length) parts.push(`${rising.join(' and ')} rising`);
  parts.push(...other);
  const s = parts.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} vs own baseline`;
}

function evidence(score) {
  const f = score.features;
  return ['rr', 'hr', 'sbp', 'spo2', 'temp']
    .filter((k) => f.L[k] != null)
    .sort((a, b) => (f.drift[b]?.d || 0) - (f.drift[a]?.d || 0))
    .slice(0, 3)
    .map((k) => ({
      key: k, label: VITALS[k].label, value: fmtVital(k, f.L[k]),
      base: score.baselines[k] != null ? fmtVital(k, score.baselines[k]) : null,
      arrow: f.drift[k]?.d > 0.3 ? (f.drift[k].z > 0 ? '↑' : '↓') : '',
      flagged: f.drift[k]?.d > 0.3,
    }));
}

/** Generate at most one candidate task per bed (design doc §7.1). */
export function candidateFor(score, patient, ctx) {
  const { now, crashActive } = ctx;
  if (crashActive) {
    return { type: 'CRASH', actions: ['A10', 'A11'], priority: 99 };
  }
  const E = ENGINE;
  const staleKey = score.uncVital && KEY_VITALS.includes(score.uncVital);
  let type = null;
  let actions = [];
  const fixable = score.features.L.o2 && score.features.drift.spo2?.d > 0.3;
  if (score.risk >= E.riskModerate && fixable && score.risk < E.riskFixableCeiling) {
    type = 'ACTION'; // specific bedside driver: fix it first (design doc §7.1, Bed 9)
    actions = [...driverActions(score).slice(0, 2), 'A08'];
  } else if (score.risk >= E.riskHigh) {
    type = 'ESCALATE';
    actions = [...driverActions(score).slice(0, 2), 'A09'];
  } else if (score.uncertainty >= E.uncertaintyHigh && staleKey) {
    type = 'MEASURE';
    const multi = KEY_VITALS.filter((k) => score.staleness[k]?.stale).length >= 3;
    actions = multi ? ['A04'] : score.uncVital === 'sbp' ? ['A03'] : ['A04'];
  } else if (score.risk >= E.riskModerate) {
    type = 'ACTION';
    actions = [...driverActions(score).slice(0, 2), 'A08'];
  } else if (Object.values(score.staleness).some((s) => s.ratio >= 1)) {
    type = 'ROUTINE';
    actions = ['A04'];
  }
  if (!type) return null;
  actions = [...new Set(actions)].filter((c) => CATALOGUE[c]).slice(0, 3);

  const W = E.weights;
  const minutes = actions.reduce((a, c) => a + CATALOGUE[c].minutes, 0);
  let priority = W.risk * score.risk + W.voi * score.uncertainty * Math.sqrt(score.riskWorst) + W.trend * Math.min(score.trend, 6) / 6 - W.minutes * minutes;
  priority += E.typeBonus[type] || 0;
  if (type === 'ROUTINE') priority *= 0.3;
  return { type, actions, priority, minutes, standbyOnly: type === 'ROUTINE' };
}

/**
 * Rank candidates and apply the attention budget (design doc §7.3).
 * `handled` = latest nurse action per bed; `prevActive` = keys active last tick (hysteresis).
 */
export function allocate(cands, { K = ENGINE.K, prevActive = new Set(), handled = {}, now }) {
  const crashes = [];
  const pool = [];
  for (const c of cands) {
    if (c.type === 'CRASH') { crashes.push(c); continue; }
    const h = handled[c.bed];
    let suppressedReason = null;
    let p = c.priority;
    if (h) {
      if (h.kind === 'snooze' && now < h.until) suppressedReason = `Snoozed: ${h.reason}`;
      else if (h.kind === 'escalate' && now < h.t + 1 && c.type !== 'MEASURE') suppressedReason = 'Doctor paged — awaiting review';
      else if (h.kind === 'done' && now < h.t + ENGINE.cooldownH && c.score.risk - h.risk < ENGINE.cooldownBreakRisk)
        suppressedReason = `Just handled — cool-down ${Math.round((h.t + ENGINE.cooldownH - now) * 60)} min`;
      else if (h.kind === 'done' && now < h.t + 2 * ENGINE.cooldownH) p -= ENGINE.weights.recent * 0.5; // recently_handled
    }
    if (prevActive.has(c.key)) p += ENGINE.hysteresis;
    pool.push({ ...c, rankPriority: p, suppressedReason });
  }
  pool.sort((a, b) => b.rankPriority - a.rankPriority);
  const active = [];
  const standby = [];
  for (const c of pool) {
    if (!c.suppressedReason && !c.standbyOnly && active.length < K && c.rankPriority > ENGINE.minActivePriority) active.push(c);
    else standby.push(c);
  }
  return { crashes, active, standby };
}

export { reasonLine, evidence };
