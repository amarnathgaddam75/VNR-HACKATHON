// Protocol Assistant (design doc §8.3, F16). Answers ONLY from retrieved protocol text, with
// citations; says "not in protocol" otherwise. Extractive today → swap for RAG + LLM on the backend.
import { BookOpen, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { PROTOCOLS, answerFromProtocols } from '../data/protocols.js';

const SUGGESTED = [
  'What does the protocol say for suspected sepsis?',
  'SpO2 falling on oxygen — what do I check?',
  'When do I call the rapid response team?',
  'COPD patient with saturation 89% — escalate?',
  'How often should I do obs after surgery?',
  'What dose of noradrenaline should I start?',
];

export default function Assistant() {
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]);
  const ask = (text) => {
    const query = (text ?? q).trim();
    if (!query) return;
    const res = answerFromProtocols(query);
    setThread((t) => [{ q: query, ...res, id: Date.now() }, ...t]);
    setQ('');
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Protocol assistant</h1>
          <p className="text-sm text-muted">Answers come only from the hospital's SOPs, with the section cited. No drugs, no doses, no diagnoses.</p>
        </div>
        <form className="panel flex items-center gap-2 p-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <Search size={20} className="ml-2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a protocol…" className="h-12 flex-1 bg-transparent text-base outline-none" aria-label="Question" />
          <button className="btn-primary h-12 focus-ring">Ask</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-panel px-3 py-1.5 text-sm hover:bg-raised focus-ring">{s}</button>)}
        </div>
        <div className="space-y-3">
          {thread.map((m) => (
            <article key={m.id} className="panel p-4">
              <div className="text-sm font-bold">{m.q}</div>
              {m.answer ? (
                <>
                  <ul className="mt-2 space-y-1.5 text-[15px]">
                    {m.answer.map((a) => <li key={a.s}>{a.s} <sup className="num rounded bg-pulse/10 px-1 text-[10px] font-bold text-pulse">{a.id}</sup></li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.hits.map((h) => <span key={h.doc.id} className="chip border border-line bg-raised text-muted"><BookOpen size={12} />{h.doc.source} {h.doc.section}</span>)}
                  </div>
                </>
              ) : (
                <p className="mt-2 rounded-xl bg-amber/10 p-3 text-sm font-semibold text-amber">
                  {m.banned
                    ? 'WardPulse never gives drug, dose or prescribing advice. Please ask the duty doctor or pharmacist.'
                    : "Not in protocol. I can only answer from the hospital's SOPs — please ask the duty doctor."}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
      <aside className="space-y-3">
        <div className="panel p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-bold"><ShieldCheck size={16} className="text-pulse" /> Guardrails</div>
          <ul className="space-y-1 text-muted">
            <li>• Retrieval-only answers with section citations</li>
            <li>• Refuses when nothing relevant is retrieved</li>
            <li>• Never generates drug names, doses or diagnoses</li>
            <li>• Backend plan: hybrid BM25 + bge-m3 → FAISS → re-rank → LLM with citations</li>
          </ul>
        </div>
        <div className="panel p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Corpus ({PROTOCOLS.length} chunks · demo text)</div>
          <ul className="space-y-1 text-sm">
            {PROTOCOLS.map((p) => <li key={p.id}><span className="num text-xs font-bold text-pulse">{p.id}</span> {p.source} {p.section}</li>)}
          </ul>
        </div>
      </aside>
    </div>
  );
}
