const mongoose = require('mongoose');

const fileMetadataSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
    },
    size: {
      type: Number,
      required: [true, 'File size in bytes is required'],
    },
    telegramMessageId: {
      type: Number,
      required: [true, 'Telegram message ID is required'],
      unique: true,
      index: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual property to identify if the file is a video
fileMetadataSchema.virtual('isVideo').get(function () {
  return this.mimeType ? this.mimeType.startsWith('video/') : false;
});

// Virtual property to identify if the file is an image
fileMetadataSchema.virtual('isImage').get(function () {
  return this.mimeType ? this.mimeType.startsWith('image/') : false;
});

fileMetadataSchema.set('toJSON', { virtuals: true });
fileMetadataSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FileMetadata', fileMetadataSchema);
