require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./config/prisma');
const fileRoutes = require('./routes/fileRoutes');
const { initTelegramClient } = require('./config/telegram');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration allowing all origins, methods, and headers
app.use(cors());
app.options('*', cors());


// Express body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', fileRoutes);

// Health check endpoint verifying both PostgreSQL (Prisma) and Telegram status
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
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

/**
 * Boots the server: tests Prisma PostgreSQL connection, starts GramJS MTProto client,
 * and starts listening for incoming HTTP requests.
 */
async function startServer() {
  try {
    // 1. Verify PostgreSQL connection via Prisma
    console.log('📦 Connecting to PostgreSQL via Prisma...');
    await prisma.$connect();
    console.log('✅ PostgreSQL database connected successfully.');

    // 2. Initialize and authenticate GramJS MTProto Telegram Client
    console.log('📡 Initializing Telegram MTProto client...');
    await initTelegramClient();
    console.log('✅ Telegram client is connected and ready for media operations.');

    // 3. Start Express HTTP Server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on: http://localhost:${PORT}`);
      console.log(`   - Upload endpoint: POST http://localhost:${PORT}/api/upload`);
      console.log(`   - Gallery list:   GET  http://localhost:${PORT}/api/files`);
      console.log(`   - Media stream:   GET  http://localhost:${PORT}/api/stream/:messageId\n`);
    });

    // Support large 2GB file uploads without socket timeout
    server.timeout = 30 * 60 * 1000; // 30 minutes
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    if (server.requestTimeout !== undefined) {
      server.requestTimeout = 30 * 60 * 1000;
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
