// Creates demo users for LOCAL development only. Never run this against production.
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const users = [
  { email: 'inspector@oms.local', name: 'Field Inspector', role: 'inspector' },
  { email: 'engineer@oms.local', name: 'Review Engineer', role: 'engineer' },
  { email: 'manager@oms.local', name: 'Project Manager', role: 'manager' },
];

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production');
  const password = process.env.SEED_PASSWORD || 'LocalDemo!2026';
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const u of users) {
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (email, display_name, role, password_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [u.email, u.name, u.role, hash]
    );
    console.log(`seeded ${u.email} (${u.role})`);
  }
  await client.end();
})().catch((err) => { console.error(err.message); process.exit(1); });
