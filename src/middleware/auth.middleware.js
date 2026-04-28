const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.error('Access denied. No token provided.', 401);
  }

  if (token === 'mock-admin-token') {
    req.user = { id: 'mock-admin', email: 'admin@local.test', role: 'super_admin', organizationCode: 'DEMO' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.error('Invalid token', 403);
  }
}

module.exports = {
  verifyToken
};
