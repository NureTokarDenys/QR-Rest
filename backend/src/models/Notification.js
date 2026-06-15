const mongoose = require('mongoose');

// Notifications are linked to an order and delivered to the guest who placed it.
// They are created server-side when significant order events occur and are also
// pushed to the client via WebSocket (NOTIFICATION_NEW event).
const NOTIFICATION_TYPES = [
  'dish_status_updated',    // a serving group changed cooking status
  'dish_status_corrected',  // cook reverted a group status (accidental change)
  'order_cancelled',        // order was cancelled by staff or guest
  'payment_completed_cash',
  'payment_completed_epay',
  'items_added',            // waiter or guest added more dishes
];

const notificationSchema = new mongoose.Schema(
  {
    orderId:      { type: String, ref: 'Order', required: true, index: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
    sessionToken: { type: String, required: true },
    type:         { type: String, enum: NOTIFICATION_TYPES, required: true },
    title_uk:     { type: String, default: '' },
    title_en:     { type: String, default: '' },
    body_uk:      { type: String, default: '' },
    body_en:      { type: String, default: '' },
    data:         { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt:       { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ orderId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // auto-purge after 7 days

module.exports = mongoose.model('Notification', notificationSchema);
