// Black-box tests: only HTTP requests in and HTTP responses out, no knowledge of the internals.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { createInspectionService } = require('../src/services/inspectionService');
const { createInMemoryRepository } = require('../src/repositories/inMemoryInspectionRepository');

process.env.JWT_SECRET = 'test-secret';
const token = (role) => jwt.sign({ sub: `user-${role}`, role }, process.env.JWT_SECRET);

let app;
beforeEach(() => {
  const service = createInspectionService({
    repository: createInMemoryRepository(),
    publisher: { publish: async () => {} },
  });
  app = createApp(service);
});

const body = {
  projectId: 'PRJ-104', structureId: 'PIER-7', inspectionDate: '2026-09-15', conditionRating: 1,
};

describe('POST /api/inspections', () => {
  test('201 for a valid inspection from an inspector', async () => {
    const res = await request(app).post('/api/inspections')
      .set('Authorization', `Bearer ${token('inspector')}`).send(body);
    expect(res.status).toBe(201);
  });

  test('400 with error messages for invalid input', async () => {
    const res = await request(app).post('/api/inspections')
      .set('Authorization', `Bearer ${token('inspector')}`).send({ projectId: 'PRJ-104' });
    expect(res.status).toBe(400);
  });

  test('401 when no token is sent', async () => {
    const res = await request(app).post('/api/inspections').send(body);
    expect(res.status).toBe(401);
  });

  test('403 for a role that is not allowed', async () => {
    const res = await request(app).post('/api/inspections')
      .set('Authorization', `Bearer ${token('viewer')}`).send(body);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/inspections/:id/status', () => {
  test('409 when skipping straight from draft to approved', async () => {
    const created = await request(app).post('/api/inspections')
      .set('Authorization', `Bearer ${token('engineer')}`).send(body);
    const res = await request(app).patch(`/api/inspections/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token('engineer')}`).send({ status: 'approved' });
    expect(res.status).toBe(409);
  });

  test('404 for an inspection that does not exist', async () => {
    const res = await request(app).patch('/api/inspections/does-not-exist/status')
      .set('Authorization', `Bearer ${token('engineer')}`).send({ status: 'submitted' });
    expect(res.status).toBe(404);
  });
});
