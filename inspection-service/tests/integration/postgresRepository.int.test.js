// Integration tests: run the real service + repository against a real PostgreSQL database.
// Run with: DATABASE_URL=... npm run test:integration
const { Pool } = require('pg');
const { createPostgresRepository } = require('../../src/repositories/postgresInspectionRepository');
const { createOutboxPublisher } = require('../../src/events/outboxPublisher');
const { createInspectionService } = require('../../src/services/inspectionService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const service = createInspectionService({
  repository: createPostgresRepository(pool),
  publisher: createOutboxPublisher(pool),
});
const inspector = { sub: 'int-inspector', role: 'inspector' };
const engineer = { sub: 'int-engineer', role: 'engineer' };
const input = {
  projectId: 'INT-TEST', structureId: 'WHARF-2', inspectionDate: '2026-09-20', conditionRating: 3,
  findings: [{ element: 'Fender F-12', severity: 'major' }, { element: 'Deck joint', severity: 'minor' }],
};

beforeAll(async () => {
  await pool.query("DELETE FROM inspections WHERE project_id = 'INT-TEST'");
});
afterAll(async () => {
  await pool.query("DELETE FROM inspections WHERE project_id = 'INT-TEST'");
  await pool.end();
});

test('saves an inspection and its findings in one transaction', async () => {
  const created = await service.createInspection(inspector, input);
  const loaded = await service.getInspection(created.id);
  expect(loaded).toMatchObject({ priority: 'ROUTINE', status: 'draft', inspectorId: 'int-inspector' });
  expect(loaded.findings).toHaveLength(2);
});

test('writes an InspectionCreated event to the outbox table', async () => {
  const created = await service.createInspection(inspector, input);
  const { rows } = await pool.query(
    "SELECT event_type FROM outbox_events WHERE payload->>'id' = $1", [created.id]
  );
  expect(rows.map((r) => r.event_type)).toEqual(['InspectionCreated']);
});

test('moves through the full review workflow and persists the status', async () => {
  const created = await service.createInspection(inspector, input);
  await service.changeStatus(inspector, created.id, 'submitted');
  await service.changeStatus(engineer, created.id, 'approved');
  expect((await service.getInspection(created.id)).status).toBe('approved');
});

test('filters the list by project and priority', async () => {
  const list = await service.listInspections({ projectId: 'INT-TEST', priority: 'ROUTINE' });
  expect(list.length).toBeGreaterThanOrEqual(3);
  expect(list.every((r) => r.priority === 'ROUTINE')).toBe(true);
});

test('returns null (not a crash) for an id that is not a valid UUID', async () => {
  expect(await service.getInspection('does-not-exist')).toBeNull();
});

test('the database rejects a rating outside 1-5 even if the API check is skipped', async () => {
  await expect(pool.query(
    `INSERT INTO inspections (project_id, structure_id, inspector_id, inspection_date, condition_rating, priority)
     VALUES ('INT-TEST', 'X', 'y', '2026-09-01', 9, 'HIGH')`
  )).rejects.toThrow(/check constraint/);
});
