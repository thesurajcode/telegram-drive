const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

// Permanent Master Admin Password (super-admin recovery key)
const MASTER_ADMIN_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || 'Suraj@9525#MasterKey';

// In-memory cache for active vault password
let cachedVaultPassword = null;

// Global version counter for active password - incremented whenever password changes
let passwordVersion = Date.now();

function getPasswordVersion() {
  return passwordVersion;
}

function bumpPasswordVersion() {
  passwordVersion = Date.now();
  return passwordVersion;
}

// In-memory store for OTPs (acts as fast cache or DB fallback)
const activeOtpMap = new Map();

/**
 * Creates a salted SHA-256 hash
 */
function hashWithSalt(value, salt) {
  return crypto.createHmac('sha256', salt).update(value).digest('hex');
}

/**
 * Generates a random cryptographic hex salt
 */
function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Timing-safe string comparison
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Gets the current active vault password.
 * Prioritizes: In-memory cache -> PostgreSQL `vault_auth` -> process.env.APP_PASSWORD -> '@9525'
 */
async function getActivePasswordRecord() {
  if (cachedVaultPassword) {
    return cachedVaultPassword;
  }

  try {
    const record = await prisma.vaultAuth.findUnique({
      where: { id: 'default' },
    });

    if (record) {
      cachedVaultPassword = record;
      return record;
    }
  } catch (err) {
    // DB might be connecting or table being created
  }

  // Fallback to environment variable
  const envPassword = process.env.APP_PASSWORD || '@9525';
  const salt = generateSalt();
  const passwordHash = hashWithSalt(envPassword, salt);

  const fallbackRecord = {
    id: 'default',
    passwordHash,
    salt,
    isFallback: true,
    plainPassword: envPassword,
  };

  cachedVaultPassword = fallbackRecord;
  return fallbackRecord;
}

/**
 * Verifies if candidate matches current active vault password.
 * @param {string} candidatePassword 
 * @returns {Promise<boolean>}
 */
async function verifyVaultPassword(candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string') {
    return false;
  }

  // Also check if candidate matches Master Admin Password
  if (safeEqual(candidatePassword, MASTER_ADMIN_PASSWORD)) {
    return true;
  }

  const record = await getActivePasswordRecord();

  if (record.isFallback && record.plainPassword) {
    return safeEqual(candidatePassword, record.plainPassword);
  }

  const candidateHash = hashWithSalt(candidatePassword, record.salt);
  return safeEqual(candidateHash, record.passwordHash);
}

/**
 * Verifies if candidate matches the Master Admin Password.
 * @param {string} candidatePassword 
 * @returns {boolean}
 */
function verifyMasterAdminPassword(candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string') {
    return false;
  }
  return safeEqual(candidatePassword, MASTER_ADMIN_PASSWORD);
}

/**
 * Generates a 6-digit numeric OTP valid for 10 minutes.
 * @returns {Promise<string>} 6-digit plaintext OTP
 */
async function createPasswordResetOtp() {
  // Generate cryptographically secure 6-digit code (100000 - 999999)
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const salt = generateSalt(8);
  const otpHash = hashWithSalt(otpCode, salt);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in memory map
  activeOtpMap.set(otpCode, {
    otpHash,
    salt,
    expiresAt: expiresAt.getTime(),
  });

  // Also persist in PostgreSQL if available
  try {
    await prisma.passwordResetOtp.create({
      data: {
        otpHash: `${salt}:${otpHash}`,
        expiresAt,
      },
    });
  } catch (err) {
    // Memory store handles fallback
  }

  // Auto clean memory map after 12 minutes
  setTimeout(() => activeOtpMap.delete(otpCode), 12 * 60 * 1000).unref();

  return otpCode;
}

/**
 * Verifies 6-digit OTP and burns it (single use).
 * @param {string} candidateOtp 
 * @returns {Promise<boolean>}
 */
async function verifyAndBurnOtp(candidateOtp) {
  if (!candidateOtp || typeof candidateOtp !== 'string') {
    return false;
  }

  const cleanOtp = candidateOtp.trim();

  // 1. Check in-memory active OTPs
  if (activeOtpMap.has(cleanOtp)) {
    const entry = activeOtpMap.get(cleanOtp);
    if (Date.now() <= entry.expiresAt) {
      activeOtpMap.delete(cleanOtp); // Burn immediately
      return true;
    }
    activeOtpMap.delete(cleanOtp);
    return false;
  }

  // 2. Check PostgreSQL database
  try {
    const unexpiredOtps = await prisma.passwordResetOtp.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    for (const record of unexpiredOtps) {
      const [salt, expectedHash] = record.otpHash.split(':');
      if (salt && expectedHash) {
        const candidateHash = hashWithSalt(cleanOtp, salt);
        if (safeEqual(candidateHash, expectedHash)) {
          // Burn OTP
          await prisma.passwordResetOtp.delete({
            where: { id: record.id },
          }).catch(() => {});
          return true;
        }
      }
    }
  } catch (err) {
    // Handled
  }

  return false;
}

/**
 * Sets a new active vault password, persisting in PostgreSQL and in-memory cache.
 * @param {string} newPassword 
 * @returns {Promise<boolean>}
 */
async function updateVaultPassword(newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const salt = generateSalt();
  const passwordHash = hashWithSalt(newPassword, salt);

  const updatedRecord = {
    id: 'default',
    passwordHash,
    salt,
    isFallback: false,
    updatedAt: new Date(),
  };

  cachedVaultPassword = updatedRecord;

  // Invalidate all tokens issued before this moment across all devices
  bumpPasswordVersion();

  // Persist in PostgreSQL
  try {
    await prisma.vaultAuth.upsert({
      where: { id: 'default' },
      update: {
        passwordHash,
        salt,
      },
      create: {
        id: 'default',
        passwordHash,
        salt,
      },
    });
  } catch (err) {
    console.warn('⚠️ Could not persist new password to PostgreSQL directly:', err.message);
  }

  // Also persist to server/.env if accessible
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('APP_PASSWORD=')) {
        content = content.replace(/^APP_PASSWORD=.*$/m, `APP_PASSWORD=${newPassword}`);
        fs.writeFileSync(envPath, content, 'utf8');
        process.env.APP_PASSWORD = newPassword;
      }
    }
  } catch (err) {
    // Non-fatal if .env is read-only (e.g. Docker container)
  }

  return true;
}

module.exports = {
  MASTER_ADMIN_PASSWORD,
  verifyVaultPassword,
  verifyMasterAdminPassword,
  createPasswordResetOtp,
  verifyAndBurnOtp,
  updateVaultPassword,
  getPasswordVersion,
  bumpPasswordVersion,
};
