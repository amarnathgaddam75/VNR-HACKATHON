// Communication layer (design doc §8), TEMPLATED version. This is the fallback that must always work.
// An LLM may later rephrase these strings, but only through a validator that checks every number
// against the source data and inserts catalogue actions verbatim. It never decides anything.
import { VITALS, SCORED_VITALS, fmtVital } from '../config/vitals.js';
import { actionText } from '../config/catalogue.js';
import { WARD } from '../sim/scenario.js';
import { fmtAge, fmtClock } from '../sim/ward.js';

const pct = (p) => `${Math.round(p * 100)}%`;

export function vitalsLine(L) {
  const parts = [];
  if (L.hr != null) parts.push(`HR ${fmtVital('hr', L.hr)}`);
  if (L.sbp != null) parts.push(`BP ${fmtVital('sbp', L.sbp)}${L.dbp != null ? `/${fmtVital('sbp', L.dbp)}` : ''}`);
  if (L.rr != null) parts.push(`RR ${fmtVital('rr', L.rr)}`);
  if (L.spo2 != null) parts.push(`SpO₂ ${fmtVital('spo2', L.spo2)}%${L.o2 ? ' on O₂' : ''}`);
  if (L.temp != null) parts.push(`T ${fmtVital('temp', L.temp)}°C`);
  if (L.avpu && L.avpu !== 'A') parts.push(`AVPU ${L.avpu}`);
  return parts.join(' · ');
}

/** SBAR escalation message (UC-6). */
export function buildSbar(task, now) {
  const p = task.patient;
  const s = task.score;
  const L = s.features.L;
  const drift = SCORED_VITALS
    .filter((k) => s.baselines[k] != null && L[k] != null && Math.abs(s.features.drift[k].z) >= 1.5)
    .map((k) => `${VITALS[k].label} ${fmtVital(k, L[k])} (own baseline ${fmtVital(k, s.baselines[k])})`);
  const clock = fmtClock(now).hhmm;
  return [
    `S — Bed ${p.bed}, ${p.name} ${p.age}${p.sex}. ${task.reason}.`,
    `B — ${p.type}: ${p.dx}.${p.chronic?.length ? ` Background: ${p.chronic.join(', ')}.` : ''}`,
    `A — At ${clock}: ${vitalsLine(L)}. ${drift.length ? `Drift vs own 24 h baseline: ${drift.join('; ')}. ` : ''}NEWS2 ${s.features.news2.total}. WardPulse risk ${pct(s.risk)} (next 12 h).`,
    `R — Please review at the bedside. Nursing actions in progress: ${task.actions.filter((c) => c !== 'A09').map((c) => actionText(c)).join('; ') || 'continuing observations'}.`,
    `— ${WARD.name}, sent via WardPulse`,
  ].join('\n');
}

/** Shift handover (UC-7). Every line references logged event IDs — no unsupported claims. */
export function buildHandover({ result, audit, events, now }) {
  const beds = result.beds.filter((b) => !b.empty);
  const drifting = beds
    .filter((b) => b.score.risk >= 0.3 || b.status === 'crash')
    .sort((a, b) => b.score.risk - a.score.risk)
    .map((b) => `• Bed ${b.patient.bed} ${b.patient.name} — ${b.task?.reason || 'risk elevated'} (risk ${pct(b.score.risk)}; ${vitalsLine(b.score.features.L)})`);
  const overdue = beds
    .filter((b) => b.overdue)
    .map((b) => {
      const worst = Object.entries(b.score.staleness).sort((x, y) => y[1].ratio - x[1].ratio)[0];
      return `Bed ${b.patient.bed} (${VITALS[worst[0]].label} ${fmtAge(worst[1].age)})`;
    });
  const escalated = events.filter((e) => e.type === 'escalate' || e.type === 'ack' || e.type === 'worried')
    .map((e) => `• [${e.id.slice(-6)}] ${fmtClock(e.t).hhmm} Bed ${e.bed}: ${e.type === 'escalate' ? 'doctor paged (SBAR)' : e.type === 'ack' ? 'crash acknowledged, RRT called' : "nurse raised \"I'm worried\""} — ${e.by}`);
  const pending = [...result.crashes, ...result.active, ...result.standby.filter((t) => t.type !== 'ROUTINE')]
    .map((t) => `• Bed ${t.bed}: ${t.type} — ${t.reason}`);
  const cards = audit.filter((a) => a.kind === 'card' || a.kind === 'crash').length;
  return [
    `SHIFT HANDOVER — ${WARD.name} — ${fmtClock(now).label}`,
    '',
    'WHO IS DRIFTING',
    ...(drifting.length ? drifting : ['• Nobody above moderate risk.']),
    '',
    'OVERDUE OBSERVATIONS',
    overdue.length ? `• ${overdue.join(', ')}` : '• None.',
    '',
    'ESCALATED THIS SHIFT',
    ...(escalated.length ? escalated : ['• None logged.']),
    '',
    'PENDING / OPEN CARDS',
    ...(pending.length ? pending : ['• None.']),
    '',
    `Cards shown this session: ${cards}. Generated from the audit log — edit before signing off.`,
  ].join('\n');
}
