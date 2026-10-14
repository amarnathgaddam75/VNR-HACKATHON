// NEWS2 (Royal College of Physicians, 2017). Used for cold start and for Naïve mode.
const band = (v, rules) => {
  for (const [test, pts] of rules) if (test(v)) return pts;
  return 0;
};

export function news2Parts(v, { scale2 = false } = {}) {
  const parts = {};
  if (v.rr != null) parts.rr = band(v.rr, [[(x) => x <= 8, 3], [(x) => x <= 11, 1], [(x) => x <= 20, 0], [(x) => x <= 24, 2], [() => true, 3]]);
  if (v.spo2 != null) {
    if (!scale2) parts.spo2 = band(v.spo2, [[(x) => x <= 91, 3], [(x) => x <= 93, 2], [(x) => x <= 95, 1], [() => true, 0]]);
    else
      parts.spo2 = v.o2
        ? band(v.spo2, [[(x) => x <= 83, 3], [(x) => x <= 85, 2], [(x) => x <= 87, 1], [(x) => x <= 92, 0], [(x) => x <= 94, 1], [(x) => x <= 96, 2], [() => true, 3]])
        : band(v.spo2, [[(x) => x <= 83, 3], [(x) => x <= 85, 2], [(x) => x <= 87, 1], [() => true, 0]]);
  }
  parts.o2 = v.o2 ? 2 : 0;
  if (v.sbp != null) parts.sbp = band(v.sbp, [[(x) => x <= 90, 3], [(x) => x <= 100, 2], [(x) => x <= 110, 1], [(x) => x <= 219, 0], [() => true, 3]]);
  if (v.hr != null) parts.hr = band(v.hr, [[(x) => x <= 40, 3], [(x) => x <= 50, 1], [(x) => x <= 90, 0], [(x) => x <= 110, 1], [(x) => x <= 130, 2], [() => true, 3]]);
  parts.avpu = v.avpu && v.avpu !== 'A' ? 3 : 0;
  if (v.temp != null) parts.temp = band(v.temp, [[(x) => x <= 35, 3], [(x) => x <= 36, 1], [(x) => x <= 38, 0], [(x) => x <= 39, 1], [() => true, 2]]);
  return parts;
}

export function news2(v, opts) {
  const parts = news2Parts(v, opts);
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const maxSingle = Math.max(0, ...Object.values(parts));
  const level = total >= 7 ? 'high' : total >= 5 ? 'medium' : maxSingle >= 3 ? 'low-medium' : 'low';
  return { total, parts, maxSingle, level };
}

/**
 * Naïve AI: per-vital threshold alarms on NEWS2 scale 1 for everyone (no personal baseline,
 * no chronic targets, no staleness). red = NEWS2 ≥ 5 or any single 3; amber = NEWS2 ≥ 3 or any single 2.
 */
export function naiveStatus(latest) {
  const s = news2(latest, { scale2: false });
  const status = s.total >= 5 || s.maxSingle >= 3 ? 'red' : s.total >= 3 || s.maxSingle >= 2 ? 'amber' : 'quiet';
  const triggers = Object.entries(s.parts).filter(([, p]) => p >= 2).map(([k]) => k);
  return { status, score: s.total, triggers, parts: s.parts };
}
