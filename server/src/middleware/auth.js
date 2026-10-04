const crypto = require('crypto');

// Master password configured in environment (default @9525 as requested)
const MASTER_PASSWORD = process.env.APP_PASSWORD || '@9525';
const AUTH_SECRET = process.env.AUTH_SECRET || 'telephotos-cloud-auth-salt-2026';

/**
 * Generate a deterministic HMAC session token from master password and secret
 */
function generateToken() {
  return crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(MASTER_PASSWORD)
    .digest('hex');
}

const VALID_TOKEN = generateToken();

/**
 * Authentication middleware protecting all API endpoints and media streams.
 * Supports:
 * 1. Authorization: Bearer <token>
 * 2. Query param ?token=<token> (required for <img>, <video>, <audio>, <iframe>)
 * 3. Direct master password fallback
 */
function authMiddleware(req, res, next) {
  // If master password is explicitly disabled by setting empty string
  if (!MASTER_PASSWORD) {
    return next();
  }

  // Preflight requests can bypass
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Check 1: Bearer token in Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === VALID_TOKEN || token === MASTER_PASSWORD) {
      return next();
    }
  }

  // Check 2: Token query parameter (used for <img>, <video>, <audio>, <iframe> direct streams)
  const queryToken = req.query.token;
  if (queryToken && (queryToken === VALID_TOKEN || queryToken === MASTER_PASSWORD)) {
    return next();
  }

  // Check 3: x-access-token header
  const xToken = req.headers['x-access-token'];
  if (xToken && (xToken === VALID_TOKEN || xToken === MASTER_PASSWORD)) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Access denied: Master password required to access Telegram Drive.',
  });
}

module.exports = {
  MASTER_PASSWORD,
  VALID_TOKEN,
  authMiddleware,
};
