const router = require('express').Router({ mergeParams: true });
const MenuItem = require('../../models/MenuItem');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound } = require('../../middleware/validate');
const { emit } = require('../../services/wsService');

const kitchenAuth = [requireAuth, requireRole('cook', 'waiter_cook', 'admin'), requireSameRestaurant];

router.get('/', ...kitchenAuth, async (req, res, next) => {
  try {
    const items = await MenuItem.find({ restaurantId: req.restaurantId, isAvailable: false, isDeleted: false }).lean();
    res.json({ data: items, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/:itemId', ...kitchenAuth, async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId, isDeleted: false });
    if (!item) return next(notFound('Menu item not found'));
    item.isAvailable = false;
    await item.save();
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'STOPLIST_ADD', menuItemId: item._id, isAvailable: false });
    res.json({ data: { menuItemId: item._id, isAvailable: false }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/:itemId', ...kitchenAuth, async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId, isDeleted: false });
    if (!item) return next(notFound('Menu item not found'));
    item.isAvailable = true;
    await item.save();
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'STOPLIST_REMOVE', menuItemId: item._id, isAvailable: true });
    res.json({ data: { menuItemId: item._id, isAvailable: true }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
