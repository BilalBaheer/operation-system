// Runs every .sql file in /migrations in order.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  const dir = path.join(__dirname, '..', 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log(`applied ${file}`);
  }
  await client.end();
})().catch((err) => {
  console.error('migration failed:', err.message);
  process.exit(1);
});
