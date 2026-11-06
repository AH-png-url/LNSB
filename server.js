const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const port = process.env.PORT || 3000;
const adminToken = process.env.ADMIN_TOKEN || '';
const defaultAccessCode = process.env.ACCESS_CODE || 'lnsb-demo-access-code';
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');
const soundsFile = path.join(dataDir, 'sounds.json');
const feedbackFile = path.join(dataDir, 'feedback.json');
const accessFile = path.join(dataDir, 'access-code.json');
const nicknamesFile = path.join(dataDir, 'nicknames.json');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(soundsFile)) fs.writeFileSync(soundsFile, '[]');
if (!fs.existsSync(feedbackFile)) fs.writeFileSync(feedbackFile, '[]');
if (!fs.existsSync(nicknamesFile)) fs.writeFileSync(nicknamesFile, '{}');
if (!fs.existsSync(accessFile)) {
  saveAccessCode(defaultAccessCode);
  console.warn('No ACCESS_CODE was set. Using the built-in demo board code: "lnsb-demo-access-code". Set ACCESS_CODE in your environment for a private board.');
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 10)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => file.mimetype.startsWith('audio/') ? callback(null, true) : callback(new Error('Please choose an audio file.'))
});
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', requireAccess, express.static(uploadDir, { fallthrough: false }));
