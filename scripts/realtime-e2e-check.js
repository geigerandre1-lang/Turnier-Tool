/* eslint-disable no-console */
const { io } = require("socket.io-client");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:4000";
const MASTER_PASSWORD = process.env.E2E_MASTER_PASSWORD || process.env.MASTER_PASSWORD || "change-me";
const OPERATOR_PASSWORD = process.env.E2E_OPERATOR_PASSWORD || "op123";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await safeJson(response);
  if (!response.ok) {
    const msg = data?.message || JSON.stringify(data) || `HTTP ${response.status}`;
    throw new Error(`${options.method || "GET"} ${path} failed: ${msg}`);
  }
  return data;
}

async function createTournament() {
  const body = {
    name: `E2E Realtime ${Date.now()}`,
    operatorPassword: OPERATOR_PASSWORD,
    masterPassword: MASTER_PASSWORD,
  };

  const data = await request("/tournaments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!data?.slot?.id) {
    throw new Error("Tournament creation returned no slot id");
  }

  return data.slot.id;
}

async function loginOperator(tournamentId) {
  const data = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: OPERATOR_PASSWORD,
      tournamentId,
    }),
  });

  if (!data?.token) {
    throw new Error("Login returned no token");
  }

  return data.token;
}

async function seedState(tournamentId, token) {
  const state = {
    isStarted: true,
    mode: "ko",
    best_of: 5,
    players: [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ],
    matches: {
      m1: {
        id: "m1",
        player1: "Alice",
        player2: "Bob",
        winner: null,
        legs1: null,
        legs2: null,
        canBePlayed: true,
      },
    },
    automats: [],
    brackets: [],
  };

  await request(`/state?t=${encodeURIComponent(tournamentId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(state),
  });
}

async function run() {
  const tournamentId = await createTournament();
  const token = await loginOperator(tournamentId);
  await seedState(tournamentId, token);

  const socket = io(BASE_URL, {
    transports: ["websocket", "polling"],
    timeout: 10000,
  });

  const events = [];

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Socket authentication timeout"));
    }, 10000);

    socket.on("connect", () => {
      socket.emit("authenticate", { token });
    });

    socket.on("authenticated", () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on("error", (payload) => {
      clearTimeout(timeout);
      reject(new Error(`Socket error: ${JSON.stringify(payload)}`));
    });
  });

  socket.on("tournament:state-changed", (payload) => {
    events.push(payload);
  });

  await request(`/tournaments/${encodeURIComponent(tournamentId)}/matches/m1`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ legs1: 3, legs2: 1 }),
  });

  await sleep(700);

  await request(`/tournaments/${encodeURIComponent(tournamentId)}/matches/m1`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await sleep(700);

  const gotPatchEvent = events.some(
    (e) => e?.updatedMatch?.id === "m1" && e?.updatedMatch?.winner === "Alice",
  );
  const gotDeleteEvent = events.some(
    (e) => e?.updatedMatch?.id === "m1" && e?.updatedMatch?.winner === null,
  );

  socket.disconnect();

  const result = {
    ok: gotPatchEvent && gotDeleteEvent,
    tournamentId,
    eventCount: events.length,
    gotPatchEvent,
    gotDeleteEvent,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
