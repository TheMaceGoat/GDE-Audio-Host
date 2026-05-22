const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { del, handleUpload } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');

const app = express();
const redis = Redis.fromEnv();

// CRITICAL: Enable parsing for client-side JSON metadata payloads
app.use(express.json());
app.use(cors());

// Serve the 'public' folder as static web assets
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve index.html for the root route homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 🔒 VERCEL BLOB DIRECT CLIENT UPLOAD SECURITY PROTOCOL
 * This handles the security handshake to generate upload permissions
 * directly for the browser, completely bypassing the 4.5MB function barrier.
 */
app.post('/api/upload', async (request, response) => {
  try {
    const jsonResponse = await handleUpload({
      body: request.body,
      request: request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          allowedContentTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/x-m4a'],
          maximumSizeInBytes: 50 * 1024 * 1024, // Enforce a 50MB file size boundary
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Handled asynchronously after complete upload completion
        console.log('Blob direct storage commit successful:', blob.url);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
});

/**
 * 🗄️ INDEX METADATA MANIFEST ENDPOINT
 * Fetches the registered array logs matching existing audio allocations
 */
app.get('/uploads.json', async (req, res) => {
  try {
    const uploadsMetadata = await redis.get('uploadsMetadata') || [];
    res.json(uploadsMetadata);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve metadata matrix logs.' });
  }
});

/**
 * 📥 SAVE METADATA ENDPOINT
 * Receives the final public URL structural object payload directly from 
 * the frontend client to push tracking indices securely to Upstash Redis.
 */
app.post('/upload', async (req, res) => {
  const { originalName, size, mimeType, url } = req.body;

  if (!url || !originalName) {
    return res.status(400).json({ error: 'Missing audio allocation metadata keys.' });
  }

  try {
    const uploadsMetadata = await redis.get('uploadsMetadata') || [];

    // Enforce exact duplication boundaries
    const duplicate = uploadsMetadata.find((item) => {
      return item.originalName === originalName && item.size === size && item.mimeType === mimeType;
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

    const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const uploadedAt = new Date().toISOString();

    const entry = {
      id: safeName,
      filename: safeName,
      originalName,
      size,
      mimeType,
      url,
      uploadedAt
    };

    uploadsMetadata.unshift(entry);
    await redis.set('uploadsMetadata', uploadsMetadata);

    res.json({
      url,
      name: entry.originalName,
      size: entry.size,
      uploadedAt: entry.uploadedAt,
      duplicate: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Saving transaction failed.' });
  }
});

/**
 * 🗑️ FILE REMOVAL CASCADE ENDPOINT
 * Strips instances away from cloud storage maps and cleans array entries
 */
app.delete('/upload/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const uploadsMetadata = await redis.get('uploadsMetadata') || [];
    const index = uploadsMetadata.findIndex((item) => item.id === fileId);

    if (index === -1) {
      return res.status(404).json({ error: 'Asset target allocation index not found.' });
    }

    // Terminate object binary directly within the cloud Blob block
    await del(uploadsMetadata[index].url);

    // Splice records matrix array and synchronize memory state
    uploadsMetadata.splice(index, 1);
    await redis.set('uploadsMetadata', uploadsMetadata);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process infrastructure deletion cascade.' });
  }
});

// Fallback runtime catch block middleware
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'A routing lifecycle execution mismatch occurred.' });
});

module.exports = app;
