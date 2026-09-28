// Walks through the core inspection logic and prints the results.
const { validateInspection, calculatePriority, canTransition } = require('../src/domain/inspectionRules');
const { createInspectionService } = require('../src/services/inspectionService');
const { createInMemoryRepository } = require('../src/repositories/inMemoryInspectionRepository');

(async () => {
  console.log('=== 1. Validation ===');
  const good = {
    projectId: 'PRJ-104', structureId: 'PIER-7', inspectionDate: '2026-09-15',
    conditionRating: 2, findings: [{ element: 'Pile cap P7-3', severity: 'major' }],
  };
  console.log('Valid input  ->', validateInspection(good));
  console.log('Bad input    ->', validateInspection({ projectId: 'PRJ-104', conditionRating: 9 }));

  console.log('\n=== 2. Repair priority ===');
  console.log('Rating 1, no findings        ->', calculatePriority(1, []));
  console.log('Rating 4, 1 critical finding ->', calculatePriority(4, [{ severity: 'critical' }]));
  console.log('Rating 3, 2 major findings   ->', calculatePriority(3, [{ severity: 'major' }, { severity: 'major' }]));
  console.log('Rating 5, minor findings     ->', calculatePriority(5, [{ severity: 'minor' }]));

  console.log('\n=== 3. Workflow ===');
  console.log('draft -> submitted   ->', canTransition('draft', 'submitted'));
  console.log('approved -> draft    ->', canTransition('approved', 'draft'));

  console.log('\n=== 4. Full create + approve flow ===');
  const events = [];
  const service = createInspectionService({
    repository: createInMemoryRepository(),
    publisher: { publish: async (e) => events.push(e.type) },
  });
  const inspector = { sub: 'user-inspector-01', role: 'inspector' };
  const engineer = { sub: 'user-engineer-02', role: 'engineer' };

  const created = await service.createInspection(inspector, good);
  console.log('Created:', { status: created.status, priority: created.priority, inspectorId: created.inspectorId });
  await service.changeStatus(inspector, created.id, 'submitted');
  const approved = await service.changeStatus(engineer, created.id, 'approved');
  console.log('Final status:', approved.status);
  console.log('Events published:', events);
})();
