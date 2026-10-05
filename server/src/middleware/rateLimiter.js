const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for authentication endpoints to prevent brute-force attacks.
 * Allows 10 login attempts per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Too many login attempts. For security reasons, please try again in 15 minutes.',
  },
});

/**
 * Strict rate limiter for OTP requests to prevent email inbox bombing and resource abuse.
 * Allows 5 OTP requests per 15-minute window per IP.
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many OTP requests from this network. Please wait 15 minutes before requesting a new code.',
  },
});

/**
 * General API rate limiter to protect against resource exhaustion and scraping.
 * Allows 300 requests per 15-minute window per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please slow down and try again shortly.',
  },
});

/**
 * Dedicated upload limiter to prevent Telegram MTProto FLOOD_WAIT bans and disk exhaustion.
 * Allows 30 file uploads per 15-minute window per IP.
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload limit reached for this window. Please wait a few minutes before uploading more files.',
  },
});

module.exports = {
  authLimiter,
  otpLimiter,
  apiLimiter,
  uploadLimiter,
};
