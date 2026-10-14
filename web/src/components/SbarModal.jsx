import { Copy, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildSbar } from '../engine/narrative.js';
import { WARD } from '../sim/scenario.js';
import { useWard } from '../store/WardContext.jsx';
import { Modal } from './ui.jsx';

// One-tap SBAR escalation (UC-6). Nurse previews before send; template-constrained.
export default function SbarModal({ task, onClose }) {
  const { actions, now } = useWard();
  const [text, setText] = useState('');
  useEffect(() => { if (task) setText(buildSbar(task, now)); }, [task]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={!!task} onClose={onClose} title={task ? `SBAR · Bed ${task.bed} → ${WARD.dutyDoctor}` : ''} wide>
      {task && (
        <div className="space-y-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9}
            className="num w-full rounded-xl border border-line bg-raised p-3 text-sm leading-relaxed focus-ring" />
          <div className="flex items-start gap-2 rounded-xl bg-pulse/10 p-3 text-xs text-muted">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-pulse" />
            Templated from the card, latest vitals and baseline. An LLM may only rephrase this through a validator
            that checks every number against source data — it can't add drugs, doses or diagnoses.
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-ghost tap focus-ring" onClick={() => navigator.clipboard?.writeText(text)}><Copy size={16} /> Copy</button>
            <button className="btn tap bg-escalate text-white hover:brightness-110 focus-ring" onClick={() => { actions.escalate(task, text); onClose(); }}>
              <Send size={16} /> Send SMS / WhatsApp (sim)
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
