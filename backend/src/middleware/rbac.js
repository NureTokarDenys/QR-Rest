const ROLE_HIERARCHY = { guest: 0, cook: 1, waiter: 2, waiter_cook: 2, admin: 3, root_admin: 4 };

function requireRole(...roles) {
  // root_admin has all permissions that admin has
  const expanded = roles.includes('admin') ? [...roles, 'root_admin'] : roles;
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { request_id: req.requestId },
      });
    }
    if (!expanded.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        meta: { request_id: req.requestId },
      });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { request_id: req.requestId },
      });
    }
    if ((ROLE_HIERARCHY[req.user.role] ?? -1) < (ROLE_HIERARCHY[minRole] ?? 0) && req.user.role !== 'root_admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        meta: { request_id: req.requestId },
      });
    }
    next();
  };
}

function requireSameRestaurant(req, res, next) {
  if (!req.user?.restaurantId) {
    return res.status(403).json({
      error: { code: 'NO_RESTAURANT_LINKED', message: 'No restaurant associated with your account' },
      meta: { request_id: req.requestId },
    });
  }
  next();
}

module.exports = { requireRole, requireMinRole, requireSameRestaurant };
