const { SEVERITIES, STATUS_TRANSITIONS } = require('./constants');

/**
 * Checks an inspection before it is saved.
 * Returns { valid: boolean, errors: string[] }
 */
function validateInspection(input) {
  const errors = [];

  if (!input.projectId) errors.push('projectId is required');
  if (!input.structureId) errors.push('structureId is required');

  const rating = input.conditionRating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push('conditionRating must be a whole number from 1 to 5');
  }

  if (!input.inspectionDate || Number.isNaN(Date.parse(input.inspectionDate))) {
    errors.push('inspectionDate must be a valid date');
  }

  (input.findings || []).forEach((f, i) => {
    if (!f.element) errors.push(`findings[${i}].element is required`);
    if (!SEVERITIES.includes(f.severity)) {
      errors.push(`findings[${i}].severity must be one of ${SEVERITIES.join(', ')}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Decides how urgently engineers should look at a structure.
 */
function calculatePriority(conditionRating, findings = []) {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const majorCount = findings.filter((f) => f.severity === 'major').length;

  if (conditionRating === 1 || criticalCount > 0) return 'IMMEDIATE';
  if (conditionRating === 2 || majorCount >= 2) return 'HIGH';
  if (conditionRating === 3 || majorCount === 1) return 'ROUTINE';
  return 'MONITOR';
}

/**
 * Is it allowed to move an inspection from one status to another?
 */
function canTransition(from, to) {
  return STATUS_TRANSITIONS[from].includes(to);
}

module.exports = { validateInspection, calculatePriority, canTransition };
