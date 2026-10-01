const { randomUUID } = require('crypto');

const RANK = { IMMEDIATE: 1, HIGH: 2, ROUTINE: 3, MONITOR: 4 };

// Same interface as the PostgreSQL repository, used for unit tests and quick demos.
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
    async list({ projectId, priority, status } = {}) {
      return [...rows.values()]
        .filter((r) => (!projectId || r.projectId === projectId)
          && (!priority || r.priority === priority)
          && (!status || r.status === status))
        .sort((a, b) => RANK[a.priority] - RANK[b.priority])
        .map(({ findings, ...r }) => ({ ...r, findingCount: (findings || []).length }));
    },
  };
}

module.exports = { createInMemoryRepository };
