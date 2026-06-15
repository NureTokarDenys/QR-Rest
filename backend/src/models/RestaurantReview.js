const mongoose = require('mongoose');

const restaurantReviewSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',       required: true },
    orderId:      { type: String,                         ref: 'Order',       required: true, unique: true },
    restaurantId: { type: String,                         ref: 'Restaurant',  required: true },
    rating:       { type: Number, required: true, min: 1, max: 5 },
    comment:      { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

restaurantReviewSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('RestaurantReview', restaurantReviewSchema);
