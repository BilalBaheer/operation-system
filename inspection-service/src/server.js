const { createApp } = require('./app');
const { createInspectionService } = require('./services/inspectionService');
const { createInMemoryRepository } = require('./repositories/inMemoryInspectionRepository');

// In Azure, the repository is PostgreSQL and the publisher is Service Bus.
const service = createInspectionService({
  repository: createInMemoryRepository(),
  publisher: { publish: async (event) => console.log('[event]', event) },
});

const port = process.env.PORT || 3000;
createApp(service).listen(port, () => console.log(`inspection-service listening on ${port}`));
