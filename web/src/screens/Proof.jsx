// Proof (design doc §13): events caught per alert under a fixed attention budget, both modes,
// identical data. Passive replay — no nurse actions — so the comparison is fair.
import { useMemo, useState } from 'react';
import { WARD } from '../sim/scenario.js';
import { fmtClock } from '../sim/ward.js';
import { useWard } from '../store/WardContext.jsx';

function Stat({ label, naive, wp, unit = '', note, lowerIsBetter }) {
  const better = lowerIsBetter ? wp <= naive : wp >= naive;
  return (
    <div className="panel p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 flex items-end gap-5">
        <div>
          <div className="num text-4xl font-extrabold leading-none">{wp ?? '—'}<span className="text-base text-muted">{unit}</span></div>
          <div className="mt-1 text-xs font-semibold"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(var(--s-wp))' }} />WardPulse</div>
        </div>
        <div className="pb-0.5">
          <div className="num text-2xl font-bold leading-none text-muted">{naive ?? '—'}<span className="text-sm">{unit}</span></div>
          <div className="mt-1 text-xs text-muted"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(var(--s-naive))' }} />Naïve AI</div>
        </div>
      </div>
      {note && <div className={`mt-2 text-xs ${better ? 'text-calm' : 'text-muted'}`}>{note}</div>}
    </div>
  );
}

/** Cumulative alerts, two series, one axis, crosshair + tooltip. */
function AlertsChart({ series, events, now }) {
  const [hover, setHover] = useState(null);
  const W = 1100, H = 320, pl = 44, pr = 120, pt = 46, pb = 30;
  const maxY = Math.max(10, ...series.map((s) => s.naiveAlerts));
  const x = (t) => pl + (t / WARD.durationH) * (W - pl - pr);
  const y = (v) => pt + (1 - v / maxY) * (H - pt - pb);
  const line = (k) => series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[k]).toFixed(1)}`).join(' ');
  const last = series[series.length - 1];
  const ticks = useMemo(() => { const st = Math.ceil(maxY / 4 / 10) * 10 || 10; return Array.from({ length: Math.floor(maxY / st) + 1 }, (_, i) => i * st); }, [maxY]);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width * W - pl) / (W - pl - pr) * WARD.durationH;
    const s = series.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), series[0]);
    setHover(s);
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Cumulative alerts over time, Naïve AI versus WardPulse">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeWidth="1" />
            <text x={pl - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))" className="num">{v}</text>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, i) => i * 8).map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))" className="num">{fmtClock(t).hhmm}</text>
        ))}
        {events.map((e, i) => (
          <g key={e.bed}>
            <line x1={x(e.t)} x2={x(e.t)} y1={pt - 30 + i * 12} y2={H - pb} stroke="rgb(var(--muted))" strokeDasharray="3 4" strokeWidth="1" />
            <text x={x(e.t) + 4} y={pt - 22 + i * 12} fontSize="11" fill="rgb(var(--muted))">Bed {e.bed} event</text>
          </g>
        ))}
        <path d={line('naiveAlerts')} fill="none" stroke="rgb(var(--s-naive))" strokeWidth="2" strokeLinejoin="round" />
        <path d={line('wpAlerts')} fill="none" stroke="rgb(var(--s-wp))" strokeWidth="2" strokeLinejoin="round" />
        {last && (
          <>
            <circle cx={x(last.t)} cy={y(last.naiveAlerts)} r="4" fill="rgb(var(--s-naive))" stroke="rgb(var(--panel))" strokeWidth="2" />
            <circle cx={x(last.t)} cy={y(last.wpAlerts)} r="4" fill="rgb(var(--s-wp))" stroke="rgb(var(--panel))" strokeWidth="2" />
            <text x={x(last.t) + 8} y={y(last.naiveAlerts) + 4} fontSize="12" fill="rgb(var(--ink))" fontWeight="700">Naïve {last.naiveAlerts}</text>
            <text x={x(last.t) + 8} y={y(last.wpAlerts) + 4} fontSize="12" fill="rgb(var(--ink))" fontWeight="700">WardPulse {last.wpAlerts}</text>
          </>
        )}
        {hover && (
          <g>
            <line x1={x(hover.t)} x2={x(hover.t)} y1={pt} y2={H - pb} stroke="rgb(var(--ink) / 0.4)" strokeWidth="1" />
            <circle cx={x(hover.t)} cy={y(hover.naiveAlerts)} r="4" fill="rgb(var(--s-naive))" stroke="rgb(var(--panel))" strokeWidth="2" />
            <circle cx={x(hover.t)} cy={y(hover.wpAlerts)} r="4" fill="rgb(var(--s-wp))" stroke="rgb(var(--panel))" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute top-2 rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-card"
          style={{ left: `min(calc(${(x(hover.t) / W) * 100}% + 12px), calc(100% - 180px))` }}>
          <div className="num font-bold">{fmtClock(hover.t).label}</div>
          <div><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(var(--s-naive))' }} />Naïve alerts <b className="num">{hover.naiveAlerts}</b> · on screen <b className="num">{hover.naiveAny}</b></div>
          <div><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: 'rgb(var(--s-wp))' }} />WardPulse cards <b className="num">{hover.wpAlerts}</b> · on screen <b className="num">{hover.wpActive}</b></div>
        </div>
      )}
      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: 'rgb(var(--s-naive))' }} />Naïve AI — alarms fired</span>
        <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: 'rgb(var(--s-wp))' }} />WardPulse — cards + crash banners shown</span>
      </div>
    </div>
  );
}

export default function Proof() {
  const { metrics, now } = useWard();
  const n = metrics.naive, w = metrics.wardpulse;
  const ratio = w.alertsPerHour > 0 ? n.alertsPerHour / w.alertsPerHour : null;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Proof: same ward, same data, two systems</h1>
        <p className="text-sm text-muted">Replay from {fmtClock(0).label} to {fmtClock(now).label}. Scrub the timeline to move the cut-off.{ratio ? ` WardPulse fires ${ratio.toFixed(1)}× fewer alerts.` : ''}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Alerts per nurse-hour" wp={+w.alertsPerHour.toFixed(1)} naive={+n.alertsPerHour.toFixed(1)} lowerIsBetter note="Target ≤ 4 (excluding crashes)" />
        <Stat label="True events caught" wp={`${w.caught}/${w.due}`} naive={`${n.caught}/${n.due}`} note="Reached an active card before the event" />
        <Stat label="Median warning time" wp={w.medianLead != null ? +w.medianLead.toFixed(1) : null} naive={n.medianLead != null ? +n.medianLead.toFixed(1) : null} unit=" h" note="First card → deterioration event" />
        <Stat label="False alerts · Bed 3 (COPD)" wp={w.bed3} naive={n.bed3} lowerIsBetter note="Personal baseline vs fixed thresholds" />
      </div>
      <section className="panel p-4">
        <h2 className="mb-2 font-bold">Cumulative alerts over the shift</h2>
        <AlertsChart series={metrics.series} events={metrics.events} now={now} />
      </section>
      <section className="panel overflow-x-auto p-4">
        <h2 className="mb-2 font-bold">Ground-truth deterioration events</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1.5">Bed</th><th>Event</th><th>Time</th><th className="text-right">Naïve warning</th><th className="text-right">WardPulse warning</th></tr></thead>
          <tbody>
            {metrics.events.map((e) => (
              <tr key={e.bed} className="border-t border-line">
                <td className="num py-2 font-bold">{e.bed}</td>
                <td>{e.label}</td>
                <td className="num">{fmtClock(e.t).label}{!e.happened && <span className="ml-1 text-xs text-faint">(future)</span>}</td>
                <td className="num text-right">{e.naiveLead != null ? `${e.naiveLead.toFixed(2)} h` : '—'}</td>
                <td className="num text-right font-bold">{e.wpLead != null ? `${e.wpLead.toFixed(2)} h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Simulated ward data. Naïve AI = NEWS2 scale 1 thresholds per reading, every patient. WardPulse = personal baseline + freshness + K-card budget.
          The risk model is a transparent heuristic stand-in until the LightGBM model (trained on sparsified PhysioNet 2019) is plugged in.
        </p>
      </section>
    </div>
  );
}
