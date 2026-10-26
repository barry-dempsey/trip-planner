const jwt = require('jsonwebtoken');

const TOKEN_TTL = '7d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  return secret;
}

function signToken(uid) {
  return jwt.sign({ uid }, getSecret(), { algorithm: 'HS256', expiresIn: TOKEN_TTL });
}

// Returns the decoded payload or throws if the token is invalid/expired
function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

module.exports = { signToken, verifyToken, getSecret };
