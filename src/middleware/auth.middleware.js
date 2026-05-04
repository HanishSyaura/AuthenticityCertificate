const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const parts = authHeader ? String(authHeader).trim().split(/\s+/) : [];
  const token = parts.length >= 2 ? parts[1] : parts[0];

  if (!token) {
    return res.error('Access denied. No token provided.', 401);
  }

  if (!process.env.JWT_SECRET) {
    return res.error('Service temporarily unavailable', 503);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') {
      return res.error('Token expired', 401);
    }
    return res.error('Invalid token', 401);
  }
}

module.exports = {
  verifyToken
};
