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
const feedbackFile = path.join(dataDir, 'feedback.json');
const accessFile = path.join(dataDir, 'access-code.json');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(soundsFile)) fs.writeFileSync(soundsFile, '[]');
if (!fs.existsSync(feedbackFile)) fs.writeFileSync(feedbackFile, '[]');
if (!fs.existsSync(accessFile) && process.env.ACCESS_CODE) saveAccessCode(process.env.ACCESS_CODE);

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
app.use('/uploads', express.static(uploadDir, { fallthrough: false }));

app.post('/api/access/verify', (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (!readAccessCode()) return res.status(503).json({ message: 'Access code is not configured. The owner must set ACCESS_CODE on the hosting service.' });
  if (!isValidAccessCode(code)) return res.status(403).json({ message: 'That access code is not correct.' });
  res.json({ ok: true });
});

// Admin recovery: verify the owner token and issue a short-lived HttpOnly bypass cookie.
app.post('/api/admin/access-bypass', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Owner access is not configured.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Incorrect admin passcode.' });
  const cookieValue = createAdminBypassCookie();
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader('Set-Cookie', `lnsb_admin_access=${cookieValue}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure ? '; Secure' : ''}`);
  res.json({ ok: true });
});

app.get('/api/sounds', requireAccess, (_req, res) => res.json(readJson(soundsFile)));
app.post('/api/admin/verify', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Set ADMIN_TOKEN in the hosting environment first.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Incorrect admin token.' });
  res.json({ ok: true });
});
app.post('/api/admin/access-code', requireAdmin, (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (code.length < 6 || code.length > 128) return res.status(400).json({ message: 'Choose a code between 6 and 128 characters.' });
  saveAccessCode(code);
  res.json({ ok: true, message: 'Board access code updated. Share the new code with your visitors.' });
});
app.post('/api/sounds', requireAccess, upload.single('audio'), (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const addedBy = typeof req.body.username === 'string' ? req.body.username.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
  const sourceUrl = typeof req.body.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
  if (!addedBy) return res.status(400).json({ message: 'Enter your username before adding a sound.' });
  if (!name) return res.status(400).json({ message: 'Enter a sound name.' });
  if (!req.file && !isHttpUrl(sourceUrl)) return res.status(400).json({ message: 'Upload an audio file or enter an HTTP(S) URL.' });
  const sound = { id: crypto.randomUUID(), name, addedBy, sourceUrl: req.file ? `/uploads/${req.file.filename}` : sourceUrl, createdAt: new Date().toISOString() };
  const sounds = readJson(soundsFile);
  sounds.push(sound);
  writeJson(soundsFile, sounds);
  res.status(201).json(sound);
});
app.post('/api/feedback', requireAccess, (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
  const type = req.body.type === 'issue' ? 'issue' : req.body.type === 'feedback' ? 'feedback' : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 1500) : '';
  if (!username) return res.status(400).json({ message: 'Please enter your username.' });
  if (!type) return res.status(400).json({ message: 'Choose feedback or report an issue.' });
  if (message.length < 5) return res.status(400).json({ message: 'Please include a little more detail (at least 5 characters).' });
  const inbox = readJson(feedbackFile);
  inbox.push({ id: crypto.randomUUID(), username, type, message, createdAt: new Date().toISOString() });
  writeJson(feedbackFile, inbox.slice(-500));
  res.status(201).json({ ok: true, message: 'Thanks! Your message was sent to the board owner.' });
});
app.get('/api/admin/feedback', requireAdmin, (_req, res) => res.json(readJson(feedbackFile).slice().reverse()));
app.get('/api/sounds/:id/download', requireAdmin, (req, res) => {
  const sound = readJson(soundsFile).find((item) => item.id === req.params.id);
  if (!sound) return res.status(404).json({ message: 'Sound not found.' });
  if (sound.sourceUrl.startsWith('/uploads/')) {
    const filename = path.basename(sound.sourceUrl);
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Audio file not found.' });
    return res.download(filePath, `${safeDownloadName(sound.name)}${path.extname(filename)}`);
  }
  res.redirect(sound.sourceUrl);
});
app.delete('/api/sounds/:id', requireAdmin, (req, res) => {
  const sounds = readJson(soundsFile);
  const index = sounds.findIndex((sound) => sound.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: 'Sound not found.' });
  const [removed] = sounds.splice(index, 1);
  writeJson(soundsFile, sounds);
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

function requireAccess(req, res, next) {
  if (!readAccessCode()) return res.status(503).json({ message: 'Board access is not configured.' });
  if (isValidAccessCode(req.get('x-access-code') || '') || isValidAdminBypass(req)) return next();
  return res.status(403).json({ message: 'Enter the current board access code or use the owner passcode.' });
}
function requireAdmin(req, res, next) {
  if (!adminToken) return res.status(503).json({ message: 'Owner access is not configured.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Only the board owner can access this.' });
  next();
}
function createAdminBypassCookie() {
  return crypto.createHmac('sha256', adminToken).update('lnsb-admin-access-v1').digest('hex');
}
function isValidAdminBypass(req) {
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('lnsb_admin_access='));
  if (!cookie || !adminToken) return false;
  const candidate = Buffer.from(decodeURIComponent(cookie.slice('lnsb_admin_access='.length)));
  const expected = Buffer.from(createAdminBypassCookie());
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}
function readAccessCode() {
  try { const config = JSON.parse(fs.readFileSync(accessFile, 'utf8')); return config && config.salt && config.hash ? config : null; }
  catch { return null; }
}
function saveAccessCode(code) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(code, salt, 64).toString('hex');
  writeJson(accessFile, { salt, hash });
}
function isValidAccessCode(candidate) {
  const config = readAccessCode();
  if (!config || !candidate) return false;
  const actual = crypto.scryptSync(candidate, config.salt, 64);
  const expected = Buffer.from(config.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function readJson(file) {
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function writeJson(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
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
