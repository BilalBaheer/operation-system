// All settings come from environment variables so the same code runs
// locally, in Docker, and in Azure without changes.
const config = {
  port: Number(process.env.PORT || 4002),
  repoDriver: process.env.REPO_DRIVER || 'postgres', // 'postgres' or 'memory'
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is required');
}
if (config.repoDriver === 'postgres' && !config.databaseUrl) {
  throw new Error('DATABASE_URL is required when REPO_DRIVER=postgres');
}

module.exports = config;
