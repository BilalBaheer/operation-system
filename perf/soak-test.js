// Stability (soak) test: 60 s of mixed read/write traffic through the gateway,
// sampling each service's memory (RSS) every 5 s and checking errors and data afterwards.
const autocannon = require('autocannon');
const { execSync } = require('child_process');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const DURATION = Number(process.env.DURATION || 60);
const PW = process.env.SEED_PASSWORD || 'LocalDemo!2026';

// Windows has no /proc: find each service by its listening port, read its working set from tasklist.
const PORTS = { 'auth-service': 4001, 'inspection-service': 4002, gateway: 3000 };
function rssWindows() {
  const out = {};
  const netstat = execSync('netstat -ano -p TCP').toString();
  for (const [name, port] of Object.entries(PORTS)) {
    const m = netstat.match(new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
    if (!m) continue;
    const row = execSync(`tasklist /FI "PID eq ${m[1]}" /FO CSV /NH`).toString();
    const kb = Number(row.split('","')[4].replace(/\D/g, ''));
    out[name] = Math.round(kb / 1024);
  }
  return out;
}

function rss() {
  if (process.platform === 'win32') return rssWindows();
  const out = {};
  for (const line of execSync('ps -eo pid,args').toString().split('\n')) {
    if (!/node (src\/)?server\.js/.test(line)) continue;
    const pid = line.trim().split(' ')[0];
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    const name = cwd.endsWith('/web') ? 'gateway' : cwd.split('/').pop();
    const kb = Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]);
    out[name] = Math.round(kb / 1024);
  }
  return out;
}

(async () => {
  const token = (await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@oms.local', password: PW }),
  })).json()).token;
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const body = JSON.stringify({ projectId: 'SOAK', structureId: 'PIER-S', inspectionDate: '2026-10-01', conditionRating: 3,
    findings: [{ element: 'Pile cap', severity: 'major' }, { element: 'Deck', severity: 'minor' }] });

  console.log(`Soak test: ${DURATION} s, 10 connections, mixed traffic (4 reads : 1 write) through ${BASE}`);
  const start = rss();
  console.log('t=0s    RSS MB', JSON.stringify(start));
  let t = 0;
  const timer = setInterval(() => { t += 5; console.log(`t=${t}s`.padEnd(8), 'RSS MB', JSON.stringify(rss())); }, 5000);

  const res = await autocannon({
    url: BASE, connections: 10, duration: DURATION,
    requests: [
      { method: 'GET', path: '/api/inspections', headers: h },
      { method: 'GET', path: '/api/inspections?priority=IMMEDIATE', headers: h },
      { method: 'GET', path: '/api/inspections?projectId=SOAK', headers: h },
      { method: 'GET', path: '/health' },
      { method: 'POST', path: '/api/inspections', headers: h, body },
    ],
  });
  clearInterval(timer);
  const end = rss();
  const errors = res.non2xx + res.errors + res.timeouts;
  console.log('\n--- Soak test summary ---');
  console.log(`Requests completed : ${res.requests.total.toLocaleString()}`);
  console.log(`Throughput         : ${Math.round(res.requests.average)} requests per second (average)`);
  console.log(`Latency            : p50 ${res.latency.p50} ms, p90 ${res.latency.p90} ms, p99 ${res.latency.p99} ms`);
  console.log(`Errors             : ${errors} (non-2xx ${res.non2xx}, socket ${res.errors}, timeouts ${res.timeouts})`);
  console.log('Memory start -> end:', Object.keys(end).map((k) => `${k} ${start[k]} -> ${end[k]} MB`).join(', '));
})();
