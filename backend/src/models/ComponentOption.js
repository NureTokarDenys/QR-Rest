const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

// Translatable fields: name
const componentOptionSchema = new mongoose.Schema(
  {
    componentGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComponentGroup', required: true },
    name:             { type: String, required: true, trim: true },
    translations:     translationsField(),
    priceModifier: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ComponentOption', componentOptionSchema);
