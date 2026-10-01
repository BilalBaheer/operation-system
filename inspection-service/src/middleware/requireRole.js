const jwt = require('jsonwebtoken');

// Checks the JWT issued by auth-service and makes sure the user has an allowed role.
function requireRole(...allowed) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'oms-auth-service',
      });
      if (!allowed.includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired or invalid' });
    }
  };
}

module.exports = { requireRole };
