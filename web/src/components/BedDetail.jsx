// Bed detail (design doc §11.1): 24 h sparklines with personal-baseline band, data-age chips,
// "why" explanation, NEWS2 breakdown and card history.
import { AlertTriangle, ClipboardList, PenLine } from 'lucide-react';
import { SCORED_VITALS, VITALS, fmtVital } from '../config/vitals.js';
import { series } from '../engine/baseline.js';
import { vitalsLine } from '../engine/narrative.js';
import { fmtAge, fmtClock } from '../sim/ward.js';
import { useWard } from '../store/WardContext.jsx';
import Sparkline from './Sparkline.jsx';
import { patientLine } from './TaskCard.jsx';
import { AgeChip, Modal, RiskDial, StatusPill, TypeBadge } from './ui.jsx';

export default function BedDetail() {
  const { bedOpen, result, actions, audit, now, mode, t } = useWard();
  const b = bedOpen != null ? result.beds.find((x) => x.patient.bed === bedOpen) : null;
  const open = !!b && !b.empty;
  const s = b?.score;
  const history = audit.filter((a) => a.bed === bedOpen).slice(0, 12);
  return (
    <Modal open={open} onClose={actions.closeBed} title={open ? `Bed ${b.patient.bed} · ${b.patient.name}` : ''} side>
      {open && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted">{patientLine(b.patient)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill status={b.status} />
                {b.task && <TypeBadge type={b.task.type} />}
                {b.patient.chronic.map((c) => <span key={c} className="chip bg-raised text-muted border border-line">{c}</span>)}
                {b.patient.copdTarget && <span className="chip bg-raised text-muted border border-line">SpO₂ target 88–92 %</span>}
                {s.coldStart && <span className="chip bg-measure/10 text-measure">Cold start · NEWS2 bands</span>}
              </div>
              {b.patient.story && <p className="mt-3 max-w-md text-sm italic text-muted">“{b.patient.story}”</p>}
            </div>
            <div className="flex gap-4">
              <RiskDial value={s.risk} label="Risk 12 h" />
              <RiskDial value={s.uncertainty} label="Uncertainty" tone="text-measure" />
            </div>
          </div>

          <div className="num rounded-xl bg-raised px-3 py-2 text-sm">{vitalsLine(s.features.L)}</div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary tap focus-ring" onClick={() => { actions.closeBed(); actions.openEntry(b.patient.bed); }}><PenLine size={17} /> {t.enterVitals}</button>
            <button className="btn-crash tap focus-ring" onClick={() => actions.worried(b.patient.bed)}><AlertTriangle size={17} /> {t.worried}</button>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Last 24 h vs own baseline</h3>
            <div className="space-y-2">
              {SCORED_VITALS.map((k) => {
                const bl = s.features.drift[k];
                const base = b.state.base[k];
                return (
                  <div key={k} className="grid grid-cols-[88px_1fr] items-center gap-3 rounded-xl border border-line p-2">
                    <div>
                      <div className="text-sm font-bold">{VITALS[k].label}</div>
                      <div className="text-[11px] text-muted">{base.valid ? `base ${fmtVital(k, base.median)}` : 'no baseline'}</div>
                      <div className={`num text-[11px] ${bl.d > 0.3 ? 'font-bold text-escalate' : 'text-faint'}`}>z {bl.z >= 0 ? '+' : ''}{bl.z.toFixed(1)}</div>
                      <div className="mt-1"><AgeChip label="" age={s.staleness[k].age} compact /></div>
                    </div>
                    <Sparkline vital={k} points={series(b.readings, k)} baseline={base.valid ? base : null} now={now} />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
              <span><span className="inline-block h-2 w-4 rounded bg-pulse/20 align-middle" /> personal normal (median ± 1.5 spread)</span>
              <span>○ charted round</span>
              <span className="text-pulse">◆ entered on WardPulse</span>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Why (top factors)</h3>
              {s.factors.length ? (
                <ul className="space-y-1 text-sm">{s.factors.map((f) => <li key={f.key}>• {f.phrase}</li>)}</ul>
              ) : <p className="text-sm text-muted">Nothing unusual vs this patient's own baseline.</p>}
            </div>
            <div className="rounded-xl border border-line p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                NEWS2 {b.patient.copdTarget ? '(scale 2)' : ''} = <span className="num">{s.features.news2.total}</span>
                {mode === 'naive' && <span className="ml-2 text-crash">naïve: {b.naive.status}</span>}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(s.features.news2.parts).map(([k, v]) => (
                  <span key={k} className={`chip num ${v >= 3 ? 'bg-crash/10 text-crash' : v >= 1 ? 'bg-amber/10 text-amber' : 'bg-raised text-muted'}`}>{k} {v}</span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">Naïve AI would score this patient on scale 1 with no baseline: <b>{b.naive.score}</b> → {b.naive.status}.</p>
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted"><ClipboardList size={14} /> Card & action history</h3>
            {history.length ? (
              <ol className="space-y-1 text-sm">
                {history.map((h) => <li key={h.id} className="flex gap-2"><span className="num w-12 shrink-0 text-muted">{fmtClock(h.t).hhmm}</span><span>{h.text}</span></li>)}
              </ol>
            ) : <p className="text-sm text-muted">No cards or actions logged yet this session. Last reading {fmtAge(now - (b.state.lastObs?.t ?? now))} ago.</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}
