// Demo protocol corpus for the Protocol Assistant (design doc §8.3).
// PLACEHOLDER TEXT written for the demo — replace with the hospital's own SOPs and the RCP NEWS2 chart.
// Deliberately contains no drug names or doses: the assistant must never introduce them.
export const PROTOCOLS = [
  { id: 'NEWS2-1', source: 'NEWS2 escalation (demo SOP)', section: '§1 Scoring',
    text: 'NEWS2 scores six parameters: respiration rate, oxygen saturation, systolic blood pressure, pulse rate, level of consciousness or new confusion, and temperature, plus 2 points if the patient is on supplemental oxygen. A score of 3 in any single parameter is a red score.' },
  { id: 'NEWS2-2', source: 'NEWS2 escalation (demo SOP)', section: '§2 Response thresholds',
    text: 'Aggregate score 0–4: ward-based response, minimum 12-hourly observations (4–6 hourly if score 1–4). A single red score of 3: urgent ward-based response, inform the registered nurse and doctor. Score 5–6: urgent response, at least hourly observations, urgent review by a clinician. Score 7 or more: emergency response, continuous monitoring, call the critical care outreach or rapid response team.' },
  { id: 'NEWS2-3', source: 'NEWS2 escalation (demo SOP)', section: '§3 Scale 2 (hypercapnic patients)',
    text: 'For patients with confirmed hypercapnic respiratory failure, such as some COPD patients, a prescribed target saturation of 88–92% applies and SpO2 Scale 2 is used. Scale 2 must be documented by a doctor. Do not escalate solely because saturation sits within the prescribed 88–92% range.' },
  { id: 'SEP-1', source: 'Sepsis recognition (demo SOP)', section: '§1 Screening',
    text: 'Suspect sepsis in any patient with signs of infection who looks unwell or has a raised early-warning score. Red flags include new confusion, systolic BP 90 mmHg or below, heart rate above 130, respiratory rate 25 or above, needing oxygen to keep saturation 92% or more, non-blanching rash, and not passing urine in 18 hours.' },
  { id: 'SEP-3', source: 'Sepsis recognition (demo SOP)', section: '§3 Escalation',
    text: 'If a sepsis red flag is present, inform the duty doctor immediately and document the time. The doctor should review within 15 minutes for a red flag. The nurse continues hourly observations, starts a fluid balance chart and prepares for blood cultures and lactate as requested by the doctor.' },
  { id: 'OXY-1', source: 'Oxygen therapy (demo SOP)', section: '§1 Falling saturation on oxygen',
    text: 'If saturation falls in a patient already on oxygen, first check the delivery system at the bedside: cannula or mask position, tubing connection, flowmeter setting and oxygen supply. Sit the patient upright if possible. Recheck saturation after 5 minutes. If saturation remains below target, inform the doctor.' },
  { id: 'OXY-2', source: 'Oxygen therapy (demo SOP)', section: '§2 Targets',
    text: 'Target saturation is 94–98% for most adult patients and 88–92% for patients at risk of hypercapnic respiratory failure. Oxygen is prescribed with a target range, and changes in flow should follow the prescription and the doctor\'s instruction.' },
  { id: 'OBS-1', source: 'Observation frequency (demo SOP)', section: '§1 Minimum frequency',
    text: 'Post-operative patients: observations every 30 minutes for 2 hours, hourly for 4 hours, then 4-hourly for 24 hours if stable. Stable medical patients: at least 6-hourly. Any patient with an elevated early-warning score: increase to at least hourly until reviewed.' },
  { id: 'OBS-2', source: 'Observation frequency (demo SOP)', section: '§2 Missed observations',
    text: 'If a set of observations is missed or incomplete, record the reason. A blood pressure that cannot be obtained with one cuff should be repeated manually on the other arm with a correctly sized cuff before being recorded as abnormal.' },
  { id: 'FLU-1', source: 'Fluid balance (demo SOP)', section: '§1 Charting',
    text: 'Start a fluid balance chart for any patient with suspected sepsis, hypotension, reduced urine output, or on intravenous fluids. Record all intake and output hourly when the patient is unwell. Report urine output below 0.5 mL/kg/hour for 2 consecutive hours to the doctor.' },
  { id: 'RRT-1', source: 'Rapid response (demo SOP)', section: '§1 Calling the team',
    text: 'Call the rapid response team immediately for: acute airway threat, respiratory rate 8 or below or 35 or above, saturation below 85% despite oxygen, systolic BP below 80 mmHg, heart rate 40 or below or 140 or above, sudden fall in consciousness, or any time the nurse is seriously worried about the patient.' },
  { id: 'ESC-1', source: 'Escalation & communication (demo SOP)', section: '§1 SBAR',
    text: 'Use SBAR when escalating: Situation (who, where, what is wrong now), Background (diagnosis, relevant history), Assessment (latest vital signs, trend, early-warning score) and Recommendation (what you need, by when). Document the call time and the response.' },
];

const STOP = new Set('a an the of to in is for and or if what when do i how my on with be at by as it are should does patient patients'.split(' '));
const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9₂%. ]/g, ' ').replace(/spo2|spo₂|sats?|saturation/g, 'saturation').split(/\s+/).filter((w) => w && !STOP.has(w));

// BM25-lite keyword retrieval. Swap for hybrid BM25 + multilingual embeddings (bge-m3) on the backend.
const docs = PROTOCOLS.map((p) => ({ ...p, toks: tokens(`${p.section} ${p.text}`) }));
const avgLen = docs.reduce((a, d) => a + d.toks.length, 0) / docs.length;
const df = new Map();
for (const d of docs) for (const w of new Set(d.toks)) df.set(w, (df.get(w) || 0) + 1);

export function searchProtocols(query, k = 3) {
  const q = tokens(query);
  const scored = docs.map((d) => {
    let s = 0;
    for (const w of q) {
      const tf = d.toks.filter((x) => x === w || (w.length > 4 && x.startsWith(w.slice(0, 5)))).length;
      if (!tf) continue;
      const idf = Math.log(1 + (docs.length - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5));
      s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.toks.length / avgLen))));
    }
    return { doc: d, score: s };
  });
  return scored.filter((x) => x.score > 1.2).sort((a, b) => b.score - a.score).slice(0, k);
}

/** "Answer only from retrieved text, cite, refuse otherwise." Extractive, so it cannot hallucinate. */
const BANNED = /\b(dose|doses|dosage|mg|mcg|units?|ml\/h|drug|medicine|medication|tablet|inject\w*|start\w* (?:on )?\w+(?:aline|amine|cillin|mycin|olol|pril|sartan))\b|noradrenaline|norepinephrine|adrenaline|dopamine|antibiotic|paracetamol|insulin|furosemide|morphine/i;

export function answerFromProtocols(query) {
  if (BANNED.test(query)) return { answer: null, hits: [], banned: true };
  const hits = searchProtocols(query);
  if (!hits.length) return { answer: null, hits: [] };
  const qt = new Set(tokens(query));
  const sentences = hits.flatMap((h) =>
    h.doc.text.split(/(?<=\.)\s+/).map((s) => ({ s, id: h.doc.id, score: tokens(s).filter((w) => qt.has(w)).length + h.score / 10 })),
  );
  const best = sentences.sort((a, b) => b.score - a.score).slice(0, 3);
  return { answer: best, hits };
}
