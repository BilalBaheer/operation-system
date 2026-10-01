// API gateway + static web UI.
// The browser only talks to this one origin, and the gateway forwards API calls
// to the right microservice. This avoids CORS problems and hides internal service URLs.
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const {
  PORT = 3000,
  AUTH_SERVICE_URL = 'http://localhost:4001',
  INSPECTION_SERVICE_URL = 'http://localhost:4002',
} = process.env;

const app = express();

app.use(createProxyMiddleware({ pathFilter: '/api/auth', target: AUTH_SERVICE_URL }));
app.use(createProxyMiddleware({ pathFilter: '/api/inspections', target: INSPECTION_SERVICE_URL }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'web-gateway' }));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`web gateway listening on ${PORT}`));
