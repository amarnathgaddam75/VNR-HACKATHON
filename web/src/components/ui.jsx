import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Gauge, Hand, PhoneCall, Siren, X } from 'lucide-react';
import { useEffect } from 'react';
import { fmtAge } from '../sim/ward.js';

// Tailwind needs literal class names, so tones are spelled out.
export const TONE = {
  crash:    { text: 'text-crash',    bg: 'bg-crash',    soft: 'bg-crash/10',    border: 'border-crash/40',    bar: 'bg-crash' },
  escalate: { text: 'text-escalate', bg: 'bg-escalate', soft: 'bg-escalate/10', border: 'border-escalate/40', bar: 'bg-escalate' },
  action:   { text: 'text-action',   bg: 'bg-action',   soft: 'bg-action/10',   border: 'border-action/40',   bar: 'bg-action' },
  measure:  { text: 'text-measure',  bg: 'bg-measure',  soft: 'bg-measure/10',  border: 'border-measure/40',  bar: 'bg-measure' },
  calm:     { text: 'text-calm',     bg: 'bg-calm',     soft: 'bg-calm/10',     border: 'border-calm/40',     bar: 'bg-calm' },
  amber:    { text: 'text-amber',    bg: 'bg-amber',    soft: 'bg-amber/10',    border: 'border-amber/40',    bar: 'bg-amber' },
  muted:    { text: 'text-muted',    bg: 'bg-muted',    soft: 'bg-raised',      border: 'border-line',        bar: 'bg-faint' },
  pulse:    { text: 'text-pulse',    bg: 'bg-pulse',    soft: 'bg-pulse/10',    border: 'border-pulse/40',    bar: 'bg-pulse' },
};

export const TYPE_META = {
  CRASH:    { label: 'CRASH',          tone: 'crash',    Icon: Siren },
  ESCALATE: { label: 'ESCALATE',       tone: 'escalate', Icon: PhoneCall },
  ACTION:   { label: 'BEDSIDE ACTION', tone: 'action',   Icon: Hand },
  MEASURE:  { label: 'MEASURE',        tone: 'measure',  Icon: Gauge },
  ROUTINE:  { label: 'ROUTINE',        tone: 'muted',    Icon: Clock },
};

export function TypeBadge({ type, size = 'sm' }) {
  const m = TYPE_META[type];
  const tone = TONE[m.tone];
  return (
    <span className={`chip ${tone.soft} ${tone.text} border ${tone.border} ${size === 'lg' ? 'px-3 py-1 text-sm' : ''}`}>
      <m.Icon size={size === 'lg' ? 15 : 13} strokeWidth={2.5} aria-hidden />
      {m.label}
    </span>
  );
}

/** Data-age chip: green < 1 h, amber 1–4 h, grey > 4 h (design doc §11.2). Never colour alone. */
export function AgeChip({ label, age, compact }) {
  const fresh = age < 1, mid = age >= 1 && age <= 4;
  const tone = fresh ? 'text-calm bg-calm/10' : mid ? 'text-amber bg-amber/10' : 'text-muted bg-raised';
  const glyph = fresh ? '●' : mid ? '◐' : '○';
  return (
    <span className={`chip ${tone} ${compact ? 'px-1.5' : ''}`} title={`${label} measured ${fmtAge(age)} ago`}>
      <span aria-hidden>{glyph}</span>
      <span>{label}</span>
      <span className="num font-medium opacity-80">{Number.isFinite(age) ? fmtAge(age) : '—'}</span>
    </span>
  );
}

export const STATUS_META = {
  crash:  { label: 'Crash',       tone: 'crash',  glyph: '▲' },
  active: { label: 'Active card', tone: 'escalate', glyph: '◆' },
  watch:  { label: 'Watch',       tone: 'amber',  glyph: '◐' },
  calm:   { label: 'Calm',        tone: 'calm',   glyph: '●' },
  empty:  { label: 'Empty',       tone: 'muted',  glyph: '○' },
};

export function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.calm;
  const tone = TONE[m.tone];
  return <span className={`chip ${tone.soft} ${tone.text}`}><span aria-hidden>{m.glyph}</span>{m.label}</span>;
}

export function Modal({ open, onClose, title, children, wide, side }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className={`relative panel shadow-card w-full ${side ? 'sm:ml-auto sm:h-full sm:rounded-none sm:rounded-l-2xl max-w-3xl' : wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto scroll-thin`}
            initial={side ? { x: 60, opacity: 0 } : { y: 30, opacity: 0 }}
            animate={side ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }}
            exit={side ? { x: 60, opacity: 0 } : { y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-panel/95 backdrop-blur px-5 py-3">
              <h2 className="font-bold text-lg">{title}</h2>
              <button className="btn-ghost h-10 w-10 !px-0 focus-ring" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
            className={`pointer-events-auto rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-card bg-panel ${TONE[t.tone]?.border || 'border-line'}`}>
            <span className={TONE[t.tone]?.text}>●</span> {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Probability as a small arc gauge. */
export function RiskDial({ value, label = 'Risk', size = 76, tone }) {
  const r = size / 2 - 7;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  const auto = v >= 0.6 ? 'text-escalate' : v >= 0.3 ? 'text-amber' : 'text-calm';
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} aria-label={`${label} ${(v * 100).toFixed(0)}%`}>
        <path d={`M7 ${size / 2} A ${r} ${r} 0 0 1 ${size - 7} ${size / 2}`} fill="none" stroke="rgb(var(--line))" strokeWidth="7" strokeLinecap="round" />
        <path d={`M7 ${size / 2} A ${r} ${r} 0 0 1 ${size - 7} ${size / 2}`} fill="none" stroke="currentColor" className={tone || auto}
          strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div className="-mt-5 num text-lg font-bold leading-none">{(v * 100).toFixed(0)}<span className="text-xs text-muted">%</span></div>
      <div className="text-[11px] uppercase tracking-wide text-muted mt-0.5">{label}</div>
    </div>
  );
}

export function Kbd({ children }) {
  return <kbd className="num rounded border border-line bg-raised px-1.5 py-0.5 text-[11px] text-muted">{children}</kbd>;
}
