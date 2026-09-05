const mongoose = require('mongoose');
const crypto = require('crypto');

const tripInvitationSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  recipientEmail: {
    type: String,
    required: true,
  },
  invitedBy: {
    type: String,
    required: true,
  },
  invitedByEmail: String,
  token: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  acceptedAt: Date,
  rejectedAt: Date,
  acceptedByUserId: String,
});

tripInvitationSchema.index({ tripId: 1 });
tripInvitationSchema.index({ groupId: 1 });
tripInvitationSchema.index({ recipientEmail: 1 });
tripInvitationSchema.index({ token: 1 });
tripInvitationSchema.index({ createdAt: -1 });

tripInvitationSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = mongoose.model('TripInvitation', tripInvitationSchema);
