const crypto = require('crypto');

// Master password configured in environment
const MASTER_PASSWORD = process.env.APP_PASSWORD || '@9525';
const AUTH_SECRET = process.env.AUTH_SECRET || 'telephotos-cloud-auth-salt-2026-v2';

// Token lifetime: 7 days by default
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

if (process.env.NODE_ENV === 'production') {
  if (MASTER_PASSWORD === '@9525') {
    console.warn('⚠️ SECURITY WARNING: You are running in production with the default APP_PASSWORD="@9525". Please change it in your .env file!');
  }
  if (!process.env.AUTH_SECRET) {
    console.warn('⚠️ SECURITY WARNING: AUTH_SECRET is not set in your .env. Set a random 32+ character secret for secure cryptographic signing.');
  }
}

/**
 * Timing-safe password verification to eliminate timing attacks.
 * @param {string} candidatePassword 
 * @returns {boolean}
 */
function verifyPassword(candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string') {
    return false;
  }

  // Hash both with SHA-256 so buffers have identical length for crypto.timingSafeEqual
  const candidateHash = crypto.createHash('sha256').update(candidatePassword).digest();
  const masterHash = crypto.createHash('sha256').update(MASTER_PASSWORD).digest();

  return crypto.timingSafeEqual(candidateHash, masterHash);
}

// Import getPasswordVersion from vaultAuthService to support instant session revocation
const { getPasswordVersion } = require('../services/vaultAuthService');

/**
 * Generates a tamper-proof, cryptographically signed token with expiration and random nonce.
 * Format: <base64url(payload)>.<hmac_signature>
 * @param {number} ttlMs 
 * @returns {string} Signed token
 */
function generateSignedToken(ttlMs = TOKEN_TTL_MS) {
  const now = Date.now();
  const currentPv = typeof getPasswordVersion === 'function' ? getPasswordVersion() : 0;
  const payload = {
    iat: now,
    exp: now + ttlMs,
    pv: currentPv,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Validates a signed session token.
 * Checks HMAC signature with timing-safe comparison, checks token expiration,
 * and checks passwordVersion to ensure all previous sessions are revoked on password change.
 * @param {string} token 
 * @returns {boolean} True if valid and not expired
 */
function verifySignedToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [payloadB64, signature] = parts;

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || typeof payload.exp !== 'number') {
      return false;
    }

    if (Date.now() > payload.exp) {
      return false; // Expired token
    }

    // Session revocation check: if password was changed after this token was issued, invalidate it!
    const currentPv = typeof getPasswordVersion === 'function' ? getPasswordVersion() : 0;
    if (currentPv > 0 && (!payload.pv || payload.pv < currentPv)) {
      return false; // Revoked due to password change
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Authentication middleware protecting all API endpoints and media streams.
 * Accepts signed tokens via:
 * 1. Authorization: Bearer <signed_token>
 * 2. Query param ?token=<signed_token> (used for direct <img>, <video>, <audio>, <iframe> streams)
 * 3. x-access-token header
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

  let candidateToken = null;

  // Check 1: Bearer token in Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    candidateToken = authHeader.slice(7).trim();
  }

  // Check 2: Token query parameter (used for media streaming tags)
  if (!candidateToken && req.query.token) {
    candidateToken = req.query.token;
  }

  // Check 3: x-access-token header
  if (!candidateToken && req.headers['x-access-token']) {
    candidateToken = req.headers['x-access-token'];
  }

  if (candidateToken && verifySignedToken(candidateToken)) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Access denied: Valid session token required to access Telegram Drive.',
  });
}

module.exports = {
  MASTER_PASSWORD,
  verifyPassword,
  generateSignedToken,
  verifySignedToken,
  authMiddleware,
};
