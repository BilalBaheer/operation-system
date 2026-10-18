// Acceptance tests for the OMS inspection module (v1.1.0).
// Runs against the live system through the gateway, written as Given / When / Then.
const jwt = require('../inspection-service/node_modules/jsonwebtoken');
const { Client } = require('../inspection-service/node_modules/pg');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PW = process.env.SEED_PASSWORD || 'LocalDemo!2026';
const results = [];

async function call(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* not JSON */ }
  return { status: r.status, data };
}
const login = async (who) => (await call('POST', '/api/auth/login', { email: `${who}@oms.local`, password: PW })).data.token;

async function test(id, req, given, when, then, fn) {
  let ok = false, detail = '';
  try { const r = await fn(); ok = r.ok; detail = r.detail; } catch (e) { detail = 'error: ' + e.message; }
  results.push({ id, req, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} [${req}]`);
  console.log(`      Given ${given}`);
  console.log(`      When  ${when}`);
  console.log(`      Then  ${then}`);
  console.log(`      -> ${detail}\n`);
}

const good = (extra = {}) => ({
  projectId: 'PRJ-ACC', structureId: 'WHARF-7', inspectionDate: '2026-10-10', conditionRating: 4,
  findings: [{ element: 'Mooring bollard', severity: 'critical' }], ...extra,
});

(async () => {
  console.log(`Acceptance tests against ${BASE}  (${new Date().toISOString()})\n`);
  const insp = await login('inspector'), eng = await login('engineer'), mgr = await login('manager');
  let draftId, approvedId;

  await test('AT-01', 'FR-08', 'a seeded inspector account', 'the inspector logs in with the right password',
    'a token is returned that carries the inspector role', async () => {
      const r = await call('POST', '/api/auth/login', { email: 'inspector@oms.local', password: PW });
      const role = jwt.decode(r.data.token).role;
      return { ok: r.status === 200 && role === 'inspector', detail: `HTTP ${r.status}, role=${role}` };
    });

  await test('AT-02', 'FR-08, NFR-03', 'one unknown email and one wrong password', 'both try to log in',
    'both get the exact same 401 message', async () => {
      const a = await call('POST', '/api/auth/login', { email: 'nobody@oms.local', password: PW });
      const b = await call('POST', '/api/auth/login', { email: 'inspector@oms.local', password: 'wrong' });
      return { ok: a.status === 401 && b.status === 401 && JSON.stringify(a.data) === JSON.stringify(b.data),
        detail: `HTTP ${a.status} / ${b.status}, message "${a.data.error}"` };
    });

  await test('AT-03', 'FR-02', 'an inspection with no project, rating 7, and a future date', 'the inspector saves it',
    'it is rejected with 400 and every problem is listed at once', async () => {
      const r = await call('POST', '/api/inspections', good({ projectId: '', conditionRating: 7, inspectionDate: '2099-01-01' }), insp);
      return { ok: r.status === 400 && r.data.errors.length >= 3, detail: `HTTP ${r.status}, ${r.data.errors.length} problems: ${r.data.errors.join('; ')}` };
    });

  await test('AT-04', 'FR-01, FR-03', 'a structure rated 4 (Satisfactory) with one critical finding', 'the inspector saves it',
    'it is saved as a draft with priority IMMEDIATE', async () => {
      const r = await call('POST', '/api/inspections', good(), insp);
      draftId = r.data.id;
      return { ok: r.status === 201 && r.data.status === 'draft' && r.data.priority === 'IMMEDIATE',
        detail: `HTTP ${r.status}, status=${r.data.status}, priority=${r.data.priority}` };
    });

  await test('AT-05', 'FR-04', 'inspections with different priorities in the database', 'an engineer opens the list',
    'the most urgent records come first', async () => {
      const r = await call('GET', '/api/inspections', null, eng);
      const rank = { IMMEDIATE: 0, HIGH: 1, ROUTINE: 2, MONITOR: 3 };
      const sorted = r.data.every((x, i, a) => i === 0 || rank[a[i - 1].priority] <= rank[x.priority]);
      return { ok: r.status === 200 && sorted, detail: `HTTP ${r.status}, ${r.data.length} records, first=${r.data[0].priority}, ordered=${sorted}` };
    });

  await test('AT-06', 'FR-05', 'a record that is still a draft', 'an engineer tries to approve it directly',
    'the request is blocked with 409', async () => {
      const r = await call('PATCH', `/api/inspections/${draftId}/status`, { status: 'approved' }, eng);
      return { ok: r.status === 409, detail: `HTTP ${r.status}, "${r.data.error}"` };
    });

  await test('AT-07', 'FR-05, FR-06', 'the draft has been submitted', 'the inspector tries to approve it, then the engineer does',
    'the inspector is refused and the engineer succeeds', async () => {
      await call('PATCH', `/api/inspections/${draftId}/status`, { status: 'submitted' }, insp);
      const a = await call('PATCH', `/api/inspections/${draftId}/status`, { status: 'approved' }, insp);
      const b = await call('PATCH', `/api/inspections/${draftId}/status`, { status: 'approved' }, eng);
      approvedId = draftId;
      return { ok: a.status === 403 && b.status === 200 && b.data.status === 'approved', detail: `inspector HTTP ${a.status}, engineer HTTP ${b.status} -> ${b.data.status}` };
    });

  await test('AT-08', 'FR-05', 'an approved record', 'an engineer tries to send it back to draft',
    'the record stays locked (409)', async () => {
      const r = await call('PATCH', `/api/inspections/${approvedId}/status`, { status: 'draft' }, eng);
      return { ok: r.status === 409, detail: `HTTP ${r.status}, "${r.data.error}"` };
    });

  await test('AT-09', 'FR-06', 'a project manager account', 'the manager reads the list and then tries to create a record',
    'reading works and creating is refused', async () => {
      const a = await call('GET', '/api/inspections', null, mgr);
      const b = await call('POST', '/api/inspections', good(), mgr);
      return { ok: a.status === 200 && b.status === 403, detail: `read HTTP ${a.status}, create HTTP ${b.status}` };
    });

  await test('AT-10', 'NFR-03', 'a forged token and an expired token', 'each one is used to read the list',
    'both are rejected with 401', async () => {
      const forged = jwt.sign({ sub: 'x', role: 'engineer' }, 'not-the-real-secret', { issuer: 'oms-auth-service' });
      const expired = jwt.sign({ sub: 'x', role: 'engineer', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, { issuer: 'oms-auth-service' });
      const a = await call('GET', '/api/inspections', null, forged);
      const b = await call('GET', '/api/inspections', null, expired);
      return { ok: a.status === 401 && b.status === 401, detail: `forged HTTP ${a.status}, expired HTTP ${b.status}` };
    });

  await test('AT-11', 'FR-07', 'the record created and approved above', 'the outbox table is checked',
    'one event exists for each step (created, submitted, approved)', async () => {
      const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
      const { rows } = await c.query(`SELECT event_type FROM outbox_events WHERE payload->>'id' = $1 ORDER BY created_at`, [approvedId]);
      await c.end();
      const types = rows.map((x) => x.event_type);
      return { ok: types.length === 3, detail: `${types.length} events: ${types.join(', ')}` };
    });

  await test('AT-12', 'FR-09', 'a draft the inspector saved with a typo in the rating', 'the inspector edits the draft to fix it',
    'the change is saved (200)', async () => {
      const d = await call('POST', '/api/inspections', good({ conditionRating: 3 }), insp);
      const r = await call('PATCH', `/api/inspections/${d.data.id}`, { conditionRating: 2 }, insp);
      return { ok: r.status === 200, detail: `HTTP ${r.status}; there is no edit endpoint yet (planned for v1.2.0)` };
    });

  const passed = results.filter((r) => r.ok).length;
  console.log(`Acceptance tests: ${passed} passed, ${results.length - passed} failed, ${results.length} total`);
})();
