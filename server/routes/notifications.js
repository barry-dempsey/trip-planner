const express = require('express');
const User = require('../models/User');

const router = express.Router();
const MAX_TOKENS_PER_USER = 10;

// Register a device token for the current user
router.post('/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (typeof token !== 'string' || !token || token.length > 4096) {
      return res.status(400).json({ error: 'A valid token is required' });
    }

    // A device token belongs to one user at a time
    await User.updateMany({ uid: { $ne: req.user.uid } }, { $pull: { fcmTokens: token } });
    await User.updateOne({ uid: req.user.uid }, { $addToSet: { fcmTokens: token } });
    const user = await User.findOne({ uid: req.user.uid });
    if (user && user.fcmTokens.length > MAX_TOKENS_PER_USER) {
      user.fcmTokens = user.fcmTokens.slice(-MAX_TOKENS_PER_USER);
      await user.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Unregister a device token
router.delete('/token', async (req, res) => {
  try {
    await User.updateOne({ uid: req.user.uid }, { $pull: { fcmTokens: req.body.token } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
