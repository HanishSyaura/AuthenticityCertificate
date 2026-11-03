const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

async function verifyToken(req, res, next) {
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
    const id = Number(decoded?.id);
    const email = String(decoded?.email || '').trim().toLowerCase();

    if (!Number.isInteger(id) || id <= 0 || !email) {
      return res.error('Invalid token', 401);
    }

    let user;
    try {
      user = await prisma.user.findUnique({ where: { id } });
    } catch {
      return res.error('Service temporarily unavailable', 503);
    }

    if (user) {
      if (
        String(user.email || '').trim().toLowerCase() !== email ||
        user.deletedAt
      ) {
        return res.error('Unauthorized', 401);
      }
    } else {
      let admin;
      try {
        admin = await prisma.admin.findUnique({ where: { id } });
      } catch {
        return res.error('Service temporarily unavailable', 503);
      }

      if (!admin || String(admin.email || '').trim().toLowerCase() !== email) {
        return res.error('Unauthorized', 401);
      }
    }

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
