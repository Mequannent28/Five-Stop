const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const upload   = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

// POST /api/upload  — upload one or more receipt files (max 5)
router.post('/', protect, upload.array('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded.' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const uploaded = req.files.map(f => ({
    url:        `${baseUrl}/api/upload/${f.filename}`,
    name:       f.originalname,
    mimeType:   f.mimetype,
    size:       f.size,
    uploadedAt: new Date(),
  }));

  res.status(201).json({ files: uploaded });
});

// GET /api/upload/:filename — serve a stored file
router.get('/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found.' });
  }
  res.sendFile(filePath);
});

// DELETE /api/upload/:filename — delete a stored file
router.delete('/:filename', protect, (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ message: 'File deleted.' });
});

module.exports = router;
