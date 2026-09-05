const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const router = express.Router();

// Mock JWT token creation
const createMockToken = (uid) => {
  return Buffer.from(JSON.stringify({ uid, iat: Date.now() })).toString('base64');
};

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const uid = uuidv4();
    const user = new User({
      uid,
      email,
      password, // In production, hash this!
    });

    await user.save();

    const token = createMockToken(uid);
    res.json({ uid, email, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createMockToken(user.uid);
    res.json({ uid: user.uid, email: user.email, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const user = await User.findOne({ uid: decoded.uid });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ uid: user.uid, email: user.email });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
