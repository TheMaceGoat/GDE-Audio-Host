const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { put, del } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');

const app = express();

// Automatically connects using the environment variables injected by Vercel
const redis = Redis.fromEnv();

const storage = multer.memoryStorage();

const audioFilter = (req, file, cb) => {
  const allowedMime = /^audio\//i.test(file.mimetype);
  const allowedExt = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.originalname);
  if (allowedMime || allowedExt) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter: audioFilter,
  limits: { fileSize: 4.5 * 1024 * 1024 } // Vercel payload limit constraint
});

app.use(cors());

// Fetch metadata array from Upstash Redis
app.get('/uploads.json', async (req, res) => {
  try {
    const uploadsMetadata = await redis.get('uploadsMetadata') || [];
    res.json(uploadsMetadata);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve metadata.' });
  }
});

// Upload endpoint
app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  try {
    const uploadsMetadata = await redis.get('uploadsMetadata') || [];

    // Check for exact duplicates
    const duplicate = uploadsMetadata.find((item) => {
      return item.originalName === req.file.originalname && item.size === req.file.size && item.mimeType === req.file.mimetype;
    });

    if (duplicate) {
      return res.json({
        url: duplicate.url,
        name: duplicate.originalName,
        size: duplicate.size,
        uploadedAt: duplicate.uploadedAt,
        duplicate: true
      });
    }

    // Stream directly from RAM buffer to Vercel Blob
    const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const blob = await put(`uploads/${safeName}`, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype
    });

    const uploadedAt = new Date().toISOString();

    const entry = {
      id: safeName,
      filename: safeName,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: blob.url,
      uploadedAt
    };

    uploadsMetadata.unshift(entry);
    await redis.set('uploadsMetadata', uploadsMetadata);

    res.json({
      url: blob.url,
      name: entry.originalName,
      size: entry.size,
      uploadedAt: entry.uploadedAt,
      duplicate: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Upload failed.' });
  }
});

// Delete endpoint
app.delete('/upload/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const uploadsMetadata = await redis.get('uploadsMetadata') || [];
    const index = uploadsMetadata.findIndex((item) => item.id === fileId);

    if (index === -1) {
      return res.status(404).json({ error: 'Upload not found.' });
    }

    // Delete from cloud storage using its public URL
    await del(uploadsMetadata[index].url);

    // Remove item from database array
    uploadsMetadata.splice(index, 1);
    await redis.set('uploadsMetadata', uploadsMetadata);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete asset.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'An error occurred.' });
  }
  next();
});

module.exports = app;
