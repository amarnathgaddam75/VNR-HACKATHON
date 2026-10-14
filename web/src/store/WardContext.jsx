// App state: sim clock, demo mode, nurse event log, and the scored ward.
// The whole ward is recomputed as a pure function of (ward, now, events) — see engine/pipeline.js.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildWard, deviceReading } from '../sim/ward.js';
import { runWard, interventionsFrom, metricsAt } from '../engine/pipeline.js';
import { ENGINE } from '../config/engine.js';
import { DEFAULT_START_T, WARD } from '../sim/scenario.js';
import { STRINGS } from '../i18n/strings.js';

const Ctx = createContext(null);
let seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

function usePersisted(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(`wp:${key}`);
      return raw != null ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(`wp:${key}`, JSON.stringify(v)); } catch { /* private mode */ }
  }, [key, v]);
  return [v, setV];
}

export function WardProvider({ children }) {
  const ward = useMemo(() => buildWard(7), []);
  const [now, setNow] = useState(DEFAULT_START_T);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5); // sim minutes per real second
  const [mode, setMode] = useState('wardpulse');
  const [K, setK] = useState(ENGINE.K);
  const [lang, setLang] = usePersisted('lang', 'en');
  const [theme, setTheme] = usePersisted('theme', 'day');
  const [nurse, setNurse] = usePersisted('nurse', WARD.nurses[0]);
  const [events, setEvents] = useState([]);
  const [screen, setScreen] = useState('console');
  const [bedOpen, setBedOpen] = useState(null);
  const [entryBed, setEntryBed] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Sim clock
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setNow((t) => {
        const next = Math.min(WARD.durationH, t + (speed / 60) * 0.25);
        if (next >= WARD.durationH) setPlaying(false);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, speed]);

  // Score the ward. Rounded to the minute so re-renders stay cheap.
  const prevActive = useRef(new Set());
  const tMin = Math.round(now * 60) / 60;
  const result = useMemo(
    () => runWard(ward, tMin, events, { K, prevActive: prevActive.current }),
    [ward, tMin, events, K],
  );
  const metrics = useMemo(() => metricsAt(ward, tMin, { K }), [ward, tMin, K]);

  // Audit + "first seen" tracking for crash re-paging (real seconds)
  const crashSeen = useRef(new Map());
  useEffect(() => {
    const newly = result.active.filter((t) => !prevActive.current.has(t.key));
    prevActive.current = new Set(result.active.map((t) => t.key));
    const entries = [];
    for (const t of newly) entries.push({ id: uid('a'), t: tMin, kind: 'card', bed: t.bed, text: `${t.type} card shown — ${t.reason}` });
    for (const c of result.crashes) {
      if (!crashSeen.current.has(c.crashId)) {
        crashSeen.current.set(c.crashId, Date.now());
        entries.push({ id: uid('a'), t: tMin, kind: 'crash', bed: c.bed, text: `CRASH bypass — ${c.reason}. Duty doctor + RRT paged (simulated).` });
      }
    }
    if (entries.length) setAudit((a) => [...entries, ...a].slice(0, 400));
  }, [result, tMin]);

  const toast = useCallback((text, tone = 'pulse') => {
    const id = uid('t');
    setToasts((ts) => [...ts, { id, text, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  const log = useCallback((e) => {
    const ev = { id: uid('e'), t: tMin, by: nurse, ...e };
    setEvents((es) => [...es, ev]);
    setAudit((a) => [{ id: ev.id, t: ev.t, kind: e.type, bed: e.bed, text: auditText(ev) }, ...a].slice(0, 400));
    return ev;
  }, [tMin, nurse]);

  const actions = useMemo(() => ({
    complete: (task) => { log({ type: 'done', bed: task.bed, taskType: task.type, actions: task.actions, risk: task.score.risk }); toast(`Bed ${task.bed}: ${task.type.toLowerCase()} card closed`, 'calm'); },
    snooze: (task, reason, minutes) => { log({ type: 'snooze', bed: task.bed, taskType: task.type, reason, until: tMin + minutes / 60 }); toast(`Bed ${task.bed} snoozed ${minutes} min — ${reason}`, 'muted'); },
    escalate: (task, sbar) => { log({ type: 'escalate', bed: task.bed, taskType: task.type, sbar, risk: task.score.risk, actions: task.actions }); toast(`SBAR sent to ${WARD.dutyDoctor} (simulated SMS)`, 'escalate'); },
    ack: (crash) => { log({ type: 'ack', bed: crash.bed, crashId: crash.crashId }); toast(`Bed ${crash.bed} crash acknowledged by ${nurse}`, 'crash'); },
    worried: (bed) => { log({ type: 'worried', bed }); toast(`"I'm worried" on Bed ${bed} — bypass raised`, 'crash'); },
    flag: (task, note) => { log({ type: 'flag', bed: task.bed, taskType: task.type, note }); toast('Feedback logged — used to tune ranking', 'muted'); },
    addVitals: (bed, vitals, meta = {}) => log({ type: 'vitals', bed, vitals, source: meta.source || 'manual', entrySeconds: meta.entrySeconds }),
    signOff: (text) => { log({ type: 'handover', text }); toast('Handover signed off', 'calm'); },
    reset: () => { setEvents([]); setAudit([]); crashSeen.current = new Map(); setNow(DEFAULT_START_T); toast('Demo reset'); },
    device: (bed) => deviceReading(ward, ward.beds.find((b) => b.bed === bed), tMin, interventionsFrom(events.filter((e) => e.t <= tMin))),
    openBed: (bed) => setBedOpen(bed),
    closeBed: () => setBedOpen(null),
    openEntry: (bed = null) => setEntryBed({ bed }),
    closeEntry: () => setEntryBed(null),
  }), [log, toast, tMin, nurse, ward, events]);

  const t = STRINGS[lang] || STRINGS.en;
  const value = {
    ward, now: tMin, setNow, playing, setPlaying, speed, setSpeed, mode, setMode, K, setK,
    lang, setLang, theme, setTheme, nurse, setNurse, events, screen, setScreen,
    bedOpen, entryBed, toasts, audit, result, metrics, crashSeen, actions, t,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function auditText(e) {
  switch (e.type) {
    case 'done': return `${e.by} completed ${e.taskType} card [${(e.actions || []).join(', ')}]`;
    case 'snooze': return `${e.by} snoozed ${e.taskType} card — "${e.reason}"`;
    case 'escalate': return `${e.by} paged ${WARD.dutyDoctor} with SBAR`;
    case 'ack': return `${e.by} acknowledged crash banner`;
    case 'worried': return `${e.by} raised "I'm worried"`;
    case 'flag': return `${e.by} flagged card as wrong — "${e.note}"`;
    case 'vitals': return `${e.by} entered vitals (${e.source}${e.entrySeconds ? `, ${e.entrySeconds.toFixed(1)} s` : ''})`;
    case 'handover': return `${e.by} signed off shift handover`;
    default: return e.type;
  }
}

export function useWard() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWard outside WardProvider');
  return v;
}
