const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROLES = ['guest', 'cook', 'waiter', 'waiter_cook', 'admin', 'root_admin'];
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId:      { type: String, sparse: true },
    googleEmail:   { type: String },
    googleName:    { type: String },
    googlePicture: { type: String },
    role: { type: String, enum: ROLES, default: 'guest' },
    restaurantId: { type: String, ref: 'Restaurant' },
    isActive: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);


userSchema.methods.comparePassword = async function (password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.statics.hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

module.exports = mongoose.model('User', userSchema);
