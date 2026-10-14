// Crash rules (design doc §6.4). Deterministic, run BEFORE the model.
// Illustrative thresholds — must be signed off by the hospital's clinicians.
// Kept as data, not code, so the backend can load the same file.
export const CRASH_RULES = [
  { id: 'SBP_LOW',  label: 'SBP < 80 mmHg',     test: (v) => v.sbp != null && v.sbp < 80 },
  { id: 'MAP_LOW',  label: 'MAP < 60 mmHg',     test: (v) => v.sbp != null && v.dbp != null && (v.sbp + 2 * v.dbp) / 3 < 60 },
  { id: 'SPO2_LOW', label: 'SpO₂ < 85%',        test: (v, p) => v.spo2 != null && v.spo2 < (p.copdTarget ? 80 : 85) },
  { id: 'RR_EXT',   label: 'RR ≤ 8 or ≥ 35',    test: (v) => v.rr != null && (v.rr <= 8 || v.rr >= 35) },
  { id: 'HR_EXT',   label: 'HR ≤ 40 or ≥ 140',  test: (v) => v.hr != null && (v.hr <= 40 || v.hr >= 140) },
  { id: 'AVPU_PU',  label: 'New AVPU = P or U', test: (v) => v.avpu === 'P' || v.avpu === 'U' },
];

// Crash readings older than this no longer trigger (a newer reading supersedes them anyway).
export const CRASH_READING_MAX_AGE_H = 2;
// Unacknowledged crash → re-page + charge nurse after this many real seconds.
export const CRASH_REPAGE_SECONDS = 120;
