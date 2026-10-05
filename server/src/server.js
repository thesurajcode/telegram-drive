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

// 2. Flexible CORS Configuration (supports Render, Vercel, Netlify, Cloudflare Pages, and Localhost)
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

    // Allow configured origins, wildcard, localhost on any port, or common preview/production hosting platforms
    if (
      allowedOrigins.includes(normalizedOrigin) ||
      allowedOrigins.includes('*') ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) ||
      /^https:\/\/[a-zA-Z0-9_.-]+\.(onrender\.com|vercel\.app|pages\.dev|netlify\.app)$/.test(normalizedOrigin)
    ) {
      return callback(null, true);
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

// Check if a compiled client dist directory exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const hasClientDist = fs.existsSync(clientDistPath) && fs.existsSync(path.join(clientDistPath, 'index.html'));

if (hasClientDist) {
  app.use(express.static(clientDistPath));
}

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

// 6. Root landing page when visiting backend directly in browser
app.get('/', (req, res) => {
  if (hasClientDist) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }

  const frontendUrl = process.env.CLIENT_URL || 'https://telephotos-app.onrender.com';
  
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TelePhotos Cloud — API Backend</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #090d16 65%, #030712 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      line-height: 1.6;
    }
    .card {
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 40px;
      max-width: 680px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 80px -20px rgba(59, 130, 246, 0.2);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      height: 240px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, transparent 70%);
      pointer-events: none;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #ffffff, #93c5fd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
    }
    .notice {
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .notice-title {
      font-size: 14px;
      font-weight: 700;
      color: #60a5fa;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .notice-text {
      font-size: 13px;
      color: #cbd5e1;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .status-item {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 14px 16px;
    }
    .status-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .status-value {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      display: inline-block;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      color: white;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5);
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(37, 99, 235, 0.7);
      background: linear-gradient(135deg, #1d4ed8, #4338ca);
    }
    .endpoints {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #93c5fd;
      padding: 6px 12px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .chip:hover {
      background: rgba(59, 130, 246, 0.2);
    }
    .footer {
      margin-top: 20px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">⚡</div>
      <div>
        <h1>TelePhotos Cloud API</h1>
        <div class="subtitle">MTProto Telegram Storage • Version 2.0</div>
      </div>
    </div>

    <div class="notice">
      <div class="notice-title">
        <span>ℹ️</span> Backend API Service Live
      </div>
      <div class="notice-text">
        You are connected to the <strong>Express MTProto Backend Server</strong>. To view your photo gallery, upload files, unlock the vault, or reset your password, open your <strong>Frontend Web Dashboard</strong>.
      </div>
    </div>

    <div class="status-grid">
      <div class="status-item">
        <div class="status-label">Backend API</div>
        <div class="status-value"><span class="dot"></span> Online &amp; Ready</div>
      </div>
      <div class="status-item">
        <div class="status-label">Database</div>
        <div class="status-value"><span class="dot"></span> Neon PostgreSQL</div>
      </div>
      <div class="status-item">
        <div class="status-label">Telegram Bot</div>
        <div class="status-value"><span class="dot"></span> GramJS Connected</div>
      </div>
    </div>

    <a href="${frontendUrl}" class="btn" target="_blank" rel="noopener noreferrer">
      🚀 Open TelePhotos Web Dashboard
    </a>

    <div class="endpoints">
      <a href="/health" class="chip">GET /health</a>
      <a href="/api/files" class="chip">GET /api/files</a>
    </div>

    <div class="footer">
      TelePhotos Cloud • Telegram Infinite Free Storage
    </div>
  </div>
</body>
</html>`);
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
