const { randomUUID } = require('crypto');

// Same interface as the PostgreSQL repository, used for local demos and tests.
function createInMemoryRepository() {
  const rows = new Map();
  return {
    async insert(data) {
      const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...data };
      rows.set(record.id, record);
      return record;
    },
    async findById(id) {
      return rows.get(id) || null;
    },
    async update(id, changes) {
      const updated = { ...rows.get(id), ...changes };
      rows.set(id, updated);
      return updated;
    },
  };
}

module.exports = { createInMemoryRepository };
