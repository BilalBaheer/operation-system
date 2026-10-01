const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { createInMemoryUserRepository } = require('../src/repositories/userRepository');

const SECRET = 'test-secret';
let app;

beforeAll(async () => {
  const users = createInMemoryUserRepository([{
    id: 'u-1', email: 'engineer@oms.local', display_name: 'Review Engineer', role: 'engineer',
    password_hash: await bcrypt.hash('Correct!Pass1', 4),
  }]);
  app = createApp({ users, jwtSecret: SECRET });
});

test('returns a signed token with the user role for correct credentials', async () => {
  const res = await request(app).post('/api/auth/login')
    .send({ email: 'engineer@oms.local', password: 'Correct!Pass1' });
  expect(res.status).toBe(200);
  expect(jwt.verify(res.body.token, SECRET, { issuer: 'oms-auth-service' }).role).toBe('engineer');
});

test('email matching ignores capital letters', async () => {
  const res = await request(app).post('/api/auth/login')
    .send({ email: 'Engineer@OMS.local', password: 'Correct!Pass1' });
  expect(res.status).toBe(200);
});

test('wrong password and unknown email give the exact same error', async () => {
  const wrong = await request(app).post('/api/auth/login').send({ email: 'engineer@oms.local', password: 'nope' });
  const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@oms.local', password: 'nope' });
  expect([wrong.status, unknown.status]).toEqual([401, 401]);
  expect(wrong.body).toEqual(unknown.body);
});

test('400 when fields are missing', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'engineer@oms.local' });
  expect(res.status).toBe(400);
});
