const ActivityLog = require('../models/ActivityLog');

async function logActivity({
  tripId,
  groupId,
  userId,
  userEmail,
  action,
  targetType,
  targetId,
  targetDetails,
  changes,
  description,
  metadata,
}) {
  try {
    const log = new ActivityLog({
      tripId,
      groupId,
      userId,
      userEmail,
      action,
      targetType,
      targetId,
      targetDetails,
      changes,
      description,
      metadata,
      timestamp: new Date(),
    });

    await log.save();
    return log;
  } catch (err) {
    console.error('Error logging activity:', err.message);
  }
}

async function logTripUpdate(tripId, groupId, userId, userEmail, before, after, description) {
  return logActivity({
    tripId,
    groupId,
    userId,
    userEmail,
    action: 'trip_updated',
    targetType: 'trip',
    targetId: tripId.toString(),
    changes: { before, after },
    description,
  });
}

async function logItineraryChange(
  tripId,
  groupId,
  userId,
  userEmail,
  itemId,
  action,
  changes,
  description
) {
  return logActivity({
    tripId,
    groupId,
    userId,
    userEmail,
    action,
    targetType: 'itinerary',
    targetId: itemId,
    changes,
    description,
  });
}

async function logMemberChange(tripId, groupId, userId, userEmail, memberId, action, details) {
  return logActivity({
    tripId,
    groupId,
    userId,
    userEmail,
    action,
    targetType: 'member',
    targetId: memberId,
    targetDetails: details,
    description: `${action.replace(/_/g, ' ')}: ${memberId}`,
  });
}

module.exports = {
  logActivity,
  logTripUpdate,
  logItineraryChange,
  logMemberChange,
};
