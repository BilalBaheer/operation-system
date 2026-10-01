const config = require('./config');
const { createApp } = require('./app');
const { createInspectionService } = require('./services/inspectionService');
const { createInMemoryRepository } = require('./repositories/inMemoryInspectionRepository');
const { createPostgresRepository } = require('./repositories/postgresInspectionRepository');
const { createOutboxPublisher } = require('./events/outboxPublisher');
const { createPool } = require('./db');

let repository;
let publisher;
let pool;

if (config.repoDriver === 'postgres') {
  pool = createPool(config);
  repository = createPostgresRepository(pool);
  publisher = createOutboxPublisher(pool);
} else {
  repository = createInMemoryRepository();
  publisher = { publish: async (event) => console.log('[event]', event.type) };
}

const service = createInspectionService({ repository, publisher });
const app = createApp(service, { pool });

app.listen(config.port, () => {
  console.log(`inspection-service listening on ${config.port} (repo: ${config.repoDriver})`);
});
