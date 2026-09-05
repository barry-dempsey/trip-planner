const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
  },
  groupId: String,
  userId: String,
  userEmail: String,
  action: {
    type: String,
    enum: [
      'trip_created',
      'trip_updated',
      'trip_deleted',
      'itinerary_added',
      'itinerary_updated',
      'itinerary_deleted',
      'member_added',
      'member_removed',
      'member_role_changed',
      'member_invited',
      'comment_added',
      'comment_edited',
      'comment_deleted',
      'item_commented',
    ],
  },
  targetType: {
    type: String,
    enum: ['trip', 'itinerary', 'member', 'comment'],
  },
  targetId: String,
  targetDetails: mongoose.Schema.Types.Mixed,
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

activityLogSchema.index({ groupId: 1 });
activityLogSchema.index({ tripId: 1 });
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ userId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
