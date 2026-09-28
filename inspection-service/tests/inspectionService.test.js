// Unit tests for the service layer. The database and Service Bus are replaced with Jest mocks
// so the service's own logic is tested in isolation.
const { createInspectionService, ValidationError, WorkflowError } = require('../src/services/inspectionService');

function setup(existingRecord = null) {
  const repository = {
    insert: jest.fn(async (data) => ({ id: 'insp-1', ...data })),
    findById: jest.fn(async () => existingRecord),
    update: jest.fn(async (id, changes) => ({ ...existingRecord, ...changes })),
  };
  const publisher = { publish: jest.fn(async () => {}) };
  return { repository, publisher, service: createInspectionService({ repository, publisher }) };
}

const inspector = { sub: 'user-inspector-01', role: 'inspector' };
const engineer = { sub: 'user-engineer-02', role: 'engineer' };
const input = {
  projectId: 'PRJ-104', structureId: 'PIER-7', inspectionDate: '2026-09-15', conditionRating: 2,
};

describe('createInspection', () => {
  test('saves the record as a draft with the calculated priority', async () => {
    const { service } = setup();
    const record = await service.createInspection(inspector, input);
    expect(record).toMatchObject({ status: 'draft', priority: 'HIGH' });
  });

  test('uses the inspector id from the token, not from the request body', async () => {
    const { service, repository } = setup();
    await service.createInspection(inspector, { ...input, inspectorId: 'someone-else' });
    expect(repository.insert.mock.calls[0][0].inspectorId).toBe('user-inspector-01');
  });

  test('publishes an InspectionCreated event', async () => {
    const { service, publisher } = setup();
    await service.createInspection(inspector, input);
    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'InspectionCreated' }));
  });

  test('throws ValidationError and never touches the database for bad input', async () => {
    const { service, repository } = setup();
    await expect(service.createInspection(inspector, { ...input, conditionRating: 9 }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(repository.insert).not.toHaveBeenCalled();
  });
});

describe('changeStatus', () => {
  test('an engineer can approve a submitted inspection', async () => {
    const { service } = setup({ id: 'insp-1', status: 'submitted' });
    const updated = await service.changeStatus(engineer, 'insp-1', 'approved');
    expect(updated.status).toBe('approved');
  });

  test('an inspector cannot approve', async () => {
    const { service } = setup({ id: 'insp-1', status: 'submitted' });
    await expect(service.changeStatus(inspector, 'insp-1', 'approved')).rejects.toBeInstanceOf(WorkflowError);
  });

  test('returns null when the inspection does not exist', async () => {
    const { service } = setup(null);
    expect(await service.changeStatus(engineer, 'missing', 'approved')).toBeNull();
  });
});
