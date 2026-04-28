function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.error('Access denied', 403);
    if (!allowed.includes(role)) return res.error('Insufficient permissions', 403);
    next();
  };
}

module.exports = {
  requireRole
};

