/**
 * requirePlan(requiredPlan) — middleware factory
 * Blocks the request with 403 PLAN_REQUIRED if the restaurant's plan
 * doesn't meet the requirement.
 *
 * Requires restaurantParam to have run first (sets req.restaurant).
 */
function requirePlan(requiredPlan) {
  return function (req, res, next) {
    const plan = req.restaurant?.plan || 'free';
    if (plan === requiredPlan || (requiredPlan === 'free')) {
      return next();
    }
    return res.status(403).json({
      error: {
        code: 'PLAN_REQUIRED',
        message: `This feature requires the ${requiredPlan} plan`,
        requiredPlan,
        currentPlan: plan,
      },
      meta: {},
    });
  };
}

module.exports = requirePlan;
