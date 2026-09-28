const express = require('express');
const { createInspectionRouter } = require('./routes/inspections');

function createApp(service) {
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/inspections', createInspectionRouter(service));
  return app;
}

module.exports = { createApp };
