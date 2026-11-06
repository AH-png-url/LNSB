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
  if (!process.env.ACCESS_CODE) console.warn('No ACCESS_CODE was set. Using the built-in demo board code: "lnsb-demo-access-code". Set ACCESS_CODE in your environment for a private board.');
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

app.post('/api/access/verify', (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (!readAccessCode()) return res.status(503).json({ message: 'Access code is not configured. Set ACCESS_CODE on the hosting service.' });
  if (!isValidAccessCode(code)) return res.status(403).json({ message: 'That access code is not correct.' });
  issueAccessCookie(req, res);
  res.json({ ok: true });
});
app.get('/api/access/session', requireAccess, (_req, res) => res.json({ ok: true }));

app.post('/api/admin/access-bypass', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Owner access is not configured.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Incorrect admin passcode.' });
  issueAccessCookie(req, res);
  res.json({ ok: true });
});
app.get('/api/sounds', requireAccess, (_req, res) => {
  const sounds = readArray(soundsFile).filter((sound) => sound && typeof sound === 'object' && typeof sound.id === 'string' && typeof sound.name === 'string' && typeof sound.sourceUrl === 'string');
  res.json(sounds);
});
app.post('/api/nicknames/claim', requireAccess, (req, res) => {
  const displayName = typeof req.body.username === 'string' ? req.body.username.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
  if (displayName.length < 2) return res.status(400).json({ message: 'Nicknames must be at least 2 characters.' });
  if (/[\u0000-\u001f\u007f]/.test(displayName)) return res.status(400).json({ message: 'That nickname contains invalid characters.' });
  const normalized = normalizeNickname(displayName);
  const claims = readObject(nicknamesFile);
  const existing = claims[normalized];
  if (existing) {
    const providedKey = req.body.claimKey;
    if (typeof providedKey !== 'string' || !verifySecret(providedKey, existing.salt, existing.hash)) return res.status(409).json({ message: 'That nickname is already taken. Please choose another one.' });
    return res.json({ ok: true, username: existing.username, claimKey: providedKey });
  }
  const claimKey = crypto.randomBytes(32).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  claims[normalized] = { username: displayName, salt, hash: hashSecret(claimKey, salt) };
  writeJson(nicknamesFile, claims);
  res.status(201).json({ ok: true, username: displayName, claimKey });
});
app.post('/api/admin/verify', (req, res) => {
  if (!adminToken) return res.status(503).json({ message: 'Set ADMIN_TOKEN in the hosting environment first.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Incorrect admin token.' });
  res.json({ ok: true });
});
app.post('/api/admin/access-code', requireAdmin, (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (code.length < 6 || code.length > 128) return res.status(400).json({ message: 'Choose a code between 6 and 128 characters.' });
  saveAccessCode(code);
  issueAccessCookie(req, res);
  res.json({ ok: true, message: 'Board access code updated. Existing visitor sessions were reset.' });
});
app.post('/api/admin/reset-access', requireAdmin, (_req, res) => {
  const config = readAccessCode();
  if (!config) return res.status(503).json({ message: 'Board access code is not configured.' });
  config.sessionSecret = crypto.randomBytes(32).toString('hex');
  writeJson(accessFile, config);
  clearAccessCookie(res);
  res.json({ ok: true, message: 'All visitor sessions were reset. Everyone must enter the current board code again.' });
});
app.post('/api/sounds', requireAccess, requireNickname, upload.single('audio'), (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  const sourceUrl = typeof req.body.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
  if (!name) return res.status(400).json({ message: 'Enter a sound name.' });
  if (!req.file && !isHttpUrl(sourceUrl)) return res.status(400).json({ message: 'Upload an audio file or enter an HTTP(S) URL.' });
  const sound = { id: crypto.randomUUID(), name, addedBy: req.claimedNickname.username, sourceUrl: req.file ? `/uploads/${req.file.filename}` : sourceUrl, createdAt: new Date().toISOString() };
  const sounds = readArray(soundsFile); sounds.push(sound); writeJson(soundsFile, sounds);
  res.status(201).json(sound);
});
app.post('/api/feedback', requireAccess, requireNickname, (req, res) => {
  const type = req.body.type === 'issue' ? 'issue' : req.body.type === 'feedback' ? 'feedback' : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 1500) : '';
  if (!type) return res.status(400).json({ message: 'Choose feedback or report an issue.' });
  if (message.length < 5) return res.status(400).json({ message: 'Please include a little more detail (at least 5 characters).' });
  const inbox = readArray(feedbackFile); inbox.push({ id: crypto.randomUUID(), username: req.claimedNickname.username, type, message, createdAt: new Date().toISOString() });
  writeJson(feedbackFile, inbox.slice(-500));
  res.status(201).json({ ok: true, message: 'Thanks! Your message was sent to the board owner.' });
});
app.get('/api/admin/feedback', requireAdmin, (_req, res) => res.json(readArray(feedbackFile).slice().reverse()));
app.get('/api/sounds/:id/download', requireAdmin, (req, res) => {
  const sound = readArray(soundsFile).find((item) => item && item.id === req.params.id);
  if (!sound) return res.status(404).json({ message: 'Sound not found.' });
  if (typeof sound.sourceUrl === 'string' && sound.sourceUrl.startsWith('/uploads/')) {
    const filename = path.basename(sound.sourceUrl), filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Audio file not found.' });
    return res.download(filePath, `${safeDownloadName(sound.name || 'sound')}${path.extname(filename)}`);
  }
  if (!isHttpUrl(sound.sourceUrl)) return res.status(400).json({ message: 'This sound has no valid download URL.' });
  res.redirect(sound.sourceUrl);
});
app.delete('/api/sounds/:id', requireAdmin, (req, res) => {
  const sounds = readArray(soundsFile), index = sounds.findIndex((sound) => sound && sound.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: 'Sound not found.' });
  const [removed] = sounds.splice(index, 1); writeJson(soundsFile, sounds);
  if (typeof removed.sourceUrl === 'string' && removed.sourceUrl.startsWith('/uploads/')) { const filePath = path.join(uploadDir, path.basename(removed.sourceUrl)); if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
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
  if (isValidAccessSession(req)) return next();
  clearAccessCookie(res);
  return res.status(403).json({ message: 'Enter the current board access code or use the owner passcode.' });
}
function requireNickname(req, res, next) {
  const name = req.get('x-nickname') || '', key = req.get('x-nickname-key') || '';
  const claim = readObject(nicknamesFile)[normalizeNickname(name)];
  if (!claim || !key || !verifySecret(key, claim.salt, claim.hash)) return res.status(403).json({ message: 'Claim your unique nickname again before continuing.' });
  req.claimedNickname = claim; next();
}
function requireAdmin(req, res, next) {
  if (!adminToken) return res.status(503).json({ message: 'Owner access is not configured.' });
  if (!isValidAdminToken(req.get('x-admin-token') || '')) return res.status(403).json({ message: 'Only the board owner can access this.' });
  next();
}
function readAccessCode() {
  try {
    const config = JSON.parse(fs.readFileSync(accessFile, 'utf8'));
    if (!config || !config.salt || !config.hash) return null;
    if (!config.sessionSecret) { config.sessionSecret = crypto.randomBytes(32).toString('hex'); writeJson(accessFile, config); }
    return config;
  } catch { return null; }
}
function saveAccessCode(code) {
  const salt = crypto.randomBytes(16).toString('hex');
  writeJson(accessFile, { salt, hash: crypto.scryptSync(code, salt, 64).toString('hex'), sessionSecret: crypto.randomBytes(32).toString('hex') });
}
function issueAccessCookie(req, res) {
  const config = readAccessCode();
  const value = crypto.createHmac('sha256', config.sessionSecret).update('lnsb-access-session-v1').digest('hex');
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader('Set-Cookie', `lnsb_access=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure ? '; Secure' : ''}`);
}
function clearAccessCookie(res) { res.setHeader('Set-Cookie', 'lnsb_access=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); }
function isValidAccessSession(req) {
  const part = (req.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith('lnsb_access='));
  const config = readAccessCode(); if (!part || !config) return false;
  const supplied = Buffer.from(part.slice('lnsb_access='.length));
  const expected = Buffer.from(crypto.createHmac('sha256', config.sessionSecret).update('lnsb-access-session-v1').digest('hex'));
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
function isValidAccessCode(candidate) {
  const config = readAccessCode(); if (!config || !candidate) return false;
  const actual = crypto.scryptSync(candidate, config.salt, 64), expected = Buffer.from(config.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function normalizeNickname(value) { return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US'); }
function hashSecret(secret, salt) { return crypto.scryptSync(secret, salt, 64).toString('hex'); }
function verifySecret(secret, salt, expectedHash) {
  if (typeof secret !== 'string' || typeof salt !== 'string' || typeof expectedHash !== 'string') return false;
  const actual = Buffer.from(hashSecret(secret, salt), 'hex'), expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function readArray(file) { try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; } }
function readObject(file) { try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }
function writeJson(file, value) { const temporary = `${file}.tmp`; fs.writeFileSync(temporary, JSON.stringify(value, null, 2)); fs.renameSync(temporary, file); }
function isHttpUrl(value) { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }
function isValidAdminToken(candidate) {
  const supplied = Buffer.from(candidate), expected = Buffer.from(adminToken);
  return Boolean(adminToken) && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
function safeDownloadName(value) { return value.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-') || 'sound'; }
