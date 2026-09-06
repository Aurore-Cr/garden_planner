/**
 * Cycle — serveur minimal (Express) pour héberger l'application
 * et persister les données dans un fichier JSON sur disque.
 *
 * Variables d'environnement :
 *   APP_PIN     code d'accès à l'application (4 à 12 chiffres/caractères). Par défaut "260926".
 *   COOKIE_SECRET  secret de signature du cookie de session (à définir sur Render).
 *   DATA_DIR    dossier où écrire data.json (monter un disque persistant Render ici). Par défaut ./data
 *   PORT        port d'écoute (Render le fournit automatiquement).
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const APP_PIN = process.env.APP_PIN || '260926';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'change-moi-sur-render-' + APP_PIN;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1); // Render est derrière un proxy HTTPS
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser(COOKIE_SECRET));

function requireAuth(req, res, next) {
  if (req.signedCookies && req.signedCookies.auth === 'ok') return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'non authentifiée' });
  return res.redirect('/login.html');
}

// --- Auth ---
app.post('/api/login', (req, res) => {
  const { pin } = req.body || {};
  if (pin && String(pin) === String(APP_PIN)) {
    res.cookie('auth', 'ok', {
      signed: true, httpOnly: true, sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 an
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Code incorrect' });
});
app.post('/api/logout', (req, res) => { res.clearCookie('auth'); res.json({ ok: true }); });
app.get('/api/session', (req, res) => { res.json({ authed: !!(req.signedCookies && req.signedCookies.auth === 'ok') }); });

// --- Données ---
function readState() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Lecture état échouée', e); }
  return null;
}
function writeState(obj) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, DATA_FILE);
  // copie de sauvegarde datée, une fois par jour
  const today = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(DATA_DIR, `backup-${today}.json`);
  if (!fs.existsSync(backupFile)) {
    try { fs.writeFileSync(backupFile, JSON.stringify(obj)); } catch (e) { /* pas bloquant */ }
  }
}

app.get('/api/state', requireAuth, (req, res) => {
  const s = readState();
  res.json({ state: s });
});
app.put('/api/state', requireAuth, (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'corps invalide' });
  writeState(req.body);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});
app.get('/api/export', requireAuth, (req, res) => {
  const s = readState() || {};
  res.setHeader('Content-Disposition', 'attachment; filename="cycle-sauvegarde.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(s, null, 2));
});

// --- Statique ---
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.use((req, res, next) => {
  if (req.path === '/login.html' || req.path.startsWith('/api/login')) return next();
  requireAuth(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.listen(PORT, () => console.log(`Cycle est en ligne sur le port ${PORT}`));
