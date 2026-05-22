const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');
const metadataPath = path.join(__dirname, 'uploads-meta.json');
fs.mkdirSync(uploadsDir, { recursive: true });

let uploadsMetadata = [];
if (fs.existsSync(metadataPath)) {
  try {
    uploadsMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) || [];
  } catch (error) {
    uploadsMetadata = [];
  }
}

const saveMetadata = () => {
  fs.writeFileSync(metadataPath, JSON.stringify(uploadsMetadata, null, 2));
};

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
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir, { maxAge: '1d' }));

app.get('/uploads.json', (req, res) => {
  res.json(uploadsMetadata);
});

app.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

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

  const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const outPath = path.join(uploadsDir, safeName);
  fs.writeFileSync(outPath, req.file.buffer);

  const directUrl = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(safeName)}`;
  const uploadedAt = new Date().toISOString();

  const entry = {
    id: safeName,
    filename: safeName,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    url: directUrl,
    uploadedAt
  };

  uploadsMetadata.unshift(entry);
  saveMetadata();

  res.json({
    url: directUrl,
    name: entry.originalName,
    size: entry.size,
    uploadedAt: entry.uploadedAt,
    duplicate: false
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
