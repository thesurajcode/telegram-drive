require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const prisma = require('./config/prisma');
const fileRoutes = require('./routes/fileRoutes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initTelegramClient } = require('./config/telegram');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust first proxy when running behind reverse proxy (Render, Docker, Nginx, Cloudflare)
// Required for accurate client IP resolution in express-rate-limit
app.set('trust proxy', 1);

// 1. HTTP Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Handled per streaming route to allow media playback
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows <img> and <video> tags to render streams
  })
);

// 2. Strict CORS Configuration
const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrls
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server health checks, curl, Telegram webhooks)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check exact match in configured allowed origins
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // In local development, automatically allow localhost and 127.0.0.1 on any port
    if (process.env.NODE_ENV !== 'production') {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
        return callback(null, true);
      }
    }

    return callback(new Error(`Origin ${origin} is blocked by CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'x-upload-id'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 3. Express body parsers with payload size limits to mitigate JSON bomb DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. API Rate Limiting & Routes
app.use('/api', apiLimiter, fileRoutes);

// 5. Health check endpoint verifying both PostgreSQL (Prisma) and Telegram status
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message || err);
  const status = err.status || (err.message && err.message.includes('CORS') ? 403 : 500);
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

/**
 * Sweeps the temporary uploads directory and deletes abandoned or crashed uploads older than maxAgeMs
 */
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
function cleanOrphanedUploads(maxAgeMs = 2 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return;
    const now = Date.now();
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const fullPath = path.join(UPLOADS_DIR, file);
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          console.log(`🧹 Cleaned up orphaned temp file: ${file}`);
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn('⚠️ Error during temp uploads cleanup:', err.message);
  }
}

/**
 * Boots the server: tests Prisma PostgreSQL connection, starts GramJS MTProto client,
 * runs temporary storage cleanup, and starts listening for incoming HTTP requests.
 */
async function startServer() {
  try {
    // 1. Verify PostgreSQL connection via Prisma
    console.log('📦 Connecting to PostgreSQL via Prisma...');
    await prisma.$connect();
    console.log('✅ PostgreSQL database connected successfully.');

    // Clean any leftover upload files from previous runs
    cleanOrphanedUploads();
    // Schedule periodic cleanup every 1 hour
    setInterval(() => cleanOrphanedUploads(), 60 * 60 * 1000);

    // 2. Start Express HTTP Server FIRST so hosting providers (e.g. Render) detect the open port immediately
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server is running on: http://0.0.0.0:${PORT}`);
      console.log(`   - Upload endpoint: POST http://0.0.0.0:${PORT}/api/upload`);
      console.log(`   - Gallery list:   GET  http://0.0.0.0:${PORT}/api/files`);
      console.log(`   - Media stream:   GET  http://0.0.0.0:${PORT}/api/stream/:messageId\n`);
    });

    // Support large 2GB file uploads without socket timeout
    server.timeout = 30 * 60 * 1000; // 30 minutes
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    if (server.requestTimeout !== undefined) {
      server.requestTimeout = 30 * 60 * 1000;
    }

    // 3. Initialize and authenticate GramJS MTProto Telegram Client
    console.log('📡 Initializing Telegram MTProto client...');
    try {
      await initTelegramClient();
      console.log('✅ Telegram client is connected and ready for media operations.');
    } catch (telegramErr) {
      console.warn('⚠️ Telegram initial connection notice:', telegramErr.message || telegramErr);
      console.log('🔄 Telegram client will connect upon first media request via getTelegramClient().');
    }

    // Graceful shutdown
    const handleShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log('📦 Prisma disconnected.');
        } catch (err) {
          console.error('Error disconnecting Prisma:', err.message);
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
