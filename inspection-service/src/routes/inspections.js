const express = require('express');
const { requireRole } = require('../middleware/requireRole');
const { ValidationError, WorkflowError } = require('../services/inspectionService');

function createInspectionRouter(service) {
  const router = express.Router();

  router.post('/', requireRole('inspector', 'engineer'), async (req, res, next) => {
    try {
      const record = await service.createInspection(req.user, req.body);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireRole('inspector', 'engineer', 'manager'), async (req, res, next) => {
    try {
      const { projectId, priority, status } = req.query;
      res.json(await service.listInspections({ projectId, priority, status }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', requireRole('inspector', 'engineer', 'manager'), async (req, res, next) => {
    try {
      const record = await service.getInspection(req.params.id);
      if (!record) return res.status(404).json({ error: 'Inspection not found' });
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/status', requireRole('inspector', 'engineer'), async (req, res, next) => {
    try {
      const record = await service.changeStatus(req.user, req.params.id, req.body.status);
      if (!record) return res.status(404).json({ error: 'Inspection not found' });
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  // Turn known errors into clean HTTP responses
  router.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ errors: err.errors });
    if (err instanceof WorkflowError) return res.status(409).json({ error: err.message });
    next(err);
  });

  return router;
}

module.exports = { createInspectionRouter };
