const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

// Translatable fields: name
const ingredientSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    translations: translationsField(),
    isRemovable:  { type: Boolean, default: true },
    isAvailable:  { type: Boolean, default: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
  },
  { timestamps: true }
);

ingredientSchema.index({ restaurantId: 1 });
ingredientSchema.index({ restaurantId: 1, name: 1 });

module.exports = mongoose.model('Ingredient', ingredientSchema);
