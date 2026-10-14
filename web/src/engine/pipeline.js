// Orchestration flow (design doc §9): trigger → update state → crash check → score → tasks → rank → word.
// runWard() is a pure function of (ward, now, nurse events) so the whole ward can be replayed,
// scrubbed back and forth, and compared between Naïve and WardPulse on identical data.
import { ENGINE } from '../config/engine.js';
import { chartedReadings } from '../sim/ward.js';
import { bedState, scoreBed } from './score.js';
import { naiveStatus } from './news2.js';
import { allocate, candidateFor, evidence, reasonLine } from './prioritise.js';

/** Nurse events → interventions that change the simulated patient's true physiology. */
export function interventionsFrom(events) {
  const out = [];
  for (const e of events) {
    if (e.type === 'done' && e.actions?.includes('A02')) out.push({ bed: e.bed, t: e.t, kind: 'cannula' });
    if (e.type === 'escalate' || (e.type === 'done' && e.actions?.includes('A09'))) out.push({ bed: e.bed, t: e.t, kind: 'review' });
    if (e.type === 'ack') out.push({ bed: e.bed, t: e.t, kind: 'rrt' });
  }
  return out;
}

export function readingsFor(ward, bed, now, events, interventions) {
  const charted = chartedReadings(ward, bed, now, interventions);
  const manual = events
    .filter((e) => e.type === 'vitals' && e.bed === bed.bed && e.t <= now)
    .map((e) => ({ id: e.id, bed: e.bed, t: e.t, vitals: e.vitals, source: e.source || 'manual', by: e.by }));
  return [...charted, ...manual].sort((a, b) => a.t - b.t);
}

function latestHandled(events, now) {
  const h = {};
  for (const e of events) {
    if (e.t > now) continue;
    if (e.type === 'done') h[e.bed] = { kind: 'done', t: e.t, risk: e.risk ?? 0 };
    if (e.type === 'snooze') h[e.bed] = { kind: 'snooze', t: e.t, until: e.until, reason: e.reason };
    if (e.type === 'escalate') h[e.bed] = { kind: 'escalate', t: e.t, risk: e.risk ?? 0 };
  }
  return h;
}

/**
 * Score the whole ward at `now`.
 * @returns {{ beds, crashes, ackedCrashes, active, standby, now }}
 */
export function runWard(ward, now, events = [], { K = ENGINE.K, prevActive = new Set() } = {}) {
  const evs = events.filter((e) => e.t <= now);
  const interventions = interventionsFrom(evs);
  const acks = new Set(evs.filter((e) => e.type === 'ack').map((e) => e.crashId));
  const handled = latestHandled(evs, now);

  const beds = [];
  const cands = [];
  const ackedCrashes = [];
  for (const p of ward.beds) {
    if (now < p.admitted) {
      beds.push({ patient: p, empty: true, status: 'empty' });
      continue;
    }
    const readings = readingsFor(ward, p, now, evs, interventions);
    const state = bedState(p, readings, now);
    const score = scoreBed(state);
    const naive = naiveStatus(state.latest);

    // Crash bypass: rule on latest observation set, or an un-acknowledged "I'm worried".
    let crashId = null, crashFiredAt = null, crashReasons = score.crash;
    if (score.crashFlag) { crashId = `obs:${state.lastObs.id}`; crashFiredAt = state.lastObs.t; }
    const worry = evs.filter((e) => e.type === 'worried' && e.bed === p.bed && !acks.has(`worry:${e.id}`)).pop();
    if (!crashId || acks.has(crashId)) {
      if (worry) { crashId = `worry:${worry.id}`; crashFiredAt = worry.t; crashReasons = []; }
    }
    const crashActive = !!crashId && !acks.has(crashId);
    if (crashId && acks.has(crashId)) ackedCrashes.push({ bed: p.bed, crashId, patient: p });

    const cand = candidateFor(score, p, { now, crashActive });
    let task = null;
    if (cand) {
      task = {
        ...cand, key: `${p.bed}:${cand.type}`, bed: p.bed, patient: p, score,
        reason: reasonLine(cand.type, { ...score, crash: crashReasons }, p),
        evidence: evidence(score), crashId: crashActive ? crashId : null, firedAt: crashFiredAt,
      };
      cands.push(task);
    }
    const overdue = Object.values(score.staleness).some((s) => s.ratio >= 1);
    beds.push({ patient: p, state, score, naive, task, overdue, readings });
  }

  const alloc = allocate(cands, { K, prevActive, handled, now });
  const activeKeys = new Set(alloc.active.map((t) => t.key));
  const standbyKeys = new Set(alloc.standby.map((t) => t.key));
  for (const b of beds) {
    if (b.empty) continue;
    b.status = b.task?.type === 'CRASH' ? 'crash'
      : b.task && activeKeys.has(b.task.key) ? 'active'
      : (b.task && standbyKeys.has(b.task.key) && b.task.type !== 'ROUTINE') || b.score.risk >= 0.2 ? 'watch'
      : 'calm';
    b.slot = b.task && activeKeys.has(b.task.key) ? 'active' : b.task && standbyKeys.has(b.task.key) ? 'standby' : null;
  }
  return { now, beds, crashes: alloc.crashes, ackedCrashes, active: alloc.active, standby: alloc.standby, handled };
}

// ---------------------------------------------------------------------------------------------
// Passive replay for the proof metrics (both modes, identical data, no nurse actions).
const replayCache = new Map();

export function replay(ward, { K = ENGINE.K, step = ENGINE.wardTickH, until = 48 } = {}) {
  const ck = `${ward.seed}:${K}:${until}`;
  if (replayCache.has(ck)) return replayCache.get(ck);
  const ticks = [];
  let prevActive = new Set();
  let prevCrash = new Set();
  let wpAlerts = 0, naiveAlerts = 0, wpBed3 = 0, naiveBed3 = 0;
  const firstWp = {}, firstNaive = {};
  const lastObsSeen = {};
  for (let t = 0; t <= until + 1e-9; t += step) {
    const r = runWard(ward, t, [], { K, prevActive });
    const actKeys = new Set(r.active.map((x) => x.key));
    for (const a of r.active) if (!prevActive.has(a.key)) { wpAlerts++; if (a.bed === 3) wpBed3++; (firstWp[a.bed] ||= []).push(t); }
    const crashIds = new Set(r.crashes.map((c) => c.crashId));
    for (const c of r.crashes) if (!prevCrash.has(c.crashId)) { wpAlerts++; (firstWp[c.bed] ||= []).push(t); }
    let naiveRed = 0, naiveAny = 0;
    for (const b of r.beds) {
      if (b.empty) continue;
      const lo = b.state.lastObs;
      if (b.naive.status !== 'quiet') naiveAny++;
      if (b.naive.status === 'red') { naiveRed++; (firstNaive[b.patient.bed] ||= []).push(t); }
      if (lo && lastObsSeen[b.patient.bed] !== lo.id) {
        lastObsSeen[b.patient.bed] = lo.id;
        if (b.naive.status !== 'quiet') { naiveAlerts++; if (b.patient.bed === 3) naiveBed3++; }
      }
    }
    ticks.push({ t, wpAlerts, naiveAlerts, wpBed3, naiveBed3, wpActive: r.active.length + r.crashes.length, naiveAny, naiveRed });
    prevActive = actKeys;
    prevCrash = crashIds;
  }
  const out = { ticks, firstWp, firstNaive, step };
  replayCache.set(ck, out);
  return out;
}

/** Headline comparison at `now` (design doc §13). */
export function metricsAt(ward, now, opts) {
  const rp = replay(ward, opts);
  const i = Math.max(0, Math.min(rp.ticks.length - 1, Math.floor(now / rp.step)));
  const tick = rp.ticks[i];
  const hours = Math.max(1, now);
  const evs = ward.events.map((ev) => {
    const lead = (arr) => {
      const hit = (arr || []).find((t) => t >= ev.t - 12 && t <= ev.t && t <= now);
      return hit != null ? ev.t - hit : null;
    };
    return { ...ev, happened: ev.t <= now, wpLead: lead(rp.firstWp[ev.bed]), naiveLead: lead(rp.firstNaive[ev.bed]) };
  });
  const due = evs.filter((e) => e.happened);
  const caught = (k) => due.filter((e) => e[k] != null).length;
  const medLead = (k) => {
    const xs = due.map((e) => e[k]).filter((x) => x != null).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor((xs.length - 1) / 2)] : null;
  };
  return {
    now, hours,
    wardpulse: { alertsPerHour: tick.wpAlerts / hours, alerts: tick.wpAlerts, caught: caught('wpLead'), due: due.length, medianLead: medLead('wpLead'), bed3: tick.wpBed3, onScreen: tick.wpActive },
    naive: { alertsPerHour: tick.naiveAlerts / hours, alerts: tick.naiveAlerts, caught: caught('naiveLead'), due: due.length, medianLead: medLead('naiveLead'), bed3: tick.naiveBed3, onScreen: tick.naiveAny },
    events: evs,
    series: rp.ticks.filter((x) => x.t <= now),
  };
}
