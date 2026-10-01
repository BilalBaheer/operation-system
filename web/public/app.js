// Front-end logic. Talks to the gateway with fetch() and keeps the JWT in memory only.
const state = { token: null, user: null };
const $ = (id) => document.getElementById(id);
// Escape anything typed by users before putting it into HTML (prevents XSS)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RATING = { 1: 'Critical', 2: 'Poor', 3: 'Fair', 4: 'Satisfactory', 5: 'Good' };

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) signOut('Your session expired. Please sign in again.');
  return { ok: res.ok, status: res.status, data };
}

// Turns API validation messages into plain language and remembers which field each one belongs to
const FRIENDLY = [
  [/^projectId/, 'projectId', 'Enter the project number (for example PRJ-104).'],
  [/^structureId/, 'structureId', 'Enter the structure ID (for example PIER-7).'],
  [/^conditionRating/, 'conditionRating', 'Choose a condition rating from 1 (Critical) to 5 (Good).'],
  [/^inspectionDate cannot/, 'inspectionDate', 'The inspection date can\u2019t be in the future.'],
  [/^inspectionDate/, 'inspectionDate', 'Pick the date the inspection was done.'],
];
function friendly(msg) {
  const f = msg.match(/^findings\[(\d+)\]\.(element|severity)/);
  if (f) return { field: null, text: `Finding #${Number(f[1]) + 1} needs a ${f[2] === 'element' ? 'structural element name' : 'severity'}.` };
  const hit = FRIENDLY.find(([re]) => re.test(msg));
  return hit ? { field: hit[1], text: hit[2] } : { field: null, text: msg };
}

// ---------- login ----------
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { ok, data } = await api('/api/auth/login', {
    method: 'POST', body: { email: $('email').value.trim(), password: $('password').value },
  });
  if (!ok) return showMsg('loginMsg', data.error || 'Sign in failed', 'error');
  state.token = data.token;
  state.user = data.user;
  $('userName').textContent = data.user.name;
  $('userRole').textContent = data.user.role;
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('userBox').classList.remove('hidden');
  $('formCard').classList.toggle('hidden', data.user.role === 'manager'); // managers are read-only
  loadInspections();
});

function signOut(message) {
  state.token = null; state.user = null;
  $('appView').classList.add('hidden');
  $('userBox').classList.add('hidden');
  $('loginView').classList.remove('hidden');
  showMsg('loginMsg', message || '', 'info');
}
$('logoutBtn').addEventListener('click', () => signOut('You have signed out.'));

// ---------- findings rows ----------
function addFindingRow(element = '', severity = 'minor') {
  const row = document.createElement('div');
  row.className = 'finding';
  row.innerHTML = `
    <input aria-label="Structural element" placeholder="e.g. Pile cap P7-3" value="${esc(element)}">
    <select aria-label="Severity">
      ${['minor', 'moderate', 'major', 'critical'].map((s) => `<option ${s === severity ? 'selected' : ''}>${s}</option>`).join('')}
    </select>
    <button type="button" class="link remove" aria-label="Remove finding">✕</button>`;
  row.querySelector('.remove').onclick = () => row.remove();
  $('findings').appendChild(row);
}
$('addFinding').addEventListener('click', () => addFindingRow());

// ---------- create inspection ----------
$('inspectionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const findings = [...document.querySelectorAll('.finding')].map((r) => ({
    element: r.querySelector('input').value.trim(),
    severity: r.querySelector('select').value,
  })).filter((f) => f.element !== ''); // an empty row just means "no finding"
  document.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  const body = {
    projectId: $('projectId').value.trim(),
    structureId: $('structureId').value.trim(),
    inspectionDate: $('inspectionDate').value,
    conditionRating: Number($('conditionRating').value) || null,
    findings,
  };
  const { ok, data } = await api('/api/inspections', { method: 'POST', body });
  if (!ok) {
    const problems = (data.errors || [data.error]).map(friendly);
    problems.forEach((p) => p.field && $(p.field).setAttribute('aria-invalid', 'true'));
    const list = problems.map((p) => `<li>${esc(p.text)}</li>`).join('');
    return showMsg('formMsg', `<strong>Almost there \u2013 please fix ${problems.length === 1 ? 'this' : 'these'}:</strong><ul>${list}</ul>`, 'error', true);
  }
  showMsg('formMsg', `Saved. Repair priority: <b>${data.priority}</b>`, 'success', true);
  e.target.reset(); $('findings').innerHTML = ''; addFindingRow();
  loadInspections();
});

// ---------- list + workflow ----------
async function loadInspections() {
  const q = new URLSearchParams();
  if ($('fPriority').value) q.set('priority', $('fPriority').value);
  if ($('fStatus').value) q.set('status', $('fStatus').value);
  const { ok, data } = await api(`/api/inspections?${q}`);
  if (!ok) return;
  $('rows').innerHTML = data.map(rowHtml).join('');
  $('emptyMsg').classList.toggle('hidden', data.length > 0);
  document.querySelectorAll('[data-action]').forEach((b) => { b.onclick = () => changeStatus(b.dataset.id, b.dataset.action); });
}

function rowHtml(r) {
  const role = state.user.role;
  let actions = '';
  if (r.status === 'draft' && role !== 'manager') actions = btn(r.id, 'submitted', 'Submit');
  if (r.status === 'submitted' && role === 'engineer') actions = btn(r.id, 'approved', 'Approve') + btn(r.id, 'draft', 'Send back', 'link');
  return `<tr>
    <td><span class="badge ${r.priority.toLowerCase()}">${r.priority}</span></td>
    <td><b>${esc(r.projectId)}</b><br><span class="muted">${esc(r.structureId)}</span></td>
    <td>${r.inspectionDate}</td>
    <td>${r.conditionRating} – ${RATING[r.conditionRating]}</td>
    <td>${r.findingCount}</td>
    <td><span class="status ${r.status}">${r.status}</span></td>
    <td class="actions">${actions}</td></tr>`;
}
const btn = (id, action, label, cls = 'small') => `<button class="${cls}" data-id="${id}" data-action="${action}">${label}</button>`;

async function changeStatus(id, status) {
  const { ok, data } = await api(`/api/inspections/${id}/status`, { method: 'PATCH', body: { status } });
  if (!ok) alert(data.error);
  loadInspections();
}
$('fPriority').onchange = loadInspections;
$('fStatus').onchange = loadInspections;

function showMsg(id, html, kind, isHtml) {
  const el = $(id);
  el.className = `msg ${kind}`;
  if (isHtml) el.innerHTML = html; else el.textContent = html;
}

addFindingRow();
