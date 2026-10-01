// End-to-end input/output demo: starts all three services in one process,
// sends real HTTP requests through the gateway, and prints what comes back.
process.env.REPO_DRIVER = 'postgres';
const { Pool } = require('../inspection-service/node_modules/pg');
const inspection = require('../inspection-service/src/app');
const { createInspectionService } = require('../inspection-service/src/services/inspectionService');
const { createPostgresRepository } = require('../inspection-service/src/repositories/postgresInspectionRepository');
const { createOutboxPublisher } = require('../inspection-service/src/events/outboxPublisher');
const auth = require('../auth-service/src/app');
const { createPostgresUserRepository } = require('../auth-service/src/repositories/userRepository');
const { spawn } = require('child_process');

const projectPool = new Pool({ connectionString: process.env.DATABASE_URL });
const authPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const svc = createInspectionService({ repository: createPostgresRepository(projectPool), publisher: createOutboxPublisher(projectPool) });
const s1 = inspection.createApp(svc, { pool: projectPool }).listen(4002);
const s2 = auth.createApp({ users: createPostgresUserRepository(authPool), jwtSecret: process.env.JWT_SECRET, pool: authPool }).listen(4001);
const gw = spawn('node', ['server.js'], { cwd: `${__dirname}/../web`, env: { ...process.env, PORT: '3000' } });

const B = 'http://localhost:3000';
const show = (label, status, body) => console.log(`\n${label}\n  <- ${status} ${JSON.stringify(body)}`);
const req = async (method, path, body, token) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};

setTimeout(async () => {
  let r = await req('POST', '/api/auth/login', { email: 'inspector@oms.local', password: 'LocalDemo!2026' });
  const insp = r.body.token;
  show('1) POST /api/auth/login  {"email":"inspector@oms.local","password":"********"}', r.status, { token: insp.slice(0, 24) + '...', user: r.body.user });

  r = await req('POST', '/api/inspections', { projectId: 'PRJ-500', conditionRating: 7, inspectionDate: '2027-01-01' }, insp);
  show('2) POST /api/inspections  {"projectId":"PRJ-500","conditionRating":7,"inspectionDate":"2027-01-01"}', r.status, r.body);

  const good = { projectId: 'PRJ-500', structureId: 'QUAY-WALL-4', inspectionDate: '2026-09-30', conditionRating: 3,
    findings: [{ element: 'Tie-back anchor', severity: 'major' }, { element: 'Cope beam', severity: 'major' }] };
  r = await req('POST', '/api/inspections', good, insp);
  const id = r.body.id;
  show(`3) POST /api/inspections  ${JSON.stringify(good)}`, r.status, { id: id.slice(0, 8) + '...', priority: r.body.priority, status: r.body.status, findings: r.body.findings.length });

  r = await req('PATCH', `/api/inspections/${id}/status`, { status: 'approved' }, insp);
  show('4) PATCH /api/inspections/:id/status  {"status":"approved"}   (inspector, still a draft)', r.status, r.body);

  r = await req('PATCH', `/api/inspections/${id}/status`, { status: 'submitted' }, insp);
  const eng = (await req('POST', '/api/auth/login', { email: 'engineer@oms.local', password: 'LocalDemo!2026' })).body.token;
  r = await req('PATCH', `/api/inspections/${id}/status`, { status: 'approved' }, eng);
  show('5) submit as inspector, then PATCH {"status":"approved"} as engineer', r.status, { status: r.body.status });

  r = await req('GET', '/api/inspections?priority=HIGH', null, eng);
  show('6) GET /api/inspections?priority=HIGH', r.status, r.body.map((x) => `${x.structureId} (${x.status})`));

  const ev = await projectPool.query("SELECT event_type, payload->>'status' AS status FROM outbox_events WHERE payload->>'id'=$1 ORDER BY id", [id]);
  console.log('\n7) SELECT event_type FROM outbox_events WHERE payload->>\'id\' = <new id>');
  ev.rows.forEach((e) => console.log(`  ${e.event_type}${e.status ? ' -> ' + e.status : ''}`));

  await projectPool.query("DELETE FROM outbox_events WHERE payload->>'id'=$1", [id]);
  await projectPool.query("DELETE FROM inspections WHERE project_id='PRJ-500'");
  gw.kill(); s1.close(); s2.close(); await projectPool.end(); await authPool.end();
}, 1500);
