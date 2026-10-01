const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function createAuthRouter({ users, jwtSecret, tokenTtl = '1h' }) {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await users.findByEmail(email);
      // Same message for "no such user" and "wrong password" so attackers can't tell which one failed
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { sub: user.id, role: user.role, name: user.display_name },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: tokenTtl, issuer: 'oms-auth-service' }
      );
      res.json({ token, user: { name: user.display_name, role: user.role } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
