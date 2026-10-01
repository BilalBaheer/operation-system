const express = require('express');
const { createAuthRouter } = require('./routes/auth');

function createApp({ users, jwtSecret, pool }) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.get('/health', async (req, res) => {
    try {
      if (pool) await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'auth-service' });
    } catch {
      res.status(503).json({ status: 'degraded' });
    }
  });
  app.use('/api/auth', createAuthRouter({ users, jwtSecret }));
  return app;
}

module.exports = { createApp };
