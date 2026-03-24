const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const http = require("http");
const { Server: SocketServer } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ===== PHASE 2.4: Socket.io Server Setup =====
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "*",  // TODO: restrict in production
    methods: ["GET", "POST"]
  }
});

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

// ===== SECURITY: Secrets Validation (Phase 2.1) =====
// In production, secrets MUST be set. No defaults allowed.
function validateSecrets() {
  const masterPwd = process.env.MASTER_PASSWORD || process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;

  const isProduction = process.env.NODE_ENV === "production";
  const hasDefaults = !masterPwd || masterPwd === "change-me" || !jwtSecret || jwtSecret === "change-me-secret";

  if (isProduction && hasDefaults) {
    console.error(
      "CRITICAL: In production, you MUST set MASTER_PASSWORD and JWT_SECRET environment variables.\n" +
      "DO NOT use default values. Exiting.\n" +
      "Example: export MASTER_PASSWORD=\"your-secure-pwd\" && export JWT_SECRET=\"your-secure-secret\""
    );
    process.exit(1);
  }

  if (hasDefaults) {
    console.warn(
      "WARNING: Using default secrets (MASTER_PASSWORD, JWT_SECRET).\n" +
      "For production use, set these as environment variables."
    );
  }
}

validateSecrets();

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

function emitTournamentStateChanged(tournamentId, payload = {}) {
  const roomName = `tournament:${tournamentId}`;
  io.to(roomName).emit("tournament:state-changed", {
    timestamp: new Date().toISOString(),
    tournamentId,
    ...payload,
  });
}

/**
 * ===== MIDDLEWARE: Authentication & Authorization (Phase 2.1) =====
 */

// Standard error responses
const APIError = {
  UNAUTHORIZED: { status: 401, code: "UNAUTHORIZED", message: "Missing or invalid authentication token" },
  FORBIDDEN: { status: 403, code: "FORBIDDEN", message: "Insufficient permissions for this action" },
  NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "Resource not found" },
  INVALID_STATE: { status: 409, code: "INVALID_STATE", message: "Tournament or match state does not permit this action" },
  VALIDATION_ERROR: { status: 400, code: "VALIDATION_ERROR", message: "Input validation failed" },
  INTERNAL_ERROR: { status: 500, code: "INTERNAL_ERROR", message: "Server error" },
};

function sendError(res, errorType, details = {}) {
  const error = APIError[errorType] || APIError.INTERNAL_ERROR;
  return res.status(error.status).json({
    ok: false,
    code: error.code,
    message: error.message,
    ...details,
  });
}

/**
 * Extract JWT token from Authorization header
 * Returns decoded payload or null if invalid/missing
 */
function extractToken(req) {
  const authHeader = req.headers["authorization"] || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * REQUIRED: Verify token and enforce role-based access
 * Roles: master (all tournaments), operator (own tournament), spectator (read-only)
 */
function verifyToken(req, res, next) {
  const payload = extractToken(req);

  if (!payload) {
    return sendError(res, "UNAUTHORIZED");
  }

  const tournamentId = req.query.t || req.params.id;
  const { role, tournamentId: tokenTournamentId } = payload;

  // Master: full access to all tournaments
  if (role === "master") {
    req.user = payload;
    return next();
  }

  // Operator/Spectator: scoped to own tournament
  if (role === "operator" || role === "spectator") {
    if (!tokenTournamentId) {
      return sendError(res, "FORBIDDEN", { reason: "Tournament context missing in token" });
    }
    if (tokenTournamentId !== tournamentId) {
      return sendError(res, "FORBIDDEN", { reason: "No access to this tournament" });
    }
    req.user = payload;
    return next();
  }

  return sendError(res, "FORBIDDEN", { reason: `Unknown role: ${role}` });
}

/**
 * OPTIONAL: Verify token if provided, otherwise allow as guest (for spectators)
 */
function optionalAuth(req, res, next) {
  const payload = extractToken(req);
  if (payload) {
    req.user = payload;
  }
  next();
}

/**
 * Ensure user has write permission (not spectator/player)
 */
function requireWrite(req, res, next) {
  if (req.user?.role === "spectator" || req.user?.role === "player") {
    return sendError(res, "FORBIDDEN", { reason: "This role is read-only" });
  }
  next();
}

/**
 * POST /login
 * Authenticate operator or master. Issues JWT token valid for 12h.
 */
app.post("/login", (req, res) => {
  const { password, tournamentId, playerId } = req.body || {};

  if (!password || typeof password !== "string") {
    return sendError(res, "VALIDATION_ERROR", { reason: "password required" });
  }

  // Master login (can manage all tournaments)
  if (password === MASTER_PASSWORD) {
    const token = jwt.sign(
      { role: "master", exp: Math.floor(Date.now() / 1000) + 12 * 3600 },
      JWT_SECRET
    );
    return res.json({ ok: true, token, role: "master" });
  }

  // Operator login (for specific tournament)
  if (!tournamentId || typeof tournamentId !== "string") {
    return sendError(res, "VALIDATION_ERROR", { reason: "tournamentId required for operator login" });
  }

  const meta = readTournamentsMeta();
  const id = tournamentId.trim();
  const slot = meta[id];

  if (!slot || !slot.operatorPassword) {
    return sendError(res, "NOT_FOUND", { reason: "Tournament not found" });
  }

  if (slot.operatorPassword !== password) {
    return sendError(res, "UNAUTHORIZED", { reason: "Invalid operator password" });
  }

  const token = jwt.sign(
    { role: "operator", tournamentId: id, exp: Math.floor(Date.now() / 1000) + 12 * 3600 },
    JWT_SECRET
  );

  return res.json({ ok: true, token, role: "operator", tournament: { id, name: slot.name } });
});

/**
 * GET /tournaments
 * List available tournament slots (public)
 */
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

/**
 * POST /tournaments
 * Create new tournament (public, no auth required)
 */
app.post("/tournaments", (req, res) => {
  const { name, operatorPassword, masterPassword } = req.body || {};

  if (!name || typeof name !== "string") {
    return sendError(res, "VALIDATION_ERROR", { reason: "Tournament name required" });
  }
  if (!operatorPassword || typeof operatorPassword !== "string") {
    return sendError(res, "VALIDATION_ERROR", { reason: "operatorPassword required" });
  }

  const meta = readTournamentsMeta();
  const freeId = TOURNAMENT_SLOTS.find((id) => {
    const slot = meta[id];
    return !slot || !slot.name;
  });

  if (!freeId) {
    return sendError(res, "INVALID_STATE", { reason: "No free tournament slots" });
  }

  meta[freeId] = {
    id: freeId,
    name: String(name),
    operatorPassword: String(operatorPassword),
  };

  writeTournamentsMeta(meta);

  // Clear old state file for clean start
  try {
    const stateFile = getStateFile(freeId);
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  } catch (e) {
    console.error("Failed to delete previous state file for", freeId, e);
  }

  res.status(201).json({
    ok: true,
    slot: {
      id: freeId,
      name: meta[freeId].name,
      occupied: true,
    },
  });
});

/**
 * DELETE /tournaments/:id
 * Delete tournament (requires operator or master password for confirmation)
 */
app.delete("/tournaments/:id", (req, res) => {
  const { password } = req.body || {};
  const id = req.params.id;

  if (!TOURNAMENT_SLOTS.includes(id)) {
    return sendError(res, "VALIDATION_ERROR", { reason: "Unknown tournament slot" });
  }

  const meta = readTournamentsMeta();
  const slot = meta[id];
  if (!slot || !slot.name) {
    return sendError(res, "NOT_FOUND", { reason: "Tournament slot is empty" });
  }

  if (!password || typeof password !== "string") {
    return sendError(res, "VALIDATION_ERROR", { reason: "password required for confirmation" });
  }

  const isMaster = password === MASTER_PASSWORD;
  const isOperator = !!slot.operatorPassword && password === slot.operatorPassword;

  if (!isMaster && !isOperator) {
    return sendError(res, "UNAUTHORIZED", { reason: "Invalid password" });
  }

  // Clear tournament
  slot.name = null;
  slot.operatorPassword = null;
  meta[id] = slot;
  writeTournamentsMeta(meta);

  // Delete state file
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

/**
 * GET /state?t=tournamentId
 * Fetch tournament state. Optional auth:
 * - Without token: spectator read (public)
 * - With token: full access per role
 */
app.get("/state", optionalAuth, (req, res) => {
  const tournamentId = req.query.t;

  if (!tournamentId || typeof tournamentId !== "string") {
    return sendError(res, "VALIDATION_ERROR", { reason: "tournamentId (query param 't') required" });
  }

  // If authenticated, verify tournament access
  if (req.user) {
    const { role, tournamentId: tokenTournamentId } = req.user;
    if (role !== "master" && tokenTournamentId !== tournamentId) {
      return sendError(res, "FORBIDDEN");
    }
  }

  const state = readState(tournamentId);
  if (!state) {
    return sendError(res, "NOT_FOUND", { reason: "No state stored for this tournament yet" });
  }

  res.json(state);
});

/**
 * POST /state?t=tournamentId (LEGACY, deprecated Phase 6)
 * Bulk update tournament state. Requires operator/master auth.
 * Future: Clients should prefer PATCH /tournaments/:id/matches/:matchId
 */
app.post("/state", verifyToken, requireWrite, (req, res) => {
  const tournamentId = req.query.t;
  const state = req.body || {};

  if (!state || typeof state !== "object") {
    return sendError(res, "VALIDATION_ERROR", { reason: "Request body must be tournament state object" });
  }

  try {
    writeState(tournamentId, state);
    emitTournamentStateChanged(tournamentId, { state });
    res.json({ ok: true, state });
  } catch (e) {
    console.error("Failed to persist state:", e);
    return sendError(res, "INTERNAL_ERROR");
  }
});

/**
 * ===== PHASE 2.2: Granular Match Endpoints =====
 * New endpoints for fine-grained match result updates
 * These replace bulk POST /state in phases 4-6
 */

/**
 * Helper: Calculate winner from legs
 */
function calculateWinner(match, legs1, legs2, bestOf) {
  if (legs1 === null || legs2 === null) return null;
  
  const legsToWin = Math.ceil(bestOf / 2);
  if (legs1 >= legsToWin) return match.player1;
  if (legs2 >= legsToWin) return match.player2;
  return null;
}

/**
 * Helper: Clear automat info from match
 */
function clearAutomatInfo(match) {
  match.isOnAutomat = false;
  match.isNextInAutomatQueue = false;
  match.automatNumber = undefined;
  match.automatName = undefined;
}

function isMatchPlayable(match) {
  if (match && typeof match.canBePlayed === "boolean") {
    return match.canBePlayed;
  }

  return Boolean(match && match.player1 && match.player2 && !match.winner);
}

/**
 * Helper: Propagate winner to next matches
 * Returns array of affected matches
 */
function propagateWinner(matches, matchId, newWinner, newLoser, prevWinner) {
  const affected = [];
  const match = matches[matchId];
  if (!match) return affected;

  const prevLoser = prevWinner
    ? prevWinner === match.player1 ? match.player2 : match.player1
    : null;

  // Propagate to winner bracket
  if (match.winnerTo) {
    const nextMatch = matches[match.winnerTo.matchId];
    if (nextMatch) {
      if (match.winnerTo.slot === 1) nextMatch.player1 = newWinner;
      else nextMatch.player2 = newWinner;
      affected.push(nextMatch.id);
    }
  }

  // Propagate to loser bracket (double elimination)
  if (match.loserTo && newLoser) {
    const nextMatch = matches[match.loserTo.matchId];
    if (nextMatch) {
      const slotKey = match.loserTo.slot === 1 ? "player1" : "player2";
      
      // If old loser was in slot, clear that match first
      if (prevLoser && nextMatch[slotKey] === prevLoser) {
        clearMatch(matches, nextMatch.id);
      }

      nextMatch[slotKey] = newLoser;
      affected.push(nextMatch.id);
    }
  }

  return affected;
}

/**
 * Helper: Clear a match and cascade clearing dependent matches
 */
function clearMatch(matches, matchId) {
  const match = matches[matchId];
  if (!match) return [];

  const wasWinner = match.winner;
  match.winner = null;
  match.legs1 = null;
  match.legs2 = null;
  clearAutomatInfo(match);

  const cascaded = [];

  // Cascade: Clear dependent matches if their source was just cleared
  if (match.winnerTo) {
    const next = matches[match.winnerTo.matchId];
    if (next && next[match.winnerTo.slot === 1 ? "player1" : "player2"] === wasWinner) {
      cascaded.push(...clearMatch(matches, next.id));
    }
  }

  if (match.loserTo) {
    const next = matches[match.loserTo.matchId];
    if (next && next[match.loserTo.slot === 1 ? "player1" : "player2"] === wasWinner) {
      cascaded.push(...clearMatch(matches, next.id));
    }
  }

  return cascaded;
}

/**
 * PATCH /tournaments/:id/matches/:matchId (PHASE 2.2 NEW)
 * Update match result (legs, winner calculation, propagation)
 */
app.patch("/tournaments/:id/matches/:matchId", verifyToken, requireWrite, (req, res) => {
  const { id: tournamentId, matchId } = req.params;
  const { legs1, legs2, winner } = req.body || {};

  // Load state
  const state = readState(tournamentId);
  if (!state) {
    return sendError(res, "NOT_FOUND", { reason: "Tournament state not found" });
  }

  const match = state.matches && state.matches[matchId];
  if (!match) {
    return sendError(res, "NOT_FOUND", { reason: "Match not found" });
  }

  // Validate match is ready (fallback for older states without canBePlayed)
  if (!isMatchPlayable(match) && !match.winner) {
    return sendError(res, "INVALID_STATE", { reason: "Match dependencies not met" });
  }

  const hasLegsInput = legs1 !== undefined || legs2 !== undefined;
  const hasWinnerInput = typeof winner === "string" && winner.trim().length > 0;

  if (!hasLegsInput && !hasWinnerInput) {
    return sendError(res, "VALIDATION_ERROR", { reason: "Either legs1/legs2 or winner must be provided" });
  }

  if (hasLegsInput && (legs1 === null || legs2 === null || legs1 === undefined || legs2 === undefined)) {
    return sendError(res, "VALIDATION_ERROR", { reason: "Both legs1 and legs2 must be provided together" });
  }

  if (hasWinnerInput && winner !== match.player1 && winner !== match.player2) {
    return sendError(res, "VALIDATION_ERROR", { reason: "Winner must be one of the players in this match" });
  }

  const bestOf = state.best_of || 5;
  const legsToWin = Math.ceil(bestOf / 2);

  // Validate leg values
  if (hasLegsInput) {
    const l1 = legs1 ?? 0;
    const l2 = legs2 ?? 0;

    if (!Number.isInteger(l1) || !Number.isInteger(l2)) {
      return sendError(res, "VALIDATION_ERROR", { reason: "Legs must be integers" });
    }

    if (l1 < 0 || l2 < 0) {
      return sendError(res, "VALIDATION_ERROR", { reason: "Legs cannot be negative" });
    }

    if (l1 === l2) {
      return sendError(res, "VALIDATION_ERROR", { reason: "Match cannot be a draw" });
    }

    if (l1 > bestOf || l2 > bestOf) {
      return sendError(res, "VALIDATION_ERROR", { reason: `Legs cannot exceed best-of ${bestOf}` });
    }

    const winner = calculateWinner(match, l1, l2, bestOf);
    if (!winner) {
      return sendError(res, "VALIDATION_ERROR", { reason: "Invalid legs: no winner determined" });
    }
  }

  // Update match
  const prevWinner = match.winner;
  if (hasLegsInput) {
    match.legs1 = legs1;
    match.legs2 = legs2;
    match.winner = calculateWinner(match, match.legs1, match.legs2, bestOf);
  } else {
    match.legs1 = null;
    match.legs2 = null;
    match.winner = winner;
  }

  clearAutomatInfo(match);

  // Propagate winner
  const affectedIds = match.winner
    ? propagateWinner(state.matches, matchId, match.winner, 
        match.player1 === match.winner ? match.player2 : match.player1, 
        prevWinner)
    : [];

  // Collect affected matches
  const affectedMatches = affectedIds.reduce((acc, id) => {
    if (state.matches[id]) acc.push(state.matches[id]);
    return acc;
  }, []);

  // Save state
  try {
    writeState(tournamentId, state);
    emitTournamentStateChanged(tournamentId, {
      updatedMatch: { id: matchId, ...match },
      affected: {
        matches: affectedMatches,
        brackets: []
      }
    });
    res.json({
      ok: true,
      match,
      affected: {
        matches: affectedMatches,
        brackets: [] // Array of affected bracket IDs (for optimization)
      }
    });
  } catch (e) {
    console.error("Failed to update match:", e);
    return sendError(res, "INTERNAL_ERROR");
  }
});

/**
 * DELETE /tournaments/:id/matches/:matchId (PHASE 2.2 NEW)
 * Clear/reset match result (undo operation)
 */
app.delete("/tournaments/:id/matches/:matchId", verifyToken, requireWrite, (req, res) => {
  const { id: tournamentId, matchId } = req.params;

  // Load state
  const state = readState(tournamentId);
  if (!state) {
    return sendError(res, "NOT_FOUND", { reason: "Tournament state not found" });
  }

  const match = state.matches && state.matches[matchId];
  if (!match) {
    return sendError(res, "NOT_FOUND", { reason: "Match not found" });
  }

  // Clear match and cascade
  const cascaded = clearMatch(state.matches, matchId);

  // Save state
  try {
    writeState(tournamentId, state);
    const cascadedMatches = cascaded.map(id => state.matches[id]).filter(m => m);
    emitTournamentStateChanged(tournamentId, {
      updatedMatch: {
        id: matchId,
        winner: null,
        legs1: null,
        legs2: null
      },
      cascaded: cascadedMatches
    });
    res.json({
      ok: true,
      match: {
        id: matchId,
        winner: null,
        legs1: null,
        legs2: null
      },
      cascaded: cascadedMatches
    });
  } catch (e) {
    console.error("Failed to clear match:", e);
    return sendError(res, "INTERNAL_ERROR");
  }
});

/**
 * PHASE 2.4: Socket.io WebSocket Connection Handlers
 */
const tournamentConnections = {}; // Track active connections per tournament

io.on("connection", (socket) => {
  console.log(`[Socket] Client ${socket.id} connected`);
  let authenticatedTournamentId = null;

  // Authenticate via JWT
  socket.on("authenticate", (data) => {
    const { token } = data || {};
    if (!token) {
      socket.emit("error", { code: "UNAUTHORIZED", message: "Token required" });
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      socket.emit("error", { code: "UNAUTHORIZED", message: "Invalid or expired token" });
      return;
    }

    const { role, tournamentId: tokenTournamentId } = payload;
    if (!tokenTournamentId) {
      socket.emit("error", { code: "FORBIDDEN", message: "No tournament context in token" });
      return;
    }

    // Verify tournament exists
    const meta = readTournamentsMeta();
    if (!meta[tokenTournamentId]) {
      socket.emit("error", { code: "NOT_FOUND", message: "Tournament not found" });
      return;
    }

    // Store auth context
    socket.user = { role, tournamentId: tokenTournamentId };
    authenticatedTournamentId = tokenTournamentId;

    // Join tournament room
    const roomName = `tournament:${tokenTournamentId}`;
    socket.join(roomName);

    console.log(`[Socket] Client ${socket.id} authenticated as ${role} for tournament ${tokenTournamentId}`);
    socket.emit("authenticated", { ok: true, tournamentId: tokenTournamentId, role });
  });

  // Handle match update (client → server)
  socket.on("update-match", (data) => {
    if (!socket.user || !authenticatedTournamentId) {
      socket.emit("error", { code: "UNAUTHORIZED", message: "Not authenticated" });
      return;
    }

    const { matchId, legs1, legs2 } = data || {};
    if (!matchId) {
      socket.emit("error", { code: "VALIDATION_ERROR", message: "matchId required" });
      return;
    }

    // Load tournament state
    const state = readState(authenticatedTournamentId);
    if (!state) {
      socket.emit("error", { code: "NOT_FOUND", message: "Tournament not found" });
      return;
    }

    const match = state.matches && state.matches[matchId];
    if (!match) {
      socket.emit("error", { code: "NOT_FOUND", message: "Match not found" });
      return;
    }

    // Update match (same logic as POST /state)
    const bestOf = state.best_of || 5;
    try {
      const prevWinner = match.winner;
      match.legs1 = legs1 !== undefined ? legs1 : match.legs1;
      match.legs2 = legs2 !== undefined ? legs2 : match.legs2;
      match.winner = match.legs1 !== null && match.legs2 !== null
        ? calculateWinner(match, match.legs1, match.legs2, bestOf)
        : null;

      clearAutomatInfo(match);

      const newLoser = match.winner
        ? match.player1 === match.winner ? match.player2 : match.player1
        : null;

      // Propagate winner to dependent matches
      const affectedIds = match.winner
        ? propagateWinner(state.matches, matchId, match.winner, newLoser, prevWinner)
        : [];
      const affectedMatches = affectedIds.map((id) => state.matches[id]).filter(Boolean);

      // Save state
      writeState(authenticatedTournamentId, state);

      emitTournamentStateChanged(authenticatedTournamentId, {
        updatedMatch: { id: matchId, ...match },
        affected: {
          matches: affectedMatches,
          brackets: []
        }
      });

      socket.emit("match-updated", { ok: true, matchId, match });
    } catch (e) {
      console.error("Failed to update match via WebSocket:", e);
      socket.emit("error", { code: "INTERNAL_ERROR", message: e.message });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    if (authenticatedTournamentId) {
      console.log(`[Socket] Client ${socket.id} disconnected from tournament ${authenticatedTournamentId}`);
    } else {
      console.log(`[Socket] Client ${socket.id} disconnected (unauthenticated)`);
    }
  });
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
server.listen(PORT, () => {
  console.log(`[Server] Turnier backend listening on http://localhost:${PORT} (WebSocket ready)`);
});
