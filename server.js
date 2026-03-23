const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Statische Dateien aus dem build-Ordner ausliefern
app.use(express.static(path.join(__dirname, "build")));

const STATE_FILE = path.join(__dirname, "tournament-state.json");

// Einfache Admin-Authentifizierung über statisches Passwort + JWT
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-secret";

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const data = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read state file", e);
    return null;
  }
}

function writeState(state) {
  try {
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
    if (!payload || payload.role !== "operator") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

app.post("/login", (req, res) => {
  const { password } = req.body || {};

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }

  const token = jwt.sign({ role: "operator" }, JWT_SECRET, { expiresIn: "12h" });

  res.json({ ok: true, token });
});

app.get("/state", (req, res) => {
  const state = readState();
  if (!state) {
    return res.status(404).json({ message: "No state stored yet" });
  }
  res.json(state);
});

app.post("/state", verifyToken, (req, res) => {
  const state = req.body || {};
  try {
    writeState(state);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Failed to persist state" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Turnier backend listening on http://localhost:${PORT}`);
});
