// Ward Map (design doc §11.1): charge-nurse floor plan, beds coloured by status with icons + words,
// overdue-obs markers and nurse assignment.
import { Clock, Siren, UserRound } from 'lucide-react';
import { STATUS_META, TONE, TYPE_META } from '../components/ui.jsx';
import { fmtVital } from '../config/vitals.js';
import { WARD } from '../sim/scenario.js';
import { fmtAge } from '../sim/ward.js';
import { useWard } from '../store/WardContext.jsx';

const assignedNurse = (bed) => WARD.nurses[bed <= 7 ? 0 : bed <= 14 ? 1 : 2];

function BedTile({ b }) {
  const { actions, mode } = useWard();
  if (b.empty) {
    return (
      <div className="flex min-h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-sm text-faint">
        <span className="num text-xl font-bold">{b.patient.bed}</span>
        <span>awaiting admission</span>
      </div>
    );
  }
  const naive = mode === 'naive';
  const st = naive ? (b.naive.status === 'red' ? 'crash' : b.naive.status === 'amber' ? 'watch' : 'calm') : b.status;
  const m = STATUS_META[st];
  const tone = TONE[m.tone];
  const L = b.score.features.L;
  const lastAge = b.state.lastObs ? b.state.now - b.state.lastObs.t : Infinity;
  const TaskIcon = b.task ? TYPE_META[b.task.type].Icon : null;
  return (
    <button onClick={() => actions.openBed(b.patient.bed)}
      className={`group relative flex min-h-[132px] flex-col rounded-2xl border-2 bg-panel p-3 text-left transition hover:-translate-y-0.5 hover:shadow-card focus-ring ${tone.border} ${naive && b.naive.status === 'red' ? 'alarm-red' : naive && b.naive.status === 'amber' ? 'alarm-amber' : ''}`}>
      {/* pillow */}
      <span className="absolute left-1/2 top-1.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line" aria-hidden />
      <div className="mt-1 flex items-start justify-between gap-2">
        <span className="num text-2xl font-extrabold leading-none">{b.patient.bed}</span>
        <span className={`chip ${tone.soft} ${tone.text}`}>{st === 'crash' && !naive ? <Siren size={12} /> : <span aria-hidden>{m.glyph}</span>}{naive ? (b.naive.status === 'quiet' ? 'quiet' : `NEWS2 ${b.naive.score}`) : m.label}</span>
      </div>
      <div className="mt-1 truncate text-xs font-semibold">{b.patient.name} · {b.patient.age}{b.patient.sex}</div>
      <div className="truncate text-[11px] text-muted">{b.patient.dx}</div>
      <div className="num mt-auto pt-2 text-[11px] text-muted">
        HR {fmtVital('hr', L.hr)} · BP {fmtVital('sbp', L.sbp)} · RR {fmtVital('rr', L.rr)} · SpO₂ {fmtVital('spo2', L.spo2)}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[11px]">
        {!naive && b.task && b.task.type !== 'ROUTINE' ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${TONE[TYPE_META[b.task.type].tone].text}`}><TaskIcon size={12} />{b.task.type}</span>
        ) : <span className="text-faint">risk {(b.score.risk * 100).toFixed(0)}%</span>}
        <span className={`inline-flex items-center gap-1 ${b.overdue && !naive ? 'font-semibold text-amber' : 'text-faint'}`}>
          <Clock size={11} /> {fmtAge(lastAge)}
        </span>
      </div>
    </button>
  );
}

export default function WardMap() {
  const { result, mode } = useWard();
  const beds = result.beds;
  const top = beds.filter((b) => b.patient.bed <= 10);
  const bottom = beds.filter((b) => b.patient.bed > 10);
  const counts = beds.reduce((a, b) => ({ ...a, [b.status]: (a[b.status] || 0) + 1 }), {});
  const overdue = beds.filter((b) => b.overdue).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Ward map</h1>
          <p className="text-sm text-muted">{WARD.name} · {mode === 'naive' ? 'coloured by naïve NEWS2 thresholds' : 'coloured by WardPulse status'}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {['crash', 'active', 'watch', 'calm'].map((s) => (
            <span key={s} className={`chip ${TONE[STATUS_META[s].tone].soft} ${TONE[STATUS_META[s].tone].text} px-3 py-1`}>{STATUS_META[s].glyph} {STATUS_META[s].label} <b className="num">{counts[s] || 0}</b></span>
          ))}
          <span className="chip bg-raised px-3 py-1 text-muted"><Clock size={12} /> Obs overdue <b className="num">{overdue}</b></span>
        </div>
      </div>

      <div className="panel overflow-x-auto p-4 scroll-thin">
        <div className="min-w-[860px] space-y-3">
          <div className="grid grid-cols-10 gap-2">{top.map((b) => <BedTile key={b.patient.bed} b={b} />)}</div>
          {/* corridor + nurse station */}
          <div className="relative flex h-16 items-center justify-center rounded-xl bg-raised">
            <div className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-line" aria-hidden />
            <div className="relative flex items-center gap-4 rounded-xl border border-line bg-panel px-4 py-2 shadow-card">
              <span className="text-xs font-extrabold uppercase tracking-widest text-muted">Nurse station</span>
              {WARD.nurses.map((n, i) => (
                <span key={n} className="inline-flex items-center gap-1 text-xs"><UserRound size={13} className="text-pulse" />{n} <span className="text-faint">({['1–7', '8–14', '15–20'][i]})</span></span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-10 gap-2">{bottom.map((b) => <BedTile key={b.patient.bed} b={b} />)}</div>
        </div>
      </div>
      <p className="text-xs text-muted">Status is never colour alone: every bed shows a glyph and a word. Assignment: {top.length + bottom.length} beds across {WARD.nurses.length} nurses (bed {beds[0].patient.bed} → {assignedNurse(1)}).</p>
    </div>
  );
}
