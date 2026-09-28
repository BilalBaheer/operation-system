// White-box unit tests: written with knowledge of every branch inside inspectionRules.js
const { validateInspection, calculatePriority, canTransition } = require('../src/domain/inspectionRules');

const validInput = () => ({
  projectId: 'PRJ-104',
  structureId: 'PIER-7',
  inspectionDate: '2026-09-15',
  conditionRating: 3,
  findings: [{ element: 'Pile cap P7-3', severity: 'major' }],
});

describe('validateInspection', () => {
  test('accepts a complete, correct inspection', () => {
    expect(validateInspection(validInput())).toEqual({ valid: true, errors: [] });
  });

  test('rejects a missing projectId', () => {
    const input = { ...validInput(), projectId: undefined };
    expect(validateInspection(input).errors).toContain('projectId is required');
  });

  // Boundary value analysis on the 1-5 rating scale
  test.each([1, 5])('accepts boundary rating %i', (rating) => {
    expect(validateInspection({ ...validInput(), conditionRating: rating }).valid).toBe(true);
  });

  test.each([0, 6, 3.5, '3'])('rejects out-of-range or non-integer rating %p', (rating) => {
    expect(validateInspection({ ...validInput(), conditionRating: rating }).valid).toBe(false);
  });

  test('rejects an inspection date in the future', () => {
    const input = { ...validInput(), inspectionDate: '2099-01-01' };
    expect(validateInspection(input).errors).toContain('inspectionDate cannot be in the future');
  });

  test('rejects a finding with an unknown severity', () => {
    const input = { ...validInput(), findings: [{ element: 'Deck', severity: 'scary' }] };
    expect(validateInspection(input).valid).toBe(false);
  });
});

describe('calculatePriority', () => {
  test('rating 1 is IMMEDIATE', () => {
    expect(calculatePriority(1, [])).toBe('IMMEDIATE');
  });

  test('any critical finding is IMMEDIATE, even with a good rating', () => {
    expect(calculatePriority(5, [{ severity: 'critical' }])).toBe('IMMEDIATE');
  });

  test('rating 2 is HIGH', () => {
    expect(calculatePriority(2, [])).toBe('HIGH');
  });

  test('two major findings are HIGH', () => {
    expect(calculatePriority(4, [{ severity: 'major' }, { severity: 'major' }])).toBe('HIGH');
  });

  test('one major finding is ROUTINE', () => {
    expect(calculatePriority(4, [{ severity: 'major' }])).toBe('ROUTINE');
  });

  test('rating 4 with only minor findings is MONITOR', () => {
    expect(calculatePriority(4, [{ severity: 'minor' }])).toBe('MONITOR');
  });
});

describe('canTransition', () => {
  test('draft can be submitted', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
  });

  test('approved records are locked', () => {
    expect(canTransition('approved', 'draft')).toBe(false);
  });

  test('an unknown status returns false instead of crashing', () => {
    expect(canTransition('archived', 'draft')).toBe(false);
  });
});
