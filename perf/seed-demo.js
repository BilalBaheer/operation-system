// Creates realistic demo inspections through the public API (same path the UI uses).
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.SEED_PASSWORD || 'LocalDemo!2026';

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await res.json()).token;
}

const call = (token, method, path, body) => fetch(`${BASE}${path}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());

const samples = [
  ['PRJ-104', 'PIER-7', '2026-09-15', 2, [['Pile cap P7-3', 'major'], ['Deck soffit', 'moderate']], 'approved'],
  ['PRJ-104', 'PIER-8', '2026-09-16', 4, [['Fender panel F-2', 'critical']], 'submitted'],
  ['PRJ-104', 'PIER-9', '2026-09-17', 5, [['Handrail', 'minor']], 'draft'],
  ['PRJ-221', 'WHARF-2', '2026-09-10', 1, [['Pile P-14 section loss', 'critical'], ['Pile P-15', 'major']], 'approved'],
  ['PRJ-221', 'WHARF-3', '2026-09-11', 3, [['Expansion joint', 'major']], 'submitted'],
  ['PRJ-221', 'BULKHEAD-A', '2026-09-12', 3, [], 'draft'],
  ['PRJ-318', 'BRIDGE-SPAN-2', '2026-09-20', 4, [['Bearing pad', 'major'], ['Girder G3', 'major']], 'submitted'],
  ['PRJ-318', 'BRIDGE-SPAN-3', '2026-09-21', 4, [['Paint coating', 'minor']], 'approved'],
  ['PRJ-318', 'ABUTMENT-N', '2026-09-22', 2, [['Scour at footing', 'moderate']], 'draft'],
];

(async () => {
  const inspector = await login('inspector@oms.local');
  const engineer = await login('engineer@oms.local');
  for (const [projectId, structureId, inspectionDate, conditionRating, f, finalStatus] of samples) {
    const rec = await call(inspector, 'POST', '/api/inspections', {
      projectId, structureId, inspectionDate, conditionRating,
      findings: f.map(([element, severity]) => ({ element, severity })),
    });
    if (finalStatus !== 'draft') await call(inspector, 'PATCH', `/api/inspections/${rec.id}/status`, { status: 'submitted' });
    if (finalStatus === 'approved') await call(engineer, 'PATCH', `/api/inspections/${rec.id}/status`, { status: 'approved' });
    console.log(`${structureId.padEnd(14)} rating ${conditionRating} -> ${rec.priority.padEnd(9)} (${finalStatus})`);
  }
})();
