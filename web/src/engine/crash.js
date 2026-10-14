import { CRASH_RULES, CRASH_READING_MAX_AGE_H } from '../config/crashRules.js';

/** Crash rules on the latest observation set (only if recent). Returns the fired rules. */
export function crashCheck(lastObs, patient, now) {
  if (!lastObs || now - lastObs.t > CRASH_READING_MAX_AGE_H) return [];
  return CRASH_RULES.filter((r) => r.test(lastObs.vitals, patient)).map((r) => ({ id: r.id, label: r.label }));
}
