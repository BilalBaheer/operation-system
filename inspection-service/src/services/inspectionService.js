const { validateInspection, calculatePriority, canTransition } = require('../domain/inspectionRules');

class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class WorkflowError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/**
 * The service holds the business rules. The repository (database) and
 * publisher (Azure Service Bus) are passed in, so tests can swap in fakes.
 */
function createInspectionService({ repository, publisher }) {
  async function createInspection(user, input) {
    const result = validateInspection(input);
    if (!result.valid) throw new ValidationError(result.errors);

    const record = await repository.insert({
      projectId: input.projectId,
      structureId: input.structureId,
      inspectorId: user.sub, // always from the verified token, never the body
      inspectionDate: input.inspectionDate,
      conditionRating: input.conditionRating,
      findings: input.findings || [],
      priority: calculatePriority(input.conditionRating, input.findings),
      status: 'draft',
    });

    await publisher.publish({ type: 'InspectionCreated', id: record.id, priority: record.priority });
    return record;
  }

  async function changeStatus(user, id, newStatus) {
    const record = await repository.findById(id);
    if (!record) return null;

    if (!canTransition(record.status, newStatus)) {
      throw new WorkflowError(`Cannot move inspection from ${record.status} to ${newStatus}`);
    }
    if (newStatus === 'approved' && user.role !== 'engineer') {
      throw new WorkflowError('Only engineers can approve inspections');
    }

    const updated = await repository.update(id, { status: newStatus });
    await publisher.publish({ type: 'InspectionStatusChanged', id, status: newStatus });
    return updated;
  }

  return { createInspection, changeStatus };
}

module.exports = { createInspectionService, ValidationError, WorkflowError };
