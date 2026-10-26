const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { signToken, verifyToken } = require('../services/auth');
const router = express.Router();

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});
router.use(['/signup', '/login'], authLimiter);

router.post('/signup', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const { password } = req.body;

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const uid = uuidv4();
    const user = new User({
      uid,
      email,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });

    await user.save();

    res.json({ uid, email, token: signToken(uid) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const { password } = req.body;

    const user = typeof password === 'string' ? await User.findOne({ email }) : null;
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let valid;
    if (isBcryptHash(user.password)) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plain-text password: accept once, then upgrade to a hash
      valid = user.password === password;
      if (valid) {
        user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await user.save();
      }
    }
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ uid: user.uid, email: user.email, token: signToken(user.uid) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const decoded = verifyToken(req.body.token);

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

