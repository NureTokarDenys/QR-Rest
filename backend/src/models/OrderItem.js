const mongoose = require('mongoose');

const DISH_STATUSES = ['waiting', 'cooking', 'ready', 'served'];

const orderItemSchema = new mongoose.Schema(
  {
    orderId:        { type: String,                         ref: 'Order',        required: true },
    servingGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServingGroup', required: true },
    menuItemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem',     required: true },
    quantity:       { type: Number, required: true, min: 1 },
    unitPrice:      { type: Number, required: true, min: 0 },
    // Snapshot: name at time of order (no populate needed)
    menuItemName:   { type: String, default: '' },
    excludedIngredients: [
      {
        _id:  { type: mongoose.Schema.Types.ObjectId },
        name: { type: String, default: '' },
      },
    ],
    addons: [
      {
        _id:      { type: mongoose.Schema.Types.ObjectId },
        name:     { type: String, default: '' },
        price:    { type: Number, required: true },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],
    componentGroupChoices: [
      {
        groupId:       { type: mongoose.Schema.Types.ObjectId },
        groupName:     { type: String, default: '' },
        optionId:      { type: mongoose.Schema.Types.ObjectId },
        optionName:    { type: String, default: '' },
        priceModifier: { type: Number, default: 0 },
      },
    ],
    comment:    { type: String, maxlength: 500 },
    dishStatus: { type: String, enum: DISH_STATUSES, default: 'waiting' },
  },
  { timestamps: true }
);

orderItemSchema.index({ orderId: 1 });

module.exports = mongoose.model('OrderItem', orderItemSchema);
