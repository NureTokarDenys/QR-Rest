const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

// Translatable fields: name
const addOnSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    translations: translationsField(),
    price:        { type: Number, required: true, min: 0 },
    weight:       { type: String },
    minQuantity:  { type: Number, default: 0, min: 0 },
    maxQuantity:  { type: Number, default: 1, min: 1 },
    isAvailable:  { type: Boolean, default: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
  },
  { timestamps: true }
);

addOnSchema.index({ restaurantId: 1 });
addOnSchema.index({ restaurantId: 1, name: 1 });

module.exports = mongoose.model('AddOn', addOnSchema);
