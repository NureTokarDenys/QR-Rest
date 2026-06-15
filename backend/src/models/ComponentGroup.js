const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

// Translatable fields: name
const componentGroupSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    translations: translationsField(),
    isRequired:   { type: Boolean, default: false },
    sortOrder:    { type: Number, default: 0 },
    isAvailable:  { type: Boolean, default: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
  },
  { timestamps: true }
);

componentGroupSchema.index({ restaurantId: 1 });
componentGroupSchema.index({ restaurantId: 1, sortOrder: 1 });

module.exports = mongoose.model('ComponentGroup', componentGroupSchema);
