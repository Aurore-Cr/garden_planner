/**
 * Cycle — serveur (Express) pour héberger l'application, gérer plusieurs comptes
 * et persister les données de chaque personne dans son propre fichier JSON sur disque.
 *
 * Variables d'environnement :
 *   COOKIE_SECRET  secret de signature du cookie de session (à définir sur Render, obligatoire en prod).
 *   DATA_DIR       dossier où écrire les données (monter un disque persistant Render ici). Par défaut ./data
 *   PORT           port d'écoute (Render le fournit automatiquement).
 */
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const COOKIE_SECRET =
  process.env.COOKIE_SECRET ||
  "change-moi-sur-render-" + crypto.randomBytes(8).toString("hex");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const USERS_DIR = path.join(DATA_DIR, "users");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const PORT = process.env.PORT || 3004;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });

const app = express();
app.set("trust proxy", 1); // Render est derrière un proxy HTTPS
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser(COOKIE_SECRET));

// --- Comptes (identifiant + mot de passe haché) ---
function readAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE))
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
  } catch (e) {
    console.error("Lecture comptes échouée", e);
  }
  return {};
}
function writeAccounts(obj) {
  const tmp = ACCOUNTS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, ACCOUNTS_FILE);
}
function normalizeUsername(u) {
  return String(u || "")
    .trim()
    .toLowerCase();
}

function requireAuth(req, res, next) {
  if (req.signedCookies && req.signedCookies.uid) {
    const accounts = readAccounts();
    const account = Object.values(accounts).find(
      (a) => a.id === req.signedCookies.uid,
    );
    if (account) {
      req.userId = account.id;
      req.username = account.username;
      return next();
    }
  }
  if (req.path.startsWith("/api/"))
    return res.status(401).json({ error: "non authentifiée" });
  return res.redirect("/login.html");
}

// --- Auth : inscription ---
app.post("/api/register", (req, res) => {
  const username = normalizeUsername(req.body && req.body.username);
  const password = String((req.body && req.body.password) || "");
  const displayName =
    String((req.body && req.body.displayName) || "").trim() || username;
  if (!username || username.length < 3)
    return res
      .status(400)
      .json({
        ok: false,
        error: "Identifiant trop court (3 caractères minimum).",
      });
  if (!password || password.length < 6)
    return res
      .status(400)
      .json({
        ok: false,
        error: "Mot de passe trop court (6 caractères minimum).",
      });
  const accounts = readAccounts();
  if (accounts[username])
    return res
      .status(409)
      .json({ ok: false, error: "Cet identifiant existe déjà." });
  const id = crypto.randomBytes(12).toString("hex");
  const passwordHash = bcrypt.hashSync(password, 10);
  accounts[username] = {
    id,
    username,
    displayName,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  writeAccounts(accounts);
  // état initial vide pour ce compte (le client remplira les valeurs par défaut au premier chargement)
  fs.writeFileSync(path.join(USERS_DIR, id + ".json"), JSON.stringify(null));
  res.cookie("uid", id, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });
  res.json({ ok: true, username, displayName });
});

// --- Auth : connexion ---
app.post("/api/login", (req, res) => {
  const username = normalizeUsername(req.body && req.body.username);
  const password = String((req.body && req.body.password) || "");
  const accounts = readAccounts();
  const account = accounts[username];
  if (!account || !bcrypt.compareSync(password, account.passwordHash)) {
    return res
      .status(401)
      .json({ ok: false, error: "Identifiant ou mot de passe incorrect." });
  }
  res.cookie("uid", account.id, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });
  res.json({
    ok: true,
    username: account.username,
    displayName: account.displayName,
  });
});
app.post("/api/logout", (req, res) => {
  res.clearCookie("uid");
  res.json({ ok: true });
});
app.get("/api/session", (req, res) => {
  if (req.signedCookies && req.signedCookies.uid) {
    const accounts = readAccounts();
    const account = Object.values(accounts).find(
      (a) => a.id === req.signedCookies.uid,
    );
    if (account)
      return res.json({
        authed: true,
        username: account.username,
        displayName: account.displayName,
      });
  }
  res.json({ authed: false });
});

// --- Données (un fichier par compte) ---
function userFile(userId) {
  return path.join(USERS_DIR, userId + ".json");
}
function readState(userId) {
  try {
    const f = userFile(userId);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    console.error("Lecture état échouée", e);
  }
  return null;
}
function writeState(userId, obj) {
  const f = userFile(userId);
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, f);
  // copie de sauvegarde datée, une fois par jour, par compte
  const today = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(DATA_DIR, "backups", userId);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `backup-${today}.json`);
  if (!fs.existsSync(backupFile)) {
    try {
      fs.writeFileSync(backupFile, JSON.stringify(obj));
    } catch (e) {
      /* pas bloquant */
    }
  }
}

app.get("/api/state", requireAuth, (req, res) => {
  const s = readState(req.userId);
  res.json({ state: s, username: req.username });
});
app.put("/api/state", requireAuth, (req, res) => {
  if (!req.body || typeof req.body !== "object")
    return res.status(400).json({ error: "corps invalide" });
  writeState(req.userId, req.body);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});
app.get("/api/export", requireAuth, (req, res) => {
  const s = readState(req.userId) || {};
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cycle-sauvegarde-${req.username}.json"`,
  );
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(s, null, 2));
});

// --- Changer son mot de passe ---
app.post("/api/change-password", requireAuth, (req, res) => {
  const current = String((req.body && req.body.current) || "");
  const next = String((req.body && req.body.next) || "");
  if (!next || next.length < 6)
    return res
      .status(400)
      .json({
        ok: false,
        error: "Nouveau mot de passe trop court (6 caractères minimum).",
      });
  const accounts = readAccounts();
  const account = accounts[req.username];
  if (!account || !bcrypt.compareSync(current, account.passwordHash)) {
    return res
      .status(401)
      .json({ ok: false, error: "Mot de passe actuel incorrect." });
  }
  account.passwordHash = bcrypt.hashSync(next, 10);
  writeAccounts(accounts);
  res.json({ ok: true });
});

// --- Statique ---
app.get("/login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html")),
);
app.use((req, res, next) => {
  if (
    req.path === "/login.html" ||
    req.path.startsWith("/api/login") ||
    req.path.startsWith("/api/register")
  )
    return next();
  requireAuth(req, res, next);
});
app.use(
  express.static(path.join(__dirname, "public"), { index: "index.html" }),
);

app.listen(PORT, () => console.log(`Cycle est en ligne sur le port ${PORT}`));
