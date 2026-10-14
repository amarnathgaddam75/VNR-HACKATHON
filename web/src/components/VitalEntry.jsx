// Quick vital entry (design doc §11.1, F11): steppers pre-filled with the last value, < 15 s per bed.
import { Bluetooth, Minus, Plus, Save, Timer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AVPU, VITALS, fmtVital } from '../config/vitals.js';
import { useWard } from '../store/WardContext.jsx';
import { Modal, TONE, TYPE_META } from './ui.jsx';

const FIELDS = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp'];
const DBP = { key: 'dbp', label: 'DBP', unit: 'mmHg', step: 2, decimals: 0, min: 20, max: 160 };

function Stepper({ k, value, onChange, changed }) {
  const def = VITALS[k] || DBP;
  const step = def.step;
  const fmt = (v) => (v == null ? '—' : Number(v).toFixed(def.decimals));
  const bump = (d) => onChange(Math.round(((value ?? (def.min + def.max) / 2) + d) * 10) / 10);
  return (
    <div className={`rounded-xl border p-2 ${changed ? 'border-pulse bg-pulse/5' : 'border-line bg-raised'}`}>
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{def.label}</span>
        <span className="text-[11px] text-faint">{def.unit}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <button className="btn-ghost h-14 w-14 !px-0 text-lg focus-ring" onClick={() => bump(-step)} aria-label={`${def.label} down`}><Minus /></button>
        <input
          className="num h-14 w-full min-w-0 rounded-lg bg-transparent text-center text-2xl font-bold focus-ring"
          inputMode="decimal" value={fmt(value)}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v); }}
          aria-label={def.label}
        />
        <button className="btn-ghost h-14 w-14 !px-0 text-lg focus-ring" onClick={() => bump(step)} aria-label={`${def.label} up`}><Plus /></button>
      </div>
    </div>
  );
}

export default function VitalEntry() {
  const { entryBed, actions, result, now } = useWard();
  const [bed, setBed] = useState(null);
  const [vals, setVals] = useState({});
  const [prefill, setPrefill] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(null);

  const suggestions = useMemo(() => {
    const order = { CRASH: 0, MEASURE: 1, ESCALATE: 2, ACTION: 3, ROUTINE: 4 };
    return result.beds.filter((b) => !b.empty).map((b) => ({ b, o: b.task ? order[b.task.type] : 9 })).sort((x, y) => x.o - y.o || x.b.patient.bed - y.b.patient.bed);
  }, [result]);

  const pick = (n) => {
    const b = result.beds.find((x) => x.patient.bed === n);
    const L = b.score.features.L;
    const v = { hr: L.hr, sbp: L.sbp, dbp: L.dbp, rr: L.rr, spo2: L.spo2, temp: L.temp, avpu: L.avpu || 'A', o2: !!L.o2 };
    setBed(n); setVals(v); setPrefill(v);
    started.current = performance.now();
  };

  useEffect(() => {
    if (!entryBed) { setBed(null); return; }
    if (entryBed.bed) pick(entryBed.bed);
    else { setBed(null); started.current = null; }
  }, [entryBed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bed) return undefined;
    const id = setInterval(() => setElapsed((performance.now() - started.current) / 1000), 100);
    return () => clearInterval(id);
  }, [bed]);

  const before = bed ? result.beds.find((x) => x.patient.bed === bed)?.score : null;

  const save = (source = 'manual') => {
    const secs = (performance.now() - started.current) / 1000;
    const vitals = { ...vals };
    for (const k of FIELDS) if (vitals[k] != null) vitals[k] = k === 'temp' ? Math.round(vitals[k] * 10) / 10 : Math.round(vitals[k]);
    actions.addVitals(bed, vitals, { source, entrySeconds: secs });
    actions.closeEntry();
  };

  return (
    <Modal open={!!entryBed} onClose={actions.closeEntry} title={bed ? `Enter vitals · Bed ${bed}` : 'Enter vitals — pick a bed'} wide>
      {!bed && (
        <div>
          <p className="mb-3 text-sm text-muted">Beds with a card come first.</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {suggestions.map(({ b }) => {
              const m = b.task ? TYPE_META[b.task.type] : null;
              return (
                <button key={b.patient.bed} onClick={() => pick(b.patient.bed)}
                  className={`tap rounded-xl border p-2 text-left focus-ring hover:bg-raised ${m ? TONE[m.tone].border : 'border-line'}`}>
                  <div className="num text-2xl font-extrabold">{b.patient.bed}</div>
                  <div className="truncate text-[11px] text-muted">{m ? m.label : b.patient.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {bed && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted">Pre-filled with last charted values — change only what you measured.</div>
            <div className={`chip num ${elapsed < 15 ? 'bg-calm/10 text-calm' : 'bg-amber/10 text-amber'}`}><Timer size={13} /> {elapsed.toFixed(1)} s / 15 s</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FIELDS.map((k) => (
              <Stepper key={k} k={k} value={vals[k]} changed={vals[k] !== prefill[k]} onChange={(v) => setVals((s) => ({ ...s, [k]: v }))} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label="AVPU">
              {AVPU.map((a) => (
                <button key={a} role="radio" aria-checked={vals.avpu === a} onClick={() => setVals((s) => ({ ...s, avpu: a }))}
                  className={`num h-12 w-12 font-bold focus-ring ${vals.avpu === a ? 'bg-ink text-panel' : 'bg-raised hover:bg-panel'}`}>{a}</button>
              ))}
            </div>
            <label className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-line bg-raised px-3 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--pulse))]" checked={vals.o2} onChange={(e) => setVals((s) => ({ ...s, o2: e.target.checked }))} />
              On oxygen
            </label>
            <button className="btn-ghost h-12 focus-ring" onClick={() => setVals((s) => ({ ...s, ...actions.device(bed) }))} title="Simulates a Bluetooth cuff / oximeter posting the true current value">
              <Bluetooth size={16} /> Read from device (sim)
            </button>
          </div>
          {before && (
            <div className="rounded-xl bg-raised p-3 text-xs text-muted">
              Current: risk <span className="num font-bold text-ink">{(before.risk * 100).toFixed(0)}%</span>,
              uncertainty <span className="num font-bold text-ink">{(before.uncertainty * 100).toFixed(0)}%</span>
              {before.uncVital && <> (driven by stale {VITALS[before.uncVital].label}, last {fmtVital(before.uncVital, before.features.L[before.uncVital])})</>}.
              Saving re-scores this bed and re-ranks the ward instantly.
            </div>
          )}
          <div className="flex justify-between gap-2">
            <button className="btn-ghost tap focus-ring" onClick={() => setBed(null)}>Change bed</button>
            <button className="btn-primary tap px-8 focus-ring" onClick={() => save()}><Save size={18} /> Save</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
