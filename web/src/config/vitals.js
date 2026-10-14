// Vital-sign definitions shared by the simulator, engine and UI.
// `floor` = clinical minimum spread used for drift z-scores (design doc §6.1).
// `bad`   = clinically bad direction: drift only counts this way.
export const VITALS = {
  hr:   { key: 'hr',   label: 'HR',   name: 'Heart rate',  unit: 'bpm',  floor: 5,   bad: 'up',   step: 1,   min: 20, max: 220, decimals: 0 },
  sbp:  { key: 'sbp',  label: 'SBP',  name: 'Systolic BP', unit: 'mmHg', floor: 8,   bad: 'down', step: 2,   min: 40, max: 260, decimals: 0 },
  rr:   { key: 'rr',   label: 'RR',   name: 'Resp. rate',  unit: '/min', floor: 2,   bad: 'up',   step: 1,   min: 4,  max: 60,  decimals: 0 },
  spo2: { key: 'spo2', label: 'SpO₂', name: 'SpO₂',        unit: '%',    floor: 1,   bad: 'down', step: 1,   min: 60, max: 100, decimals: 0 },
  temp: { key: 'temp', label: 'Temp', name: 'Temperature', unit: '°C',   floor: 0.3, bad: 'both', step: 0.1, min: 33, max: 42,  decimals: 1 },
};

// Numeric vitals that get a personal baseline and drift score.
export const SCORED_VITALS = ['hr', 'sbp', 'rr', 'spo2', 'temp'];

// Vitals whose staleness drives MEASURE cards (value of information).
export const KEY_VITALS = ['sbp', 'rr', 'spo2', 'hr'];

export const AVPU = ['A', 'C', 'V', 'P', 'U']; // C = new confusion (NEWS2 "ACVPU")

export function fmtVital(key, v) {
  if (v == null || Number.isNaN(v)) return '—';
  const d = VITALS[key]?.decimals ?? 0;
  return Number(v).toFixed(d);
}
