const { verifyToken } = require('../services/auth');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authMiddleware };
