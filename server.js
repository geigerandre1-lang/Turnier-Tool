const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const BUILD_DIR = path.join(__dirname, "build");

// Metadaten für bis zu 4 Turniere (Slots)
const TOURNAMENT_SLOTS = ["turnier1", "turnier2", "turnier3", "turnier4"];
const TOURNAMENTS_FILE = path.join(__dirname, "tournaments-meta.json");

// Mehrere Turniere parallel über Query-Parameter ?t=turnier1 speichern
const DEFAULT_TOURNAMENT_ID = "default";

function getStateFile(tournamentId) {
  const raw = typeof tournamentId === "string" && tournamentId.trim().length > 0
    ? tournamentId.trim()
    : DEFAULT_TOURNAMENT_ID;

  // Sehr einfache "Sanitizer"-Logik, um Pfad-Traversal zu verhindern
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "-");
  return path.join(__dirname, `tournament-state-${safe}.json`);
}

// Master-Passwort (kann alle Turniere verwalten) + JWT-Secret
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || process.env.ADMIN_PASSWORD || "change-me";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-secret";

function readTournamentsMeta() {
  try {
    if (!fs.existsSync(TOURNAMENTS_FILE)) {
      const initial = {};
      TOURNAMENT_SLOTS.forEach((id) => {
        initial[id] = { id, name: null, operatorPassword: null };
      });
      fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const data = fs.readFileSync(TOURNAMENTS_FILE, "utf8");
    const parsed = JSON.parse(data);
    // Sicherstellen, dass alle Slots existieren
    TOURNAMENT_SLOTS.forEach((id) => {
      if (!parsed[id]) {
        parsed[id] = { id, name: null, operatorPassword: null };
      }
    });
    return parsed;
  } catch (e) {
    console.error("Failed to read tournaments meta file", e);
    const fallback = {};
    TOURNAMENT_SLOTS.forEach((id) => {
      fallback[id] = { id, name: null, operatorPassword: null };
    });
    return fallback;
  }
}

function writeTournamentsMeta(meta) {
  try {
    fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(meta, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write tournaments meta file", e);
    throw e;
  }
}

function readState(tournamentId) {
  try {
    const STATE_FILE = getStateFile(tournamentId);
    if (!fs.existsSync(STATE_FILE)) return null;
    const data = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read state file", e);
    return null;
  }
}

function writeState(tournamentId, state) {
  try {
    const STATE_FILE = getStateFile(tournamentId);
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write state file", e);
    throw e;
  }
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.role) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const tournamentId = req.query.t;

    // Master darf alles
    if (payload.role === "master") {
      req.user = payload;
      return next();
    }

    // Operator darf nur das eigene Turnier bearbeiten
    if (payload.role === "operator") {
      if (!payload.tournamentId) {
        return res.status(403).json({ ok: false, error: "Tournament context missing" });
      }
      const expected = typeof tournamentId === "string" && tournamentId.trim().length > 0
        ? tournamentId.trim()
        : DEFAULT_TOURNAMENT_ID;

      if (payload.tournamentId !== expected) {
        return res.status(403).json({ ok: false, error: "Forbidden for this tournament" });
      }
      req.user = payload;
      return next();
    }

    return res.status(403).json({ ok: false, error: "Forbidden" });
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

app.post("/login", (req, res) => {
  const { password, tournamentId } = req.body || {};

  if (!password) {
    return res.status(400).json({ ok: false, error: "Password required" });
  }

  // Master-Login
  if (password === MASTER_PASSWORD) {
    const token = jwt.sign({ role: "master" }, JWT_SECRET, { expiresIn: "12h" });
    return res.json({ ok: true, token, role: "master" });
  }

  // Operator-Login für spezifisches Turnier
  const meta = readTournamentsMeta();
  const id = typeof tournamentId === "string" && tournamentId.trim().length > 0
    ? tournamentId.trim()
    : DEFAULT_TOURNAMENT_ID;

  const slot = meta[id];
  if (!slot || !slot.operatorPassword || slot.operatorPassword !== password) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }

  const token = jwt.sign({ role: "operator", tournamentId: id }, JWT_SECRET, { expiresIn: "12h" });

  res.json({ ok: true, token, role: "operator" });
});

// Übersicht der Turnier-Slots
app.get("/tournaments", (req, res) => {
  const meta = readTournamentsMeta();
  const slots = TOURNAMENT_SLOTS.map((id) => {
    const slot = meta[id] || { id, name: null, operatorPassword: null };
    return {
      id,
      name: slot.name,
      occupied: !!slot.name,
    };
  });
  res.json({ slots });
});

// Neues Turnier anlegen (ohne Auth, Passwort nur für Turnierleitung)
app.post("/tournaments", (req, res) => {
  const { name, operatorPassword } = req.body || {};

  if (!name || typeof name !== "string" || !operatorPassword) {
    return res.status(400).json({ ok: false, error: "Name and operatorPassword required" });
  }

  const meta = readTournamentsMeta();
  const freeId = TOURNAMENT_SLOTS.find((id) => {
    const slot = meta[id];
    return !slot || !slot.name;
  });

  if (!freeId) {
    return res.status(400).json({ ok: false, error: "No free tournament slots" });
  }

  meta[freeId] = {
    id: freeId,
    name: String(name),
    operatorPassword: String(operatorPassword),
  };

  writeTournamentsMeta(meta);

   // Vorsichtshalber alten State dieses Slots löschen, damit das Turnier sauber startet
  try {
    const stateFile = getStateFile(freeId);
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  } catch (e) {
    console.error("Failed to delete previous state file for", freeId, e);
  }

  res.json({
    ok: true,
    slot: {
      id: freeId,
      name: meta[freeId].name,
      occupied: true,
    },
  });
});

// Turnier löschen (mit Turnier- oder Master-Passwort)
app.delete("/tournaments/:id", (req, res) => {
  const { password } = req.body || {};
  const id = req.params.id;

  if (!TOURNAMENT_SLOTS.includes(id)) {
    return res.status(400).json({ ok: false, error: "Unknown tournament slot" });
  }

  const meta = readTournamentsMeta();
  const slot = meta[id];
  if (!slot || !slot.name) {
    return res.status(400).json({ ok: false, error: "Tournament slot is empty" });
  }

  if (!password) {
    return res.status(401).json({ ok: false, error: "Password required" });
  }

  const isMaster = password === MASTER_PASSWORD;
  const isOperator = !!slot.operatorPassword && password === slot.operatorPassword;

  if (!isMaster && !isOperator) {
    return res.status(401).json({ ok: false, error: "Invalid password" });
  }

  // Passwort war gültig: Slot leeren
  slot.name = null;
  slot.operatorPassword = null;
  meta[id] = slot;
  writeTournamentsMeta(meta);

  // Zugehörige State-Datei entfernen
  try {
    const stateFile = getStateFile(id);
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  } catch (e) {
    console.error("Failed to delete state file for", id, e);
  }

  res.json({ ok: true });
});

app.get("/state", (req, res) => {
  const tournamentId = req.query.t;
  const state = readState(tournamentId);
  if (!state) {
    return res.status(404).json({ message: "No state stored yet" });
  }
  res.json(state);
});

app.post("/state", verifyToken, (req, res) => {
  const tournamentId = req.query.t;
  const state = req.body || {};
  try {
    writeState(tournamentId, state);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Failed to persist state" });
  }
});

// Statische Dateien aus dem build-Ordner ausliefern
// Root-Variante: /
app.use(express.static(BUILD_DIR));

// Zusätzliche Pfade für mehrere Turniere, z.B. /turnier1, /turnier2, ...
const TOURNAMENT_PATHS = ["/turnier1", "/turnier2", "/turnier3", "/turnier4"]; // ggf. anpassen
TOURNAMENT_PATHS.forEach((basePath) => {
  app.use(basePath, express.static(BUILD_DIR));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Turnier backend listening on http://localhost:${PORT}`);
});
