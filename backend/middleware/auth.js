const jwt = require('jsonwebtoken');

// The repo is public, so a hard-coded fallback secret would let anyone forge
// tokens. Only allow the fallback for local development.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'development' ? 'local-dev-only-secret' : null);

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to backend/.env (see .env.example).');
  process.exit(1);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}

module.exports = { authenticateToken, optionalAuth, JWT_SECRET };
