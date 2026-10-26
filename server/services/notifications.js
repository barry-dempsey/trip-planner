const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/User');

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// Fire-and-forget push to the given users. `url` is the in-app path opened on click. Never throws.
async function notifyUsers(users, { title, body, groupId, url }) {
  try {
    const tokens = [...new Set(users.flatMap((u) => u.fcmTokens || []))];
    if (tokens.length === 0) return;

    const data = {};
    if (groupId) data.groupId = String(groupId);
    if (url) data.url = url;

    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const result = await getMessaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data,
      });

      const stale = batch.filter(
        (_, idx) =>
          !result.responses[idx].success &&
          INVALID_TOKEN_CODES.has(result.responses[idx].error?.code)
      );
      if (stale.length) {
        await User.updateMany({}, { $pull: { fcmTokens: { $in: stale } } });
      }
    }
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

// Push to every active trip member except the actor
async function notifyTrip(trip, excludeUid, { title, body }) {
  try {
    const uids = trip.members
      .filter((m) => m.status === 'active' && m.userId && m.userId !== excludeUid)
      .map((m) => m.userId);
    if (uids.length === 0) return;

    const users = await User.find({ uid: { $in: uids }, 'fcmTokens.0': { $exists: true } });
    await notifyUsers(users, { title, body, groupId: trip.groupId });
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

// Push to the account registered with this email, if there is one
async function notifyEmail(email, { title, body, url }) {
  try {
    const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      email: new RegExp(`^${escaped}$`, 'i'),
      'fcmTokens.0': { $exists: true },
    });
    if (user) await notifyUsers([user], { title, body, url });
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

module.exports = { notifyTrip, notifyUsers, notifyEmail };

