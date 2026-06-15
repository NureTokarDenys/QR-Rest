const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

// Translatable fields: name
const categorySchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    translations: translationsField(),   // { en: { name: {value,isManual} }, ... }
    color:        { type: String, trim: true, default: null },
    imageUrl:     { type: String, trim: true },
    images:       { type: [String], default: [] },
    selectedImageIdx: { type: Number, default: 0 },
    sortOrder:    { type: Number, default: 0 },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
    isDeleted:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ restaurantId: 1, isDeleted: 1 });

module.exports = mongoose.model('Category', categorySchema);
