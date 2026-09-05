const mongoose = require('mongoose');

const tripCommentSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  answeredAt: {
    type: Date,
    default: null,
  },
});

tripCommentSchema.index({ tripId: 1 });
tripCommentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TripComment', tripCommentSchema);
