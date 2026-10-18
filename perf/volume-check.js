// Volume check: after the soak test, does the list endpoint return every SOAK row, and does paging work?
// Shows the list is capped at 100 records and that page/offset params are ignored.
const { Client } = require('../inspection-service/node_modules/pg');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PW = process.env.SEED_PASSWORD || 'LocalDemo!2026';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query("SELECT count(*)::int AS n FROM inspections WHERE project_id = 'SOAK'");
  await c.end();

  const token = (await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@oms.local', password: PW }),
  })).json()).token;
  const get = async (path) => (await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })).json();

  const first = await get('/api/inspections?projectId=SOAK');
  const paged = await get('/api/inspections?projectId=SOAK&page=2&offset=100');

  console.log('$ node -e "GET /api/inspections?projectId=SOAK (with and without paging params)"');
  console.log(`SOAK rows in database: ${rows[0].n}`);
  console.log(`GET /api/inspections?projectId=SOAK returned ${first.length} records`);
  console.log(`same request with page=2&offset=100 returned ${paged.length} records, first id unchanged: ${first[0]?.id === paged[0]?.id}`);
})();
