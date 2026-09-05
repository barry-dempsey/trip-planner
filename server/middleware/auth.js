const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      req.user = { uid: decoded.uid };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authMiddleware };
