const { Pool } = require('pg');
const { createApp } = require('./app');
const { createPostgresUserRepository } = require('./repositories/userRepository');

const { DATABASE_URL, JWT_SECRET, PORT = 4001, DB_SSL } = process.env;
if (!DATABASE_URL || !JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required');

const pool = new Pool({ connectionString: DATABASE_URL, ssl: DB_SSL === 'true' ? { rejectUnauthorized: true } : false });
const app = createApp({ users: createPostgresUserRepository(pool), jwtSecret: JWT_SECRET, pool });

app.listen(PORT, () => console.log(`auth-service listening on ${PORT}`));
