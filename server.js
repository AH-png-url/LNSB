const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const port = process.env.PORT || 3000;
const adminToken = process.env.ADMIN_TOKEN || '';
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');
const soundsFile = path.join(dataDir, 'sounds.json');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(soundsFile)) fs.writeFileSync(soundsFile, '[]');

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 10)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => file.mimetype.startsWith('audio/') ? callback(null, true) : callback(new Error('Please choose an audio file.'))
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir, { fallthrough: false }));

app.get('/api/sounds', (_req, res) => res.json(readSounds()));

app.post('/api/admin/verify', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Set ADMIN_TOKEN in the hosting environment first.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Incorrect admin token.' });
  res.json({ ok: true });
});

app.post('/api/sounds', upload.single('audio'), (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const addedBy = typeof req.body.username === 'string' ? req.body.username.trim().slice(0, 32) : '';
  const sourceUrl = typeof req.body.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
  if (!addedBy) return res.status(400).json({ message: 'Enter your username before adding a sound.' });
  if (!name) return res.status(400).json({ message: 'Enter a sound name.' });
  if (!req.file && !isHttpUrl(sourceUrl)) return res.status(400).json({ message: 'Upload an audio file or enter an HTTP(S) URL.' });

  const sound = {
    id: crypto.randomUUID(),
    name,
    addedBy,
    sourceUrl: req.file ? `/uploads/${req.file.filename}` : sourceUrl,
    createdAt: new Date().toISOString()
  };
  const sounds = readSounds();
  sounds.push(sound);
  writeSounds(sounds);
  res.status(201).json(sound);
});

// The download action is owner-only. Public audio playback remains available on the board.
app.get('/api/sounds/:id/download', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Owner access is not configured.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Only the board owner can download sounds.' });
  const sound = readSounds().find((item) => item.id === req.params.id);
  if (!sound) return res.status(404).json({ message: 'Sound not found.' });
  if (sound.sourceUrl.startsWith('/uploads/')) {
    const filename = path.basename(sound.sourceUrl);
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Audio file not found.' });
    return res.download(filePath, `${safeDownloadName(sound.name)}${path.extname(filename)}`);
  }
  res.redirect(sound.sourceUrl);
});

app.delete('/api/sounds/:id', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Owner access is not configured.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Only the board owner can remove sounds.' });
  const sounds = readSounds();
  const index = sounds.findIndex((sound) => sound.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: 'Sound not found.' });
  const [removed] = sounds.splice(index, 1);
  writeSounds(sounds);
  if (removed.sourceUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadDir, path.basename(removed.sourceUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Audio files must be 20 MB or smaller.' });
  res.status(400).json({ message: error.message || 'Request failed.' });
});
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`LNSB listening on port ${port}`));

function readSounds() {
  try {
    const value = JSON.parse(fs.readFileSync(soundsFile, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function writeSounds(sounds) {
  const temporary = `${soundsFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(sounds, null, 2));
  fs.renameSync(temporary, soundsFile);
}
function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}
function isValidAdminToken(candidate) {
  const supplied = Buffer.from(candidate);
  const expected = Buffer.from(adminToken);
  return Boolean(adminToken) && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
function safeDownloadName(value) {
  return value.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-') || 'sound';
}
