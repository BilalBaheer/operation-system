function createPostgresUserRepository(pool) {
  return {
    async findByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, email, display_name, role, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      return rows[0] || null;
    },
  };
}

function createInMemoryUserRepository(users) {
  return {
    async findByEmail(email) {
      return users.find((u) => u.email === email.toLowerCase()) || null;
    },
  };
}

module.exports = { createPostgresUserRepository, createInMemoryUserRepository };
