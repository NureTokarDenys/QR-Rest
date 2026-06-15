const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

// Translatable fields: name, cuisine
const restaurantSchema = new mongoose.Schema(
  {
    _id:      { type: String },           // 8-char alphanumeric, e.g. "BR5CH3OK"
    name:     { type: String, required: true, trim: true },
    slug:     { type: String, required: true, unique: true, lowercase: true },
    address:  { type: String, trim: true },
    logoUrl:  { type: String, trim: true },
    cuisine:  { type: String, trim: true },
    isActive:         { type: Boolean, default: true },
    plan:             { type: String, enum: ['free', 'premium'], default: 'free' },
    subscriptionStartDate: { type: Date },
    subscriptionEndDate:   { type: Date },
    subscriptionCancelled: { type: Boolean, default: false },
    liqpayPublicKey:     { type: String },
    liqpayPrivateKeyEnc: { type: String },
    liqpayPrivateKeyIV:  { type: String },
    liqpayPrivateKeyTag: { type: String },
    defaultLanguage:  { type: String, default: 'uk' },       // language admin writes content in
    enabledLanguages: [{ type: String }],                    // translation targets; [] means all SUPPORTED_LANGUAGES
    translations: translationsField(),    // { en: { name: {value,isManual}, cuisine: {value,isManual} }, ... }
  },
  { timestamps: true }
);

restaurantSchema.index({ name: 'text', address: 'text', slug: 'text' });

module.exports = mongoose.model('Restaurant', restaurantSchema);
