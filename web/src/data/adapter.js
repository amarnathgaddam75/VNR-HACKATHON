// Data seam. Today: the in-browser simulator. Tomorrow: real datasets / the FastAPI backend.
//
// Plug-in points (pick one per source as the team's data lands):
//   1. Scenario JSON  → drop a file in /public/data/ward.json shaped like `exportScenario()` below
//                        and call loadWard({ source: 'json' }).
//   2. Backend API    → GET /api/ward/{id}/console etc. (design doc §12.3); vite proxies /api → :8000.
//   3. Live push      → WS /ws/ward/{id} replaces the local clock tick.
//
// Everything downstream (engine, UI) only needs: beds[] with readings, events[], and a clock.
import { buildWard } from '../sim/ward.js';

export const DATA_SOURCES = {
  sim: 'In-browser simulator (seeded, 20 scripted beds)',
  json: 'Scenario file /data/ward.json',
  api: 'FastAPI backend (/api)',
};

export async function loadWard({ source = 'sim', seed = 7 } = {}) {
  if (source === 'sim') return buildWard(seed);
  if (source === 'json') {
    const res = await fetch('/data/ward.json');
    if (!res.ok) throw new Error('No /data/ward.json yet — falling back to simulator');
    return fromScenarioJson(await res.json());
  }
  throw new Error(`Data source "${source}" not wired yet`);
}

/**
 * Convert a scenario JSON (e.g. exported from the Python simulator / sparsified PhysioNet) into the
 * shape the engine uses. Expected input:
 * {
 *   "patients": [{ "bed": 7, "name": "Ravi K.", "age": 28, "sex": "M", "type": "Post-op", "dx": "...",
 *                  "chronic": ["COPD"], "o2": false, "copdTarget": false, "admittedAt": -24 }],
 *   "readings": [{ "id": "r1", "bed": 7, "t": 17.9,   // hours relative to demo start
 *                  "vitals": { "hr": 104, "sbp": 120, "dbp": 76, "rr": 20, "spo2": 97, "temp": 37.9, "avpu": "A", "o2": false } }],
 *   "events":   [{ "bed": 7, "t": 26, "label": "Rapid-response call" }]
 * }
 * Per-vital rows (design doc §12.2 VitalReading) can be grouped by (bed, taken_at) into this shape.
 */
export function fromScenarioJson(json) {
  const byBed = new Map();
  for (const r of json.readings) {
    if (!byBed.has(r.bed)) byBed.set(r.bed, []);
    byBed.get(r.bed).push(r);
  }
  const beds = json.patients.map((p) => {
    const rs = (byBed.get(p.bed) || []).sort((a, b) => a.t - b.t);
    return {
      ...p, base: p.base || {}, chronic: p.chronic || [], admitted: p.admittedAt ?? -24,
      // Static readings: the engine reads them through `schedule` like charted rounds.
      schedule: [], fixedReadings: rs.map((r) => ({ ...r, source: r.source || 'chart' })),
    };
  });
  return { seed: 'json', t0: -24, n: 0, beds, events: json.events || [], fromJson: true };
}
