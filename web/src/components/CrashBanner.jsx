// Crash bypass banner (design doc §7.4): above the budget, persists until a named nurse acknowledges.
import { motion } from 'framer-motion';
import { BellRing, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CRASH_REPAGE_SECONDS } from '../config/crashRules.js';
import { WARD } from '../sim/scenario.js';
import { useWard } from '../store/WardContext.jsx';
import { vitalsLine } from '../engine/narrative.js';
import { patientLine } from './TaskCard.jsx';

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
}

export default function CrashBanner({ crash }) {
  const { actions, nurse, crashSeen, t } = useWard();
  useTick();
  const seen = crashSeen.current.get(crash.crashId) ?? Date.now();
  const secs = Math.floor((Date.now() - seen) / 1000);
  const repaged = secs >= CRASH_REPAGE_SECONDS;
  const left = Math.max(0, CRASH_REPAGE_SECONDS - secs);
  const mmss = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      className="crash-glow relative overflow-hidden rounded-2xl bg-crash text-white"
      role="alert"
      aria-live="assertive"
    >
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 18px, rgba(255,255,255,.35) 18px 36px)' }} aria-hidden />
      <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Siren size={30} className="animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-90">{t.crash} · bypasses budget</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="num text-3xl font-extrabold">BED {crash.bed}</span>
              <span className="text-sm opacity-90">{patientLine(crash.patient)}</span>
            </div>
            <div className="mt-1 text-lg font-bold">{crash.reason}</div>
            <div className="num mt-0.5 text-sm opacity-90">{vitalsLine(crash.score.features.L)}</div>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:ml-auto lg:shrink-0 lg:items-end">
          <div className="flex items-center gap-2 text-sm font-semibold lg:max-w-[340px]">
            <BellRing size={16} />
            {repaged
              ? <span>Unacknowledged {mmss(secs)} — re-paged + {WARD.chargeNurse} alerted</span>
              : <span>{WARD.dutyDoctor} + RRT paged {mmss(secs)} ago · re-page in <span className="num">{mmss(left)}</span></span>}
          </div>
          <div className="flex flex-wrap gap-2 [&>*]:whitespace-nowrap">
            <button className="btn tap bg-white text-crash hover:bg-white/90 focus-ring" onClick={() => actions.ack(crash)}>
              {t.acknowledge} as {nurse}
            </button>
            <button className="btn tap border border-white/40 hover:bg-white/10 focus-ring" onClick={() => actions.openBed(crash.bed)}>Open bed</button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
