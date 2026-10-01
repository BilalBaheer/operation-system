const express = require('express');
const { createInspectionRouter } = require('./routes/inspections');

function createApp(service, { pool } = {}) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Health check used by Docker and Azure to know the service is alive
  app.get('/health', async (req, res) => {
    try {
      if (pool) await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'inspection-service', db: pool ? 'up' : 'memory' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api/inspections', createInspectionRouter(service));
  return app;
}

module.exports = { createApp };
