// Attention Console (design doc §11.1): crash banner slot · K active cards · standby drawer.
// In Naïve mode the same ward renders as a wall of threshold alarms; toggling animates the
// tiles collapsing into the K cards (design doc §11.3 — "the moment judges remember").
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { AlertTriangle, BellRing, CheckCircle2, ChevronDown, Inbox, PenLine } from 'lucide-react';
import { useState } from 'react';
import CrashBanner from '../components/CrashBanner.jsx';
import SbarModal from '../components/SbarModal.jsx';
import TaskCard from '../components/TaskCard.jsx';
import { STATUS_META, TONE, TYPE_META, TypeBadge } from '../components/ui.jsx';
import { VITALS, fmtVital } from '../config/vitals.js';
import { fmtClock } from '../sim/ward.js';
import { useWard } from '../store/WardContext.jsx';

export default function Console() {
  const { result, mode, K, t } = useWard();
  const [sbarTask, setSbarTask] = useState(null);
  const naive = mode === 'naive';
  const alarms = result.beds.filter((b) => !b.empty && b.naive.status !== 'quiet').length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        {/* Crash bypass — never budgeted */}
        <AnimatePresence>
          {!naive && result.crashes.map((c) => <CrashBanner key={c.crashId} crash={c} />)}
        </AnimatePresence>
        {!naive && result.ackedCrashes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {result.ackedCrashes.map((c) => (
              <span key={c.crashId} className="chip border border-crash/30 bg-crash/5 text-crash"><CheckCircle2 size={13} /> Bed {c.bed} crash acknowledged — RRT attending</span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {naive ? <span className="text-crash">{alarms} alarms ringing</span> : t.nextMinutes}
            </h1>
            <p className="text-sm text-muted">
              {naive
                ? 'Naïve AI: NEWS2 thresholds per vital, no personal baseline, no freshness, no budget. Where do you start?'
                : `At most ${K} cards. Everything else is ranked in the queue — nothing is hidden.`}
            </p>
          </div>
          {!naive && <BudgetMeter used={result.active.length} K={K} />}
        </div>

        <LayoutGroup>
          <AnimatePresence mode="popLayout" initial={false}>
            {naive
              ? <motion.div key="naive" exit={{ opacity: 1 }}><NaiveWall /></motion.div>
              : <motion.div key="wp" exit={{ opacity: 0 }}><CardSlots onSbar={setSbarTask} /></motion.div>}
          </AnimatePresence>
        </LayoutGroup>

        {!naive && <StandbyDrawer />}
      </div>

      <aside className="space-y-4">
        <QuickActions />
        <WardStrip />
        <MetricsStrip />
      </aside>
      <SbarModal task={sbarTask} onClose={() => setSbarTask(null)} />
    </div>
  );
}

function BudgetMeter({ used, K }) {
  const { t } = useWard();
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2" title="Attention budget">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{t.budget}</span>
      <div className="flex gap-1">
        {Array.from({ length: K }, (_, i) => (
          <span key={i} className={`h-3 w-6 rounded-full ${i < used ? 'bg-pulse' : 'border-2 border-dashed border-line'}`} />
        ))}
      </div>
      <span className="num text-sm font-bold">{used}/{K}</span>
    </div>
  );
}

function CardSlots({ onSbar }) {
  const { result, K, t } = useWard();
  const empty = Math.max(0, K - result.active.length);
  if (!result.active.length && !result.crashes.length) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="panel flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="breathe absolute inset-0 rounded-full bg-calm/15" />
          <span className="breathe absolute inset-4 rounded-full bg-calm/25" style={{ animationDelay: '.6s' }} />
          <CheckCircle2 size={34} className="relative text-calm" />
        </div>
        <div className="text-xl font-bold">{t.allCalm}</div>
        <p className="max-w-md text-sm text-muted">{t.allCalmSub}</p>
      </motion.div>
    );
  }
  return (
    <motion.div className={`grid gap-4 ${K >= 2 ? 'lg:grid-cols-2' : ''} ${K >= 3 ? '2xl:grid-cols-3' : ''}`} initial={false} exit={{ opacity: 0 }}>
      <AnimatePresence mode="popLayout">
        {result.active.map((task, i) => <TaskCard key={task.key} task={task} rank={i + 1} onSbar={onSbar} />)}
      </AnimatePresence>
      {Array.from({ length: empty }, (_, i) => (
        <div key={`empty${i}`} className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-muted">
          <CheckCircle2 className="mb-2 text-calm" />
          Slot free — nothing else needs you right now.
        </div>
      ))}
    </motion.div>
  );
}

function NaiveWall() {
  const { result, actions } = useWard();
  const beds = result.beds.filter((b) => !b.empty);
  const order = { red: 0, amber: 1, quiet: 2 };
  const sorted = [...beds].sort((a, b) => order[a.naive.status] - order[b.naive.status] || a.patient.bed - b.patient.bed);
  return (
    <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" exit={{ opacity: 1 }}>
      {sorted.map((b) => {
        const st = b.naive.status;
        const L = b.score.features.L;
        const trig = b.naive.triggers.map((k) => (k === 'o2' ? 'on O₂' : k === 'avpu' ? `AVPU ${L.avpu}` : `${VITALS[k]?.label ?? k} ${fmtVital(k, L[k])}`));
        return (
          <motion.button
            layoutId={`bed-${b.patient.bed}`}
            key={b.patient.bed}
            onClick={() => actions.openBed(b.patient.bed)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, y: 60 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={`rounded-2xl border p-3 text-left focus-ring ${st === 'red' ? 'alarm-red border-crash/50' : st === 'amber' ? 'alarm-amber border-amber/50' : 'border-line bg-panel opacity-70'}`}
          >
            <div className="flex items-center justify-between">
              <span className="num text-2xl font-extrabold">{b.patient.bed}</span>
              {st !== 'quiet' ? (
                <span className={`chip ${st === 'red' ? 'bg-crash text-white' : 'bg-amber text-white'}`}><BellRing size={12} className="animate-pulse" /> {st === 'red' ? 'HIGH' : 'MED'}</span>
              ) : <span className="chip bg-raised text-muted">ok</span>}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted">{b.patient.name} · {b.patient.dx}</div>
            <div className="num mt-1 text-xs font-semibold">NEWS2 {b.naive.score}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted">{trig.join(' · ') || '—'}</div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function StandbyDrawer() {
  const { result, actions, t } = useWard();
  const [open, setOpen] = useState(false);
  const list = result.standby;
  const nonRoutine = list.filter((x) => x.type !== 'ROUTINE');
  const next = list[0];
  if (!list.length) return null;
  return (
    <section className="panel overflow-hidden">
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left tap focus-ring" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Inbox size={20} className="text-muted" />
        <div className="flex-1">
          <div className="font-bold"><span className="num">{list.length}</span> {t.waiting} <span className="font-normal text-muted">· {nonRoutine.length} need attention, {list.length - nonRoutine.length} routine obs</span></div>
          {next && <div className="text-sm text-muted">{t.upNext}: Bed {next.bed} — {next.reason}</div>}
        </div>
        <ChevronDown className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="divide-y divide-line overflow-hidden border-t border-line">
            {list.map((task, i) => (
              <li key={task.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="num w-5 text-sm text-faint">{i + 1}</span>
                <button onClick={() => actions.openBed(task.bed)} className="num w-14 text-left text-lg font-extrabold focus-ring rounded">B{task.bed}</button>
                <TypeBadge type={task.type} />
                <span className="min-w-0 flex-1 truncate text-sm">{task.suppressedReason ? <span className="text-muted">{task.suppressedReason}</span> : task.reason}</span>
                <span className="num text-xs text-faint">prio {task.rankPriority.toFixed(2)}</span>
                <button className="btn-ghost h-9 px-3 text-xs focus-ring" onClick={() => actions.openEntry(task.bed)}><PenLine size={14} /> Vitals</button>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}

function QuickActions() {
  const { actions, t, result } = useWard();
  const [worry, setWorry] = useState(false);
  return (
    <div className="panel p-3">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary tap focus-ring" onClick={() => actions.openEntry()}><PenLine size={18} /> {t.enterVitals}</button>
        <button className={`btn tap focus-ring ${worry ? 'bg-crash text-white' : 'border border-crash/40 text-crash bg-crash/5 hover:bg-crash/10'}`} onClick={() => setWorry((v) => !v)}>
          <AlertTriangle size={18} /> {t.worried}
        </button>
      </div>
      <AnimatePresence>
        {worry && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mt-3 text-xs text-muted">Clinical concern is always a valid trigger. Pick the bed — it jumps the queue as a crash bypass.</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {result.beds.filter((b) => !b.empty).map((b) => (
                <button key={b.patient.bed} onClick={() => { actions.worried(b.patient.bed); setWorry(false); }}
                  className="num h-11 rounded-lg border border-line font-bold hover:border-crash hover:text-crash focus-ring">{b.patient.bed}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WardStrip() {
  const { result, actions, mode, setScreen } = useWard();
  const naive = mode === 'naive';
  return (
    <section className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Ward at a glance</h2>
        <button className="text-xs font-semibold text-pulse hover:underline focus-ring rounded" onClick={() => setScreen('map')}>Open map →</button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {result.beds.map((b) => {
          if (b.empty) return <div key={b.patient.bed} className="flex h-12 items-center justify-center rounded-lg border border-dashed border-line text-xs text-faint num">{b.patient.bed}</div>;
          const st = naive ? (b.naive.status === 'red' ? 'crash' : b.naive.status === 'amber' ? 'watch' : 'calm') : b.status;
          const m = STATUS_META[st];
          const tone = TONE[m.tone];
          return (
            <button key={b.patient.bed} onClick={() => actions.openBed(b.patient.bed)} title={`Bed ${b.patient.bed}: ${m.label}`}
              className={`relative flex h-12 flex-col items-center justify-center rounded-lg border focus-ring ${tone.border} ${tone.soft} ${naive && b.naive.status === 'red' ? 'alarm-red' : ''}`}>
              <span className="num text-sm font-extrabold leading-none">{b.patient.bed}</span>
              <span className={`text-[10px] leading-none ${tone.text}`}>{m.glyph}</span>
              {!naive && b.overdue && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-faint" title="Obs overdue" />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {['crash', 'active', 'watch', 'calm'].map((s) => <span key={s}><span className={TONE[STATUS_META[s].tone].text}>{STATUS_META[s].glyph}</span> {STATUS_META[s].label}</span>)}
      </div>
    </section>
  );
}

export function MetricsStrip() {
  const { metrics, setScreen } = useWard();
  const n = metrics.naive, w = metrics.wardpulse;
  const rows = [
    { label: 'Alerts / hour', a: n.alertsPerHour.toFixed(1), b: w.alertsPerHour.toFixed(1), better: w.alertsPerHour <= n.alertsPerHour },
    { label: 'On screen now', a: n.onScreen, b: w.onScreen, better: true },
    { label: 'Events caught', a: `${n.caught}/${n.due}`, b: `${w.caught}/${w.due}`, better: w.caught >= n.caught },
    { label: 'Median warning', a: n.medianLead != null ? `${n.medianLead.toFixed(1)} h` : '—', b: w.medianLead != null ? `${w.medianLead.toFixed(1)} h` : '—', better: (w.medianLead ?? 0) >= (n.medianLead ?? 0) },
    { label: 'False alerts · Bed 3 COPD', a: n.bed3, b: w.bed3, better: w.bed3 <= n.bed3 },
  ];
  return (
    <section className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Live proof · same data</h2>
        <button className="text-xs font-semibold text-pulse hover:underline focus-ring rounded" onClick={() => setScreen('proof')}>Details →</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-muted">
            <th className="py-1 text-left font-semibold" />
            <th className="py-1 text-right font-bold text-crash">Naïve</th>
            <th className="py-1 text-right font-bold text-pulse">WardPulse</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <td className="py-1.5 text-muted">{r.label}</td>
              <td className="num py-1.5 text-right">{r.a}</td>
              <td className={`num py-1.5 text-right font-bold ${r.better ? 'text-pulse' : ''}`}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-faint">Passive replay from 08:00 to now, identical simulated data, no nurse actions. Ground-truth events: {metrics.events.map((e) => `Bed ${e.bed} at ${fmtClock(e.t).hhmm}`).join(', ')}.</p>
    </section>
  );
}
