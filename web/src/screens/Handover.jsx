// Shift handover (UC-7) + audit log (F17).
import { CheckCircle2, FileText, RefreshCw, ScrollText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildHandover } from '../engine/narrative.js';
import { fmtClock } from '../sim/ward.js';
import { useWard } from '../store/WardContext.jsx';

export default function Handover() {
  const { result, audit, events, now, actions, nurse } = useWard();
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const regen = () => { setText(buildHandover({ result, audit, events, now })); setDirty(false); };
  useEffect(() => { if (!dirty) regen(); }, [result, audit, events]); // eslint-disable-line react-hooks/exhaustive-deps
  const signed = events.filter((e) => e.type === 'handover');

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Shift handover</h1>
            <p className="text-sm text-muted">Auto-drafted from the audit log. Every escalation line carries its event ID. Edit, then sign off.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost h-11 focus-ring" onClick={regen}><RefreshCw size={16} /> Regenerate</button>
            <button className="btn-primary h-11 focus-ring" onClick={() => { actions.signOff(text); setDirty(false); }}><CheckCircle2 size={16} /> Sign off as {nurse}</button>
          </div>
        </div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }}
          className="num min-h-[520px] w-full rounded-2xl border border-line bg-panel p-4 text-[13px] leading-relaxed focus-ring" aria-label="Handover text" />
        {signed.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {signed.map((s) => <span key={s.id} className="chip bg-calm/10 text-calm"><FileText size={12} /> Signed {fmtClock(s.t).label} by {s.by}</span>)}
          </div>
        )}
      </section>
      <section className="panel flex max-h-[680px] flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <ScrollText size={18} className="text-muted" />
          <h2 className="font-bold">Audit log</h2>
          <span className="num ml-auto text-xs text-muted">{audit.length} entries</span>
        </div>
        <ol className="flex-1 divide-y divide-line overflow-y-auto scroll-thin">
          {audit.length === 0 && <li className="p-4 text-sm text-muted">Nothing logged yet. Press play, or act on a card.</li>}
          {audit.map((a) => (
            <li key={a.id} className="flex gap-3 px-4 py-2 text-sm">
              <span className="num w-11 shrink-0 text-muted">{fmtClock(a.t).hhmm}</span>
              <span className="num w-9 shrink-0 font-bold">{a.bed != null ? `B${a.bed}` : ''}</span>
              <span className={a.kind === 'crash' ? 'font-semibold text-crash' : ''}>{a.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
