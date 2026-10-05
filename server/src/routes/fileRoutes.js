const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  uploadFile,
  listFiles,
  streamFile,
  deleteFile,
  getUploadProgress,
} = require('../controllers/fileController');
const {
  login,
  verify,
  requestPasswordResetOtp,
  resetPassword,
  changePassword,
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter, otpLimiter, uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * Route: POST /api/auth/login
 * Validates master password with brute-force protection and issues session token
 */
router.post('/auth/login', authLimiter, login);

/**
 * Route: GET /api/auth/verify
 * Validates current session token
 */
router.get('/auth/verify', authMiddleware, verify);

/**
 * Route: POST /api/auth/request-otp
 * Dispatches 6-digit OTP strictly to surajchandan09@gmail.com
 */
router.post('/auth/request-otp', otpLimiter, requestPasswordResetOtp);

/**
 * Route: POST /api/auth/reset-password
 * Resets vault password using Email OTP or Master Admin Password
 */
router.post('/auth/reset-password', authLimiter, resetPassword);

/**
 * Route: POST /api/auth/change-password
 * Allows authenticated user to update vault password
 */
router.post('/auth/change-password', authMiddleware, changePassword);

// Ensure temporary uploads directory exists
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration for temporary buffer before GramJS upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate safe unique filename to avoid collision in temp directory
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

// Multer upload instance with 2GB limit (MTProto supports up to 2GB/4GB)
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB
  },
});

/**
 * Route: POST /api/upload
 * Accepts multipart/form-data with field name 'file'
 * Protected by authMiddleware and uploadLimiter
 */
router.post(
  '/upload',
  uploadLimiter,
  authMiddleware,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ Multer upload error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File exceeds 2 GB limit.' });
        }
        return res.status(400).json({ error: err.message || 'File upload error.' });
      }
      next();
    });
  },
  uploadFile
);

/**
 * Route: GET /api/upload-progress/:uploadId
 * Returns real-time Telegram MTProto upload progress and speed
 */
router.get('/upload-progress/:uploadId', authMiddleware, getUploadProgress);

/**
 * Route: GET /api/files
 * Returns gallery list with metadata for all uploaded media
 */
router.get('/files', authMiddleware, listFiles);

/**
 * Route: GET /api/stream/:messageId
 * Streams media directly from Telegram MTProto to the browser
 */
router.get('/stream/:messageId', authMiddleware, streamFile);

/**
 * Route: DELETE /api/files/:messageId
 * Optional: Delete media from Telegram and PostgreSQL
 */
router.delete('/files/:messageId', authMiddleware, deleteFile);

module.exports = router;
