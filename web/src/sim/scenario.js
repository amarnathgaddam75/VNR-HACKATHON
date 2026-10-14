// Scripted 20-bed ward (design doc §10.3). Hour 0 = 08:00 on Day 1.
// Each bed: persona + baseline physiology + optional scripted trajectory.
// Replace / extend this once real (sparsified PhysioNet / Synthea) cohorts are ready.

export const WARD = {
  id: 'W3B',
  name: 'Ward 3B · General Medicine & Surgery',
  hospital: 'District Hospital (demo)',
  startClock: 8, // hour 0 is 08:00
  durationH: 48,
  historyH: 24, // readings exist from -24 h so baselines are ready at start
  nurses: ['Sr. Anjali', 'Sr. Deepa', 'Br. Thomas'],
  chargeNurse: 'Sr. Rekha (in-charge)',
  dutyDoctor: 'Dr. Vikram (duty RMO)',
};

// base: typical true values; noise: AR(1) innovation sd; o2: on supplemental oxygen
// copdTarget: SpO2 target 88–92 % (NEWS2 scale 2)
export const BEDS = [
  { bed: 1,  name: 'Lakshmi D.', age: 72, sex: 'F', type: 'Medical', dx: 'Heart failure', chronic: ['CHF'],
    base: { hr: 94, sbp: 106, dbp: 64, rr: 21, spo2: 94, temp: 36.8 } },
  { bed: 2,  name: 'Imran S.',   age: 45, sex: 'M', type: 'Post-op', dx: 'Inguinal hernia repair', chronic: [], postOp: true,
    base: { hr: 76, sbp: 128, dbp: 80, rr: 16, spo2: 98, temp: 36.9 } },
  { bed: 3,  name: 'Venkat R.',  age: 68, sex: 'M', type: 'Medical', dx: 'COPD exacerbation (recovering)', chronic: ['COPD'], o2: true, copdTarget: true,
    base: { hr: 88, sbp: 132, dbp: 78, rr: 22, spo2: 90, temp: 36.9 },
    story: 'Chronic "abnormal" normals — RR 22, SpO₂ 90 % every day. Naïve AI screams all shift; WardPulse stays quiet.' },
  { bed: 4,  name: 'Suresh P.',  age: 55, sex: 'M', type: 'Medical', dx: 'Urosepsis, diabetic', chronic: ['DM'],
    base: { hr: 86, sbp: 118, dbp: 74, rr: 17, spo2: 97, temp: 37.4 }, script: 'staleBp',
    story: 'Borderline BP at 18:00, then BP not charted for 7+ h. WardPulse asks for a measurement, not a panic.' },
  { bed: 5,  name: 'Fatima B.',  age: 81, sex: 'F', type: 'Medical', dx: 'CKD, fluid overload', chronic: ['CKD'],
    base: { hr: 96, sbp: 100, dbp: 58, rr: 20, spo2: 95, temp: 36.4 } },
  { bed: 6,  name: 'Arjun M.',   age: 34, sex: 'M', type: 'Post-op', dx: 'ORIF tibia', chronic: [], postOp: true,
    base: { hr: 96, sbp: 126, dbp: 78, rr: 16, spo2: 98, temp: 37.1 } },
  { bed: 7,  name: 'Ravi K.',    age: 28, sex: 'M', type: 'Post-op', dx: 'Appendectomy, POD 1', chronic: [], postOp: true, script: 'postOpDrift',
    base: { hr: 78, sbp: 124, dbp: 78, rr: 14, spo2: 98, temp: 37.0 },
    story: 'Young post-op patient sliding RR 14→20, HR 78→104. "Normal-ish" by textbook, big drift vs his own baseline.' },
  { bed: 8,  name: 'Meena T.',   age: 63, sex: 'F', type: 'Medical', dx: 'Asthma', chronic: ['Asthma'],
    base: { hr: 92, sbp: 128, dbp: 82, rr: 22, spo2: 94, temp: 36.8 } },
  { bed: 9,  name: 'Gopal N.',   age: 70, sex: 'M', type: 'Medical', dx: 'Pneumonia on O₂ 2 L', chronic: [], o2: true, script: 'cannulaSlip',
    base: { hr: 86, sbp: 118, dbp: 72, rr: 20, spo2: 96, temp: 37.8 },
    story: 'Nasal cannula slips — SpO₂ 95→91. The fix is at the bedside: check the cannula.' },
  { bed: 10, name: 'Kavya R.',   age: 24, sex: 'F', type: 'Medical', dx: 'Dengue (recovery)', chronic: [],
    base: { hr: 90, sbp: 108, dbp: 70, rr: 16, spo2: 98, temp: 37.2 } },
  { bed: 11, name: 'Rajesh G.',  age: 59, sex: 'M', type: 'Medical', dx: 'Heart failure', chronic: ['CHF'], reliable: true,
    base: { hr: 98, sbp: 112, dbp: 66, rr: 21, spo2: 93, temp: 36.7 } },
  { bed: 12, name: 'Anand V.',   age: 61, sex: 'M', type: 'Post-op', dx: 'Laparotomy, POD 2', chronic: [], postOp: true, script: 'sepsisCrash',
    base: { hr: 72, sbp: 135, dbp: 82, rr: 14, spo2: 97, temp: 36.8 },
    story: 'Gradual abdominal-sepsis drift, then BP 68 at hour 30. Crash bypass ignores the budget.' },
  { bed: 13, name: 'Sunita K.',  age: 47, sex: 'F', type: 'Post-op', dx: 'Lap. cholecystectomy', chronic: [], postOp: true, admittedAt: 16,
    base: { hr: 84, sbp: 120, dbp: 76, rr: 16, spo2: 97, temp: 37.0 },
    story: 'New admission at 00:00 with no history — cold start on NEWS2 bands and more frequent measuring.' },
  { bed: 14, name: 'Prakash J.', age: 76, sex: 'M', type: 'Medical', dx: 'COPD (on air)', chronic: ['COPD'], copdTarget: true,
    base: { hr: 90, sbp: 138, dbp: 84, rr: 23, spo2: 91, temp: 36.8 } },
  { bed: 15, name: 'Divya S.',   age: 38, sex: 'F', type: 'Medical', dx: 'Severe anaemia', chronic: [],
    base: { hr: 104, sbp: 108, dbp: 66, rr: 21, spo2: 98, temp: 36.9 } },
  { bed: 16, name: 'Harish B.',  age: 66, sex: 'M', type: 'Medical', dx: 'CKD stage 4', chronic: ['CKD'],
    base: { hr: 72, sbp: 158, dbp: 92, rr: 17, spo2: 97, temp: 36.3 } },
  { bed: 17, name: 'Nirmala P.', age: 58, sex: 'F', type: 'Medical', dx: 'Diabetic foot infection', chronic: ['DM'],
    base: { hr: 96, sbp: 124, dbp: 78, rr: 21, spo2: 97, temp: 38.1 } },
  { bed: 18, name: 'Kiran A.',   age: 31, sex: 'M', type: 'Medical', dx: 'Alcohol withdrawal', chronic: [],
    base: { hr: 108, sbp: 134, dbp: 86, rr: 21, spo2: 97, temp: 37.8 } },
  { bed: 19, name: 'Saroja M.',  age: 84, sex: 'F', type: 'Medical', dx: 'Fall, frailty', chronic: [],
    base: { hr: 60, sbp: 98, dbp: 60, rr: 18, spo2: 95, temp: 36.3 } },
  { bed: 20, name: 'Mohan L.',   age: 50, sex: 'M', type: 'Medical', dx: 'Upper GI bleed (observation)', chronic: [],
    base: { hr: 92, sbp: 110, dbp: 70, rr: 17, spo2: 98, temp: 36.8 } },
];

// Ground-truth deterioration events (what the model must catch before they happen).
export const EVENTS = [
  { bed: 9,  t: 22, label: 'Desaturation → rapid-response call', averts: 'cannula' },
  { bed: 7,  t: 26, label: 'Anastomotic leak sepsis → rapid-response call', averts: 'review' },
  { bed: 12, t: 30, label: 'Septic shock → ICU transfer', averts: 'review' },
];

// Story beats for the demo scrubber.
export const STORY_BEATS = [
  { t: 6,     label: 'Calm ward',        hint: '14:00 — quiet shift' },
  { t: 17.25, label: 'Bed 9 cannula',    hint: 'SpO₂ dips on O₂' },
  { t: 18.5,  label: 'Budget overflow',  hint: 'Bed 7 drift · Bed 4 stale BP · Bed 9' },
  { t: 26.5,  label: 'Bed 12 drifting',  hint: 'sepsis pattern building' },
  { t: 30.05, label: 'Bed 12 crash',     hint: 'BP 68 — bypass' },
];

export const DEFAULT_START_T = 18.5;

// Smooth 0→1 ramp between a and b.
const ramp = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));

// Scripted deltas added to the patient's base physiology.
// `iv` = interventions for this bed: [{ t, kind }] (kind: 'cannula' | 'review' | 'rrt').
export const SCRIPTS = {
  // Bed 7 — UC-2 personal-baseline drift, then leak sepsis at h26 unless reviewed.
  postOpDrift(t, iv) {
    let k1 = ramp(t, 14, 18);           // doc: RR 14→20, HR 78→104 over 4 h
    let k2 = ramp(t, 18, 26);           // keeps sliding if nobody acts
    const review = iv.find((x) => x.kind === 'review' || x.kind === 'rrt');
    let recover = 0;
    if (review && t > review.t + 0.5) recover = Math.min(0.75, (t - review.t - 0.5) / 5);
    if (review) k2 = Math.min(k2, ramp(review.t + 0.5, 18, 26));
    const s = 1 - recover;
    return {
      rr: s * (6 * k1 + 6 * k2), hr: s * (26 * k1 + 24 * k2), temp: s * (0.9 * k1 + 0.7 * k2),
      sbp: s * (-4 * k1 - 28 * k2), dbp: s * (-2 * k1 - 16 * k2), spo2: s * (-1 * k1 - 4 * k2),
    };
  },

  // Bed 9 — cannula slips at h16.5; worsens toward desaturation at h22 unless fixed.
  cannulaSlip(t, iv) {
    const fix = iv.find((x) => x.kind === 'cannula' || x.kind === 'review' || x.kind === 'rrt');
    const slipped = t >= 16.5 && !(fix && t >= fix.t + 0.25);
    if (!slipped) return {};
    const worse = ramp(t, 19, 22);
    return { spo2: -4 - 4 * worse, rr: 3 + 4 * worse, hr: 8 + 10 * worse };
  },

  // Bed 4 — slightly soft BP; nothing dramatic. The point is the 7 h data gap.
  staleBp(t) {
    const k = ramp(t, 8, 10);
    return { sbp: -20 * k, dbp: -10 * k, hr: 6 * k, temp: 0.2 * k };
  },

  // Bed 12 — sepsis drift from h22, crash at h30 (SBP 68, HR 140) unless reviewed early.
  sepsisCrash(t, iv) {
    const review = iv.find((x) => x.kind === 'review' && x.t < 29.5);
    const rrt = iv.find((x) => x.kind === 'rrt');
    let tt = t;
    if (review) tt = Math.min(t, review.t + 0.75); // treatment halts the slide
    let k = Math.sqrt(ramp(tt, 21, 29.5)); // front-loaded: subtle in absolute terms, big vs his baseline
    let crash = review ? 0 : ramp(tt, 29.6, 30);
    let recover = 0;
    if (review) recover = Math.min(0.8, Math.max(0, (t - review.t - 0.75) / 6));
    if (rrt && t > rrt.t + 0.25) {
      recover = Math.max(recover, Math.min(0.85, (t - rrt.t - 0.25) / 4));
      crash *= 1 - Math.min(1, (t - rrt.t) / 1.5);
    }
    const s = 1 - recover;
    return {
      hr: s * (36 * k + 32 * crash), rr: s * (10 * k + 4 * crash), temp: s * (1.6 * k),
      sbp: s * (-40 * k - 27 * crash), dbp: s * (-22 * k - 14 * crash), spo2: s * (-3 * k - 3 * crash),
      avpu: crash > 0.5 ? 'V' : k > 0.92 && !review ? 'C' : 'A',
    };
  },
};

// Extra (scripted) charting moments that guarantee the demo story lands.
export const FORCED_READINGS = {
  4: [10.0],
  7: [18.0],
  9: [16.75],
  12: [30.0],
};
// Vitals deliberately NOT charted in a window (missed obs).
export const MISSED = {
  4: [{ from: 10.2, to: 30, vitals: ['sbp', 'dbp'] }],
};
