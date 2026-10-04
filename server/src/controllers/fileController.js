const fs = require('fs');
const { CustomFile } = require('telegram/client/uploads');
const prisma = require('../config/prisma');
const { getTelegramClient, getChannelEntity } = require('../config/telegram');

// Ensure BigInt serializes cleanly to JSON across all API responses
BigInt.prototype.toJSON = function () {
  return Number(this);
};

// In-memory registry tracking real-time backend-to-Telegram MTProto upload progress
const uploadProgressMap = new Map();

/**
 * Format bytes into human-readable string (KB/s, MB/s)
 */
function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  const mb = bytesPerSec / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB/s`;
  }
  const kb = bytesPerSec / 1024;
  return `${kb.toFixed(0)} KB/s`;
}

/**
 * Format seconds into human-readable time (e.g., '1m 24s' or '45s')
 */
function formatETA(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
  if (seconds > 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
  if (seconds > 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  return `${Math.ceil(seconds)}s`;
}

/**
 * Retrieves the current real-time Telegram upload progress for a specific uploadId.
 */
function getUploadProgress(req, res) {
  const { uploadId } = req.params;
  const progress = uploadProgressMap.get(uploadId);

  if (!progress) {
    return res.status(200).json({
      status: 'idle',
      percent: 0,
    });
  }

  return res.status(200).json(progress);
}

/**
 * High-speed multi-worker upload to Telegram blob storage with real-time MTProto progress tracking.
 */
async function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was uploaded in the request.' });
  }

  const uploadId = req.headers['x-upload-id'] || req.query.uploadId || null;
  const tempFilePath = req.file.path;
  const fileName = req.file.originalname;
  const mimeType = req.file.mimetype;
  const size = req.file.size;

  const startTime = Date.now();
  let lastUpdate = Date.now();
  let lastBytes = 0;

  if (uploadId) {
    uploadProgressMap.set(uploadId, {
      uploadId,
      fileName,
      status: 'telegram_upload',
      percent: 0,
      uploadedBytes: 0,
      totalBytes: size,
      speed: 'Initializing MTProto stream...',
      eta: 'Calculating...',
    });
  }

  try {
    console.log(`📤 Starting Telegram upload: ${fileName} (${(size / (1024 * 1024)).toFixed(2)} MB)`);

    const client = await getTelegramClient();
    const channel = await getChannelEntity(client);

    // Create GramJS CustomFile from temporary disk buffer
    const toUpload = new CustomFile(fileName, size, tempFilePath);

    // Configurable parallel workers: 8 parallel MTProto chunks for high-speed transfers
    const workers = parseInt(process.env.TELEGRAM_UPLOAD_WORKERS || '8', 10);

    // Send file to the private Telegram channel with real-time chunk progress callback
    const message = await client.sendFile(channel, {
      file: toUpload,
      caption: fileName,
      forceDocument: true, // Prevents Telegram transcoding errors & preserves full quality
      workers: workers, // 8 parallel connections maximize upload throughput
      progressCallback: (progress) => {
        // GramJS yields a float 0.0 - 1.0 (or total bytes depending on version)
        let percent = 0;
        let uploaded = 0;

        if (progress <= 1) {
          percent = Math.min(100, Math.round(progress * 100));
          uploaded = Math.round(progress * size);
        } else {
          uploaded = Math.min(size, progress);
          percent = Math.min(100, Math.round((uploaded / size) * 100));
        }

        const now = Date.now();
        const elapsedSec = (now - startTime) / 1000;

        // Calculate moving speed
        const bytesPerSec = elapsedSec > 0 ? uploaded / elapsedSec : 0;
        const remainingBytes = size - uploaded;
        const etaSeconds = bytesPerSec > 0 ? remainingBytes / bytesPerSec : 0;

        if (uploadId) {
          uploadProgressMap.set(uploadId, {
            uploadId,
            fileName,
            status: 'telegram_upload',
            percent,
            uploadedBytes: uploaded,
            totalBytes: size,
            speed: formatSpeed(bytesPerSec),
            speedBytesPerSec: bytesPerSec,
            eta: formatETA(etaSeconds),
            etaSeconds: Math.round(etaSeconds),
          });
        }
      },
    });

    console.log(`✅ Upload complete! Telegram Message ID: ${message.id}`);

    // Persist file metadata in PostgreSQL using Prisma
    const fileRecord = await prisma.file.create({
      data: {
        fileName,
        mimeType,
        size: BigInt(size),
        telegramMessageId: message.id,
      },
    });

    if (uploadId) {
      uploadProgressMap.set(uploadId, {
        uploadId,
        fileName,
        status: 'completed',
        percent: 100,
        uploadedBytes: size,
        totalBytes: size,
        speed: 'Finished',
        eta: '0s',
      });
      // Clean up progress after 20 seconds
      setTimeout(() => uploadProgressMap.delete(uploadId), 20000);
    }

    return res.status(201).json({
      success: true,
      message: 'File successfully stored in Telegram channel and indexed in database.',
      data: {
        ...fileRecord,
        size: Number(fileRecord.size),
      },
    });
  } catch (error) {
    console.error('❌ Error during uploadFile:', error);

    if (uploadId) {
      uploadProgressMap.set(uploadId, {
        uploadId,
        status: 'failed',
        error: error.message,
      });
      setTimeout(() => uploadProgressMap.delete(uploadId), 15000);
    }

    return res.status(500).json({
      error: 'Upload failed',
      details: error.message,
    });
  } finally {
    // Always clean up the local temporary file from disk immediately
    fs.unlink(tempFilePath, (err) => {
      if (err) {
        console.warn(`⚠️ Could not remove temp file at ${tempFilePath}:`, err.message);
      } else {
        console.log(`🧹 Cleaned up temporary buffer: ${tempFilePath}`);
      }
    });
  }
}

/**
 * Retrieves all file metadata records from PostgreSQL via Prisma,
 * ordered by newest first (createdAt: desc).
 */
async function listFiles(req, res) {
  try {
    const files = await prisma.file.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedFiles = files.map((file) => ({
      ...file,
      size: Number(file.size),
    }));

    return res.status(200).json({
      success: true,
      count: formattedFiles.length,
      data: formattedFiles,
    });
  } catch (error) {
    console.error('❌ Error in listFiles:', error);
    return res.status(500).json({
      error: 'Failed to retrieve media gallery list from database',
      details: error.message,
    });
  }
}

/**
 * Streams media binary chunks directly from Telegram MTProto to the HTTP response.
 * Uses 1MB chunk buffers for fast video playback and image rendering.
 */
async function streamFile(req, res) {
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid telegramMessageId parameter.' });
  }

  try {
    const fileMeta = await prisma.file.findUnique({
      where: {
        telegramMessageId: messageId,
      },
    });

    const client = await getTelegramClient();
    const channel = await getChannelEntity(client);

    const messages = await client.getMessages(channel, { ids: [messageId] });

    if (!messages || messages.length === 0 || !messages[0] || !messages[0].media) {
      return res.status(404).json({ error: 'Media not found in Telegram channel.' });
    }

    const message = messages[0];
    const mimeType = fileMeta ? fileMeta.mimeType : 'application/octet-stream';
    const fileSize = fileMeta ? Number(fileMeta.size) : null;
    const fileName = fileMeta ? fileMeta.fileName : `telegram_media_${messageId}`;

    // Set streaming headers for in-browser rendering and caching
    res.setHeader('Content-Type', mimeType);
    if (fileSize) {
      res.setHeader('Content-Length', fileSize);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    let isClientDisconnected = false;
    req.on('close', () => {
      isClientDisconnected = true;
    });

    // Pipe 1MB chunks continuously for fast streaming
    for await (const chunk of client.iterDownload({
      file: message.media,
      requestSize: 1024 * 1024, // 1MB buffer per chunk for faster throughput
    })) {
      if (isClientDisconnected || res.writableEnded) {
        break;
      }
      res.write(chunk);
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    console.error(`❌ Error streaming messageId ${messageId}:`, error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to stream media from Telegram',
        details: error.message,
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

/**
 * Deletes a file from Telegram channel and PostgreSQL database
 */
async function deleteFile(req, res) {
  const messageId = parseInt(req.params.messageId, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid telegramMessageId parameter.' });
  }

  try {
    const client = await getTelegramClient();
    const channel = await getChannelEntity(client);

    // Delete message from Telegram channel
    await client.deleteMessages(channel, [messageId], { revoke: true });

    // Delete record from PostgreSQL via Prisma
    await prisma.file.deleteMany({
      where: {
        telegramMessageId: messageId,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'File deleted from Telegram channel and PostgreSQL database.',
    });
  } catch (error) {
    console.error(`❌ Error deleting messageId ${messageId}:`, error);
    return res.status(500).json({
      error: 'Failed to delete file',
      details: error.message,
    });
  }
}

module.exports = {
  uploadFile,
  listFiles,
  streamFile,
  deleteFile,
  getUploadProgress,
};
