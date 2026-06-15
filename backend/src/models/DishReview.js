const mongoose = require('mongoose');

const dishReviewSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',       required: true },
    orderItemId:  { type: mongoose.Schema.Types.ObjectId, ref: 'OrderItem',  required: true, unique: true },
    menuItemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem',   required: true },
    restaurantId: { type: String,                         ref: 'Restaurant', required: true },
    rating:       { type: Number, required: true, min: 1, max: 5 },
    comment:      { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

dishReviewSchema.index({ menuItemId: 1, createdAt: -1 });

module.exports = mongoose.model('DishReview', dishReviewSchema);
