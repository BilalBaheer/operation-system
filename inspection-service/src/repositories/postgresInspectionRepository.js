// PostgreSQL implementation of the inspection repository.
// It has the same methods as the in-memory version, so the service doesn't care which one it gets.
const PRIORITY_ORDER = `CASE i.priority WHEN 'IMMEDIATE' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'ROUTINE' THEN 3 ELSE 4 END`;

function toRecord(row, findings = []) {
  return {
    id: row.id,
    projectId: row.project_id,
    structureId: row.structure_id,
    inspectorId: row.inspector_id,
    inspectionDate: row.inspection_date instanceof Date
      ? row.inspection_date.toISOString().slice(0, 10)
      : row.inspection_date,
    conditionRating: row.condition_rating,
    priority: row.priority,
    status: row.status,
    findings,
    createdAt: row.created_at,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createPostgresRepository(pool) {
  async function findById(id) {
    if (!UUID_PATTERN.test(id)) return null; // PostgreSQL throws on bad UUIDs, so treat them as "not found"
    const { rows } = await pool.query('SELECT * FROM inspections WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const f = await pool.query(
      'SELECT element, severity FROM findings WHERE inspection_id = $1 ORDER BY element', [id]
    );
    return toRecord(rows[0], f.rows);
  }

  return {
    async insert(data) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO inspections
             (project_id, structure_id, inspector_id, inspection_date, condition_rating, priority, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [data.projectId, data.structureId, data.inspectorId, data.inspectionDate,
            data.conditionRating, data.priority, data.status]
        );
        for (const f of data.findings) {
          await client.query(
            'INSERT INTO findings (inspection_id, element, severity) VALUES ($1, $2, $3)',
            [rows[0].id, f.element, f.severity]
          );
        }
        await client.query('COMMIT');
        return toRecord(rows[0], data.findings.map(({ element, severity }) => ({ element, severity })));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    findById,

    async update(id, changes) {
      await pool.query(
        'UPDATE inspections SET status = $2, updated_at = now() WHERE id = $1',
        [id, changes.status]
      );
      return findById(id);
    },

    async list({ projectId, priority, status } = {}) {
      const where = [];
      const params = [];
      if (projectId) { params.push(projectId); where.push(`i.project_id = $${params.length}`); }
      if (priority) { params.push(priority); where.push(`i.priority = $${params.length}`); }
      if (status) { params.push(status); where.push(`i.status = $${params.length}`); }
      const { rows } = await pool.query(
        `SELECT i.*, COUNT(f.id)::int AS finding_count
           FROM inspections i LEFT JOIN findings f ON f.inspection_id = i.id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          GROUP BY i.id
          ORDER BY ${PRIORITY_ORDER}, i.inspection_date DESC
          LIMIT 100`,
        params
      );
      return rows.map((r) => ({ ...toRecord(r), findings: undefined, findingCount: r.finding_count }));
    },
  };
}

module.exports = { createPostgresRepository };
