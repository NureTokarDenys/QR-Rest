const Restaurant = require('../models/Restaurant');

/**
 * Resolves :restaurantId URL param (8-char alphanumeric = the restaurant's _id)
 * into the Mongoose document and attaches it to the request.
 *
 * Sets:
 *   req.restaurantId  {string}  — the restaurant's _id (same as the URL param)
 *   req.restaurant    {object}  — the full restaurant document
 */
async function restaurantParam(req, res, next) {
  try {
    // _id IS the publicId, so findById works directly
    const restaurant = await Restaurant.findById(req.params.restaurantId).lean();

    if (!restaurant) {
      return res.status(404).json({
        error: { code: 'RESTAURANT_NOT_FOUND', message: 'Restaurant not found' },
        meta: {},
      });
    }
    if (restaurant.isActive === false) {
      return res.status(403).json({
        error: { code: 'RESTAURANT_INACTIVE', message: 'Restaurant is currently unavailable' },
        meta: {},
      });
    }

    req.restaurantId = restaurant._id;   // string, e.g. "BR5CH3OK"
    req.restaurant   = restaurant;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Ensures the authenticated staff member belongs to the restaurant in the URL.
 * Must run after requireAuth (so req.user is set) and after restaurantParam.
 */
function requireSameRestaurant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      meta: {},
    });
  }
  if (!req.user.restaurantId) {
    return res.status(403).json({
      error: { code: 'NO_RESTAURANT_LINKED', message: 'No restaurant associated with your account' },
      meta: {},
    });
  }
  if (String(req.user.restaurantId) !== String(req.restaurantId)) {
    return res.status(403).json({
      error: { code: 'WRONG_RESTAURANT', message: 'You do not have access to this restaurant' },
      meta: {},
    });
  }
  next();
}

module.exports = { restaurantParam, requireSameRestaurant };
