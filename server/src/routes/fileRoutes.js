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
const { login, verify } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Route: POST /api/auth/login
 * Validates password and issues session token
 */
router.post('/auth/login', login);

/**
 * Route: GET /api/auth/verify
 * Validates current session token
 */
router.get('/auth/verify', authMiddleware, verify);


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
 */
router.post(
  '/upload',
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

