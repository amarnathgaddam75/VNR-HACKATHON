// Tunable engine parameters. Hand-tuned on the simulated ward (design doc §7.2).
export const ENGINE = {
  K: 2,                         // attention budget: max active cards
  riskHigh: 0.6,                // ESCALATE threshold
  riskFixableCeiling: 0.85,     // below this, a fixable bedside driver (e.g. SpO₂ falling on O₂) → ACTION first
  riskModerate: 0.3,            // BEDSIDE ACTION threshold
  uncertaintyHigh: 0.15,        // MEASURE threshold
  baselineWindowH: 24,
  baselineGapH: 4,             // baseline window ends this long before now
  baselineMinReadings: 3,
  slopeWindowH: 6,
  expectedIntervalH: { high: 1, moderate: 4, stable: 6, coldStart: 2 },
  cooldownH: 0.75,              // recently_handled suppression (45 min)
  cooldownBreakRisk: 0.15,      // ...unless risk jumps this much
  hysteresis: 0.08,             // standby must beat an active card by this margin
  minActivePriority: 0.08,      // below this a candidate waits in standby even if a slot is free
  weights: { risk: 1.0, voi: 1.4, trend: 0.25, minutes: 0.01, recent: 0.5 },
  typeBonus: { ESCALATE: 0.2, ACTION: 0.1, MEASURE: 0.05, ROUTINE: 0 },
  wardTickH: 0.25,              // 15-minute ward re-score
};
