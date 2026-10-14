// Task card anatomy (design doc §11.2): bed first, reason ≤ 10 words, evidence vs own baseline,
// data-age chips, ≤ 3 catalogue actions, thumb-reachable buttons. Snooze requires a reason.
import { motion, AnimatePresence } from 'framer-motion';
import { BellOff, Check, ChevronDown, Flag, Gauge, HelpCircle, PhoneCall } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { actionText } from '../config/catalogue.js';
import { VITALS } from '../config/vitals.js';
import { MODEL_INFO } from '../engine/score.js';
import { useWard } from '../store/WardContext.jsx';
import { AgeChip, TONE, TYPE_META, TypeBadge } from './ui.jsx';

const SNOOZE_REASONS = ['Patient asleep — rechecked', 'Doctor already at bedside', 'Known chronic pattern', 'Family at bedside, will recheck'];

export function patientLine(p) {
  return `${p.name}, ${p.age} ${p.sex} · ${p.type} · ${p.dx}`;
}

const TaskCard = forwardRef(function TaskCard({ task, onSbar, rank }, ref) {
  const { actions, lang, t } = useWard();
  const [why, setWhy] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const meta = TYPE_META[task.type];
  const tone = TONE[meta.tone];
  const s = task.score;
  const primary =
    task.type === 'ESCALATE' ? { label: t.pageDoctor, Icon: PhoneCall, on: () => onSbar(task), cls: 'bg-escalate text-white' }
    : task.type === 'MEASURE' ? { label: t.measureNow, Icon: Gauge, on: () => actions.openEntry(task.bed), cls: 'bg-measure text-white' }
    : { label: t.done, Icon: Check, on: () => actions.complete(task), cls: 'bg-action text-white' };
  const maxW = Math.max(...s.factors.map((f) => f.weight), 0.01);

  return (
    <motion.article
      ref={ref}
      layoutId={`bed-${task.bed}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="panel shadow-card relative overflow-hidden"
      aria-label={`Bed ${task.bed} ${meta.label}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} aria-hidden />
      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        {/* Header: bed number first — nurses think in beds */}
        <div className="flex items-start justify-between gap-3">
          <button className="text-left focus-ring rounded-lg" onClick={() => actions.openBed(task.bed)}>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Bed</span>
              <span className="num text-4xl font-extrabold leading-none">{task.bed}</span>
              {rank != null && <span className="text-xs font-semibold text-faint">#{rank}</span>}
            </div>
            <div className="mt-1 text-sm text-muted">{patientLine(task.patient)}</div>
          </button>
          <TypeBadge type={task.type} size="lg" />
        </div>

        {/* Reason line */}
        <p className="mt-3 text-xl font-bold leading-snug">{task.reason}</p>

        {/* Evidence vs personal baseline */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 num text-sm">
          {task.evidence.map((e) => (
            <span key={e.key} className={e.flagged ? `${tone.text} font-bold` : 'text-muted'}>
              {e.label} {e.value}{e.base != null && <span className="font-normal text-muted"> (base {e.base})</span>} {e.arrow}
            </span>
          ))}
        </div>

        {/* Data-age chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint mr-1">{t.dataAge}</span>
          {['hr', 'sbp', 'rr', 'spo2', 'temp'].map((k) => (
            <AgeChip key={k} label={k === 'sbp' ? 'BP' : VITALS[k].label} age={s.staleness[k].age} compact />
          ))}
        </div>

        {/* DO NOW — closed-set catalogue actions */}
        <div className={`mt-4 rounded-xl ${tone.soft} p-3`}>
          <div className={`text-[11px] font-extrabold uppercase tracking-widest ${tone.text}`}>{t.doNow}</div>
          <ol className="mt-1.5 space-y-1">
            {task.actions.map((c, i) => (
              <li key={c} className="flex gap-2 text-[15px] font-semibold">
                <span className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.bg} text-white text-xs`}>{i + 1}</span>
                <span>{actionText(c, lang)} <span className="num text-[11px] font-normal text-faint">{c}</span></span>
              </li>
            ))}
          </ol>
        </div>

        {/* Buttons */}
        <div className="mt-4 flex flex-wrap gap-2 [&>*]:whitespace-nowrap">
          <button className={`btn tap ${primary.cls} hover:brightness-110 focus-ring basis-full sm:basis-auto sm:flex-[2]`} onClick={primary.on}>
            <primary.Icon size={18} /> {primary.label}
          </button>
          {task.type !== 'ACTION' && (
            <button className="btn-ghost tap flex-1 !px-3 focus-ring" onClick={() => actions.complete(task)}><Check size={18} /> {t.done}</button>
          )}
          {task.type === 'ACTION' && (
            <button className="btn-ghost tap flex-1 !px-3 focus-ring" onClick={() => onSbar(task)}><PhoneCall size={18} /> {t.pageDoctor}</button>
          )}
          <div className="relative flex-1">
            <button className="btn-ghost tap w-full !px-3 focus-ring" onClick={() => setSnoozeOpen((v) => !v)} aria-expanded={snoozeOpen}>
              <BellOff size={18} /> {t.snooze} <ChevronDown size={14} />
            </button>
            <AnimatePresence>
              {snoozeOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute bottom-full left-0 z-20 mb-2 w-72 panel shadow-card p-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted">Reason required (logged)</div>
                  {SNOOZE_REASONS.map((r) => (
                    <div key={r} className="flex items-center gap-1">
                      <span className="flex-1 px-2 py-1.5 text-sm">{r}</span>
                      {[15, 30, 60].map((m) => (
                        <button key={m} className="num rounded-lg border border-line px-2 py-1 text-xs hover:bg-raised focus-ring"
                          onClick={() => { setSnoozeOpen(false); actions.snooze(task, r, m); }}>{m}m</button>
                      ))}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className={`btn-ghost tap flex-1 !px-3 focus-ring ${why ? '!bg-raised' : ''}`} onClick={() => setWhy((v) => !v)} aria-expanded={why}>
            <HelpCircle size={18} /> {t.why}
          </button>
        </div>

        {/* Why this card — top contributing factors (SHAP-like) */}
        <AnimatePresence initial={false}>
          {why && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-4 border-t border-line pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-muted">Why this card</div>
                  <div className="num text-xs text-muted">risk {(s.risk * 100).toFixed(0)}% · uncertainty {(s.uncertainty * 100).toFixed(0)}% · prio {task.priority.toFixed(2)}</div>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {s.factors.map((f) => (
                    <li key={f.key} className="flex items-center gap-3 text-sm">
                      <span className="w-56 shrink-0 truncate">{f.phrase}</span>
                      <span className="h-2 flex-1 rounded-full bg-raised">
                        <span className={`block h-2 rounded-full ${f.stale ? 'bg-measure' : tone.bar}`} style={{ width: `${Math.min(100, (f.weight / maxW) * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
                  <span>{s.coldStart ? 'Cold start: NEWS2 bands until 3+ readings' : 'Personal 24 h baseline'} · {MODEL_INFO.name}</span>
                  <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-raised text-muted disabled:opacity-50 focus-ring"
                    disabled={flagged} onClick={() => { setFlagged(true); actions.flag(task, 'Nurse judged card not useful'); }}>
                    <Flag size={13} /> {flagged ? 'Flagged' : 'Flag as wrong'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
});

export default TaskCard;
