const { Pool } = require('pg');

function createPool({ databaseUrl, dbSsl }) {
  return new Pool({
    connectionString: databaseUrl,
    ssl: dbSsl ? { rejectUnauthorized: true } : false,
    max: 10,
  });
}

module.exports = { createPool };
