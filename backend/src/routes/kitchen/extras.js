const router = require('express').Router({ mergeParams: true });
const MenuItem = require('../../models/MenuItem');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest } = require('../../middleware/validate');

const kitchenAuth = [requireAuth, requireRole('cook', 'waiter_cook', 'admin'), requireSameRestaurant];

// PATCH /:restaurantId/kitchen/extras/menu/:itemId/:type/:subId/availability
// type: ingredients | addons | componentGroups
router.patch('/menu/:itemId/:type/:subId/availability', ...kitchenAuth, async (req, res, next) => {
  try {
    const { itemId, type, subId } = req.params;
    const ALLOWED = ['ingredients', 'addons', 'componentGroups'];
    if (!ALLOWED.includes(type)) return next(badRequest('type must be ingredients, addons, or componentGroups'));

    const menuItem = await MenuItem.findOne({ _id: itemId, restaurantId: req.restaurantId, isDeleted: false });
    if (!menuItem) return next(notFound('Menu item not found'));

    const arr = menuItem[type];
    const sub = arr.id(subId);
    if (!sub) return next(notFound('Sub-item not found'));

    sub.isAvailable = req.body.isAvailable !== false;
    menuItem.markModified(type);
    await menuItem.save();

    res.json({ data: { _id: sub._id, isAvailable: sub.isAvailable }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/kitchen/extras/stoplist — all dishes with embedded items
router.get('/stoplist', ...kitchenAuth, async (req, res, next) => {
  try {
    const items = await MenuItem.find({ restaurantId: req.restaurantId, isDeleted: false })
      .select('name ingredients addons componentGroups isAvailable')
      .lean();
    res.json({ data: items, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
