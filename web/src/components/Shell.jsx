import { motion } from 'framer-motion';
import {
  BarChart3, BookOpen, ClipboardList, Cpu, LayoutDashboard, Map, Moon, Pause, PenLine, Play, RotateCcw, Sun,
} from 'lucide-react';
import { LANGS } from '../i18n/strings.js';
import { EVENTS, STORY_BEATS, WARD } from '../sim/scenario.js';
import { fmtClock } from '../sim/ward.js';
import { useWard } from '../store/WardContext.jsx';

export function Logo({ compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-pulse text-white shadow-card">
        <svg viewBox="0 0 40 24" width="30" height="18" aria-hidden>
          <path className="ecg-line" d="M0 13 H9 L12 6 L16 20 L20 2 L24 16 L27 13 H40" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-extrabold tracking-tight">Ward<span className="text-pulse">Pulse</span></div>
          <div className="text-[11px] font-medium text-muted">Nurse Attention Allocator</div>
        </div>
      )}
    </div>
  );
}

export function ModeToggle() {
  const { mode, setMode } = useWard();
  const opts = [
    { id: 'naive', label: 'Naïve AI', sub: 'threshold alarms' },
    { id: 'wardpulse', label: 'WardPulse', sub: 'K-card budget' },
  ];
  return (
    <div className="relative flex rounded-2xl border border-line bg-raised p-1" role="radiogroup" aria-label="Demo mode">
      {opts.map((o) => (
        <button key={o.id} role="radio" aria-checked={mode === o.id} onClick={() => setMode(o.id)}
          className="relative z-10 rounded-xl px-3 py-1.5 text-left focus-ring sm:px-4">
          {mode === o.id && (
            <motion.span layoutId="mode-pill" className={`absolute inset-0 -z-10 rounded-xl shadow-card ${o.id === 'naive' ? 'bg-crash' : 'bg-pulse'}`} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
          )}
          <div className={`text-sm font-extrabold ${mode === o.id ? 'text-white' : ''}`}>{o.label}</div>
          <div className={`hidden text-[10px] sm:block ${mode === o.id ? 'text-white/80' : 'text-muted'}`}>{o.sub}</div>
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { now, playing, setPlaying, speed, setSpeed, lang, setLang, theme, setTheme, nurse, setNurse, K, setK } = useWard();
  const clk = fmtClock(now);
  const night = clk.hhmm >= '20:00' || clk.hhmm < '08:00';
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6">
        <Logo />
        <div className="hidden xl:block border-l border-line pl-4 text-xs text-muted">
          <div className="font-semibold text-ink">{WARD.name}</div>
          <div>{WARD.hospital}</div>
        </div>
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:flex sm:justify-center"><ModeToggle /></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-line bg-raised p-1">
            <button className="btn h-10 w-10 !px-0 bg-panel border border-line focus-ring" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause replay' : 'Play replay'}>
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <div className="px-2 text-right leading-tight">
              <div className="num text-lg font-bold">{clk.hhmm}</div>
              <div className="text-[10px] text-muted">Day {clk.day} · {night ? 'night' : 'day'} shift</div>
            </div>
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)} className="num h-10 rounded-lg border border-line bg-panel px-1 text-xs focus-ring" aria-label="Replay speed">
              <option value={1}>60×</option>
              <option value={5}>300×</option>
              <option value={15}>900×</option>
              <option value={30}>1800×</option>
            </select>
          </div>
          <div className="hidden items-center gap-1 rounded-xl border border-line bg-raised px-2 py-1 md:flex" title="Attention budget: max active cards">
            <span className="text-[11px] font-bold text-muted">K</span>
            {[1, 2, 3].map((k) => (
              <button key={k} onClick={() => setK(k)} className={`num h-7 w-7 rounded-lg text-sm font-bold focus-ring ${K === k ? 'bg-ink text-panel' : 'hover:bg-panel'}`}>{k}</button>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-line md:flex">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)} className={`h-9 px-2.5 text-sm font-bold focus-ring ${lang === l.id ? 'bg-ink text-panel' : 'bg-raised hover:bg-panel'}`}>{l.label}</button>
            ))}
          </div>
          <button className="btn-ghost h-10 w-10 !px-0 focus-ring" onClick={() => setTheme(theme === 'day' ? 'night' : 'day')} aria-label="Toggle day / night shift theme">
            {theme === 'day' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <select value={nurse} onChange={(e) => setNurse(e.target.value)} className="hidden h-10 rounded-xl border border-line bg-raised px-2 text-sm font-semibold lg:block focus-ring" aria-label="Signed-in nurse">
            {WARD.nurses.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </header>
  );
}

export const NAV = [
  { id: 'console', key: 'console', Icon: LayoutDashboard },
  { id: 'map', key: 'wardMap', Icon: Map },
  { id: 'handover', key: 'handover', Icon: ClipboardList },
  { id: 'assistant', key: 'protocol', Icon: BookOpen },
  { id: 'proof', key: 'proof', Icon: BarChart3 },
  { id: 'engine', key: 'engine', Icon: Cpu },
];

export function NavRail() {
  const { screen, setScreen, actions, t, result, mode } = useWard();
  const badge = { console: mode === 'wardpulse' ? result.active.length + result.crashes.length : null };
  return (
    <nav className="hidden w-[92px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-4 md:flex" aria-label="Screens">
      {NAV.map(({ id, key, Icon }) => (
        <button key={id} onClick={() => setScreen(id)} aria-current={screen === id ? 'page' : undefined}
          className={`relative flex w-[76px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold focus-ring ${screen === id ? 'bg-pulse/10 text-pulse' : 'text-muted hover:bg-raised'}`}>
          <Icon size={21} />
          <span className="text-center leading-tight">{t[key]}</span>
          {badge[id] ? <span className="num absolute right-2 top-1.5 rounded-full bg-escalate px-1.5 text-[10px] text-white">{badge[id]}</span> : null}
        </button>
      ))}
      <div className="mt-auto flex flex-col items-center gap-1">
        <button onClick={() => actions.openEntry()} className="flex w-[76px] flex-col items-center gap-1 rounded-xl bg-pulse py-3 text-[11px] font-bold text-white focus-ring">
          <PenLine size={21} /> <span className="leading-tight">{t.enterVitals}</span>
        </button>
        <button onClick={actions.reset} className="flex w-[76px] flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold text-muted hover:bg-raised focus-ring">
          <RotateCcw size={16} /> Reset demo
        </button>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const { screen, setScreen, actions, t } = useWard();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-panel md:hidden" aria-label="Screens">
      {NAV.filter((n) => n.id !== 'engine').slice(0, 2).concat([{ id: '_entry' }], NAV.filter((n) => ['handover', 'proof'].includes(n.id))).map((n) =>
        n.id === '_entry' ? (
          <button key="entry" onClick={() => actions.openEntry()} className="flex flex-col items-center justify-center gap-0.5 bg-pulse py-2 text-[10px] font-bold text-white"><PenLine size={20} />{t.enterVitals}</button>
        ) : (
          <button key={n.id} onClick={() => setScreen(n.id)} className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold ${screen === n.id ? 'text-pulse' : 'text-muted'}`}>
            <n.Icon size={20} />{t[n.key]}
          </button>
        ))}
    </nav>
  );
}

/** Replay timeline: scrub 48 h, jump to story beats; ground-truth events marked for judges. */
export function Timeline() {
  const { now, setNow, setPlaying } = useWard();
  const D = WARD.durationH;
  const pct = (t) => `${(t / D) * 100}%`;
  return (
    <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-line bg-panel/95 backdrop-blur md:bottom-0 md:left-[92px]">
      <div className="flex items-center gap-3 px-4 py-2 lg:px-6">
        <div className="hidden shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted lg:block">Replay</div>
        <div className="relative h-11 flex-1">
          {/* track */}
          <div className="absolute inset-x-0 top-[18px] h-1.5 rounded-full bg-raised" />
          <div className="absolute left-0 top-[18px] h-1.5 rounded-full bg-pulse/60" style={{ width: pct(now) }} />
          {/* night shading */}
          {[[12, 24], [36, 48]].map(([a, b]) => (
            <div key={a} className="absolute top-[14px] h-[14px] rounded bg-ink/5" style={{ left: pct(a), width: pct(b - a) }} title="Night shift" />
          ))}
          {/* 4-hour ticks */}
          {Array.from({ length: D / 4 + 1 }, (_, i) => i * 4).map((t) => (
            <div key={t} className={`absolute top-[30px] -translate-x-1/2 num text-[9px] text-faint ${t % 8 ? 'hidden lg:block' : 'hidden sm:block'}`} style={{ left: pct(t) }}>{fmtClock(t).hhmm}</div>
          ))}
          {/* ground-truth events */}
          {EVENTS.map((e) => (
            <div key={e.bed} className="absolute top-[13px] h-3 w-3 -translate-x-1/2 rotate-45 border-2 border-crash bg-panel" style={{ left: pct(e.t) }} title={`Ground truth: Bed ${e.bed} — ${e.label}`} />
          ))}
          {/* story beats */}
          {STORY_BEATS.map((b) => (
            <button key={b.t} onClick={() => { setPlaying(false); setNow(b.t); }}
              className="group absolute -top-0.5 z-10 -translate-x-1/2 focus-ring rounded" style={{ left: pct(b.t) }} title={`${b.label} — ${b.hint}`}>
              <span className="block h-2.5 w-2.5 rounded-full border-2 border-pulse bg-panel group-hover:bg-pulse" />
            </button>
          ))}
          <input type="range" min={0} max={D} step={0.25} value={now}
            onChange={(e) => { setPlaying(false); setNow(+e.target.value); }}
            className="absolute inset-x-0 top-[10px] h-6 w-full cursor-pointer opacity-0" aria-label="Replay time" />
          <div className="pointer-events-none absolute top-[12px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-panel bg-pulse shadow-card" style={{ left: pct(now) }} />
        </div>
        <div className="hidden max-w-[45%] gap-1 overflow-x-auto scroll-thin xl:flex">
          {STORY_BEATS.map((b) => (
            <button key={b.t} onClick={() => { setPlaying(false); setNow(b.t); }}
              className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold focus-ring ${Math.abs(now - b.t) < 0.2 ? 'border-pulse bg-pulse/10 text-pulse' : 'border-line hover:bg-raised'}`}>
              <span className="num text-faint">{fmtClock(b.t).hhmm}</span> {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
