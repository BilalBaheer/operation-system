// Load test for the integrated OMS system.
// Measures latency (p50/p95/p99), throughput (requests/sec), error rate, and memory (RSS) of each service.
const autocannon = require('autocannon');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DIRECT = process.env.INSPECTION_URL || 'http://localhost:4002';
const DURATION = Number(process.env.DURATION || 15);
const CONNECTIONS = Number(process.env.CONNECTIONS || 10);
const PASSWORD = process.env.SEED_PASSWORD || 'LocalDemo!2026';

const services = { 'web-gateway': 'node server.js', 'auth-service': 'auth-service', 'inspection-service': 'inspection-service' };

function rssMb(name) {
  // find the process for each service and read its resident memory from /proc
  const pids = execSync(`ps -eo pid,args`).toString().split('\n')
    .filter((l) => l.includes('node') && l.includes(name === 'web-gateway' ? 'node server.js' : 'src/server.js'))
    .map((l) => l.trim().split(' ')[0]);
  for (const pid of pids) {
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    if (name === 'web-gateway' ? cwd.endsWith('/web') : cwd.endsWith(`/${name}`)) {
      const line = fs.readFileSync(`/proc/${pid}/status`, 'utf8').split('\n').find((l) => l.startsWith('VmRSS'));
      return Number(line.match(/\d+/)[0]) / 1024;
    }
  }
  return null;
}

function snapshot() {
  return Object.fromEntries(Object.keys(services).map((s) => [s, rssMb(s)]));
}

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await r.json()).token;
}

function run(opts) {
  return new Promise((resolve, reject) => {
    const peak = snapshot();
    const timer = setInterval(() => {
      const now = snapshot();
      for (const k of Object.keys(now)) peak[k] = Math.max(peak[k], now[k]);
    }, 250);
    autocannon({ duration: DURATION, connections: CONNECTIONS, ...opts }, (err, res) => {
      clearInterval(timer);
      if (err) return reject(err);
      resolve({ res, peak });
    });
  });
}

(async () => {
  const token = await login('inspector@oms.local');
  const list = await (await fetch(`${BASE}/api/inspections`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const newInspection = JSON.stringify({
    projectId: 'LOAD-TEST', structureId: 'PIER-LT', inspectionDate: '2026-09-25', conditionRating: 3,
    findings: [{ element: 'Pile cap', severity: 'major' }, { element: 'Deck', severity: 'minor' }],
  });

  const scenarios = [
    { name: 'Gateway health check', url: `${BASE}/health` },
    { name: 'List inspections (via gateway)', url: `${BASE}/api/inspections`, headers: auth },
    { name: 'List inspections (direct to service)', url: `${DIRECT}/api/inspections`, headers: auth },
    { name: 'Get one inspection', url: `${BASE}/api/inspections/${list[0].id}`, headers: auth },
    { name: 'Create inspection (write + outbox)', url: `${BASE}/api/inspections`, method: 'POST', headers: auth, body: newInspection },
    { name: 'Login (bcrypt cost 10)', url: `${BASE}/api/auth/login`, method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'engineer@oms.local', password: PASSWORD }) },
  ];

  const idle = snapshot();
  const results = [];
  for (const s of scenarios) {
    const { name, ...opts } = s;
    const { res, peak } = await run(opts);
    const errors = res.non2xx + res.errors + res.timeouts;
    results.push({
      scenario: name,
      requests: res.requests.total,
      throughputRps: Math.round(res.requests.average),
      p50Ms: res.latency.p50, p90Ms: res.latency.p90, p97_5Ms: res.latency.p97_5, p99Ms: res.latency.p99, avgMs: Number(res.latency.average.toFixed(2)),
      errorRatePct: Number(((errors / Math.max(res.requests.total, 1)) * 100).toFixed(2)),
      peakRssMb: Object.fromEntries(Object.entries(peak).map(([k, v]) => [k, Number(v.toFixed(1))])),
    });
    console.log(`done: ${name}`);
  }

  const out = { date: new Date().toISOString(), durationSec: DURATION, connections: CONNECTIONS,
    idleRssMb: Object.fromEntries(Object.entries(idle).map(([k, v]) => [k, Number(v.toFixed(1))])), results };
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'results.json'), JSON.stringify(out, null, 2));

  console.log(`\nLoad test: ${CONNECTIONS} concurrent connections, ${DURATION}s per scenario\n`);
  console.table(results.map((r) => ({
    Scenario: r.scenario, 'Req/s': r.throughputRps, 'p50 ms': r.p50Ms, 'p90 ms': r.p90Ms, 'p99 ms': r.p99Ms, 'Errors %': r.errorRatePct,
  })));
  console.log('Idle memory (RSS MB):', out.idleRssMb);
})();
