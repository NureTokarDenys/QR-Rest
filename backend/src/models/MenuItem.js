const mongoose = require('mongoose');
const { translationsField } = require('../utils/translatedField');

const ingredientSubSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  name_en:     { type: String, default: '' },
  isRemovable: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  sourceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', default: null },
}, { _id: true });

const addonSubSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  name_en:     { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  isAvailable: { type: Boolean, default: true },
  sourceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'AddOn', default: null },
}, { _id: true });

const cgOptionSubSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  name_en:       { type: String, default: '' },
  priceModifier: { type: Number, default: 0 },
  isDefault:     { type: Boolean, default: false },
  sourceId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ComponentOption', default: null },
}, { _id: true });

const componentGroupSubSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  name_en:     { type: String, default: '' },
  isRequired:  { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  sourceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ComponentGroup', default: null },
  options:     [cgOptionSubSchema],
}, { _id: true });

const menuItemSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    description:  { type: String, trim: true },
    translations: translationsField(),
    basePrice:    { type: Number, required: true, min: 0 },
    categoryId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
    isAvailable:  { type: Boolean, default: true },
    imageUrl:     { type: String },
    images:       { type: [String], default: [] },
    selectedImageIdx: { type: Number, default: 0 },
    sortOrder:    { type: Number, default: 0 },
    weight:       { type: String },
    ingredients:     [ingredientSubSchema],
    addons:          [addonSubSchema],
    componentGroups: [componentGroupSubSchema],
    isDeleted:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurantId: 1, categoryId: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
