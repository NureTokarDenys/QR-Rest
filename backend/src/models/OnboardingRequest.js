const mongoose = require('mongoose');

const STATUSES = ['pending', 'confirmed', 'expired'];

const onboardingRequestSchema = new mongoose.Schema(
  {
    email:          { type: String, required: true, lowercase: true, trim: true },
    ownerName:      { type: String, required: true, trim: true },
    restaurantName: { type: String, required: true, trim: true },
    token:          { type: String, required: true, unique: true },
    expiresAt:      { type: Date,   required: true },
    status:         { type: String, enum: STATUSES, default: 'pending' },
  },
  { timestamps: true }
);

onboardingRequestSchema.index({ email: 1 });
onboardingRequestSchema.index({ token: 1 });
// Auto-remove expired documents after their expiry time
onboardingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OnboardingRequest', onboardingRequestSchema);
