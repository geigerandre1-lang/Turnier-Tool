// Smoke-Test für Kratzer-Core (ohne React/TS-Build)
// Ausführen: node scripts/kratzer-smoke.js

function shuffleNames(names, random = Math.random) {
  const arr = [...names];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resolveRoundParams(activeCount, settings) {
  if (activeCount <= 0) return { groupSize: 0, losersPerGroup: 0, isFinale: false };
  if (activeCount <= 3) {
    return { groupSize: activeCount, losersPerGroup: 1, isFinale: true };
  }
  if (activeCount < settings.autoShrinkBelow) {
    const groupSize = activeCount <= 8 ? 3 : 4;
    return {
      groupSize: Math.min(groupSize, activeCount),
      losersPerGroup: 1,
      isFinale: false,
    };
  }
  const groupSize = Math.min(Math.max(3, settings.preferredGroupSize), activeCount);
  const losersPerGroup = Math.min(
    Math.max(1, settings.losersPerGroup),
    Math.max(1, groupSize - 1)
  );
  return { groupSize, losersPerGroup, isFinale: false };
}

function partitionIntoGroups(players, preferredGroupSize) {
  const n = players.length;
  if (n === 0) return [];
  if (n <= preferredGroupSize) return [players];
  const numGroups = Math.max(1, Math.ceil(n / preferredGroupSize));
  const groups = Array.from({ length: numGroups }, () => []);
  players.forEach((p, idx) => {
    groups[idx % numGroups].push(p);
  });
  return groups.filter((g) => g.length > 0);
}

function getScratchRecipients(groupPlayers, placements, losersCount) {
  const sorted = [...groupPlayers].sort(
    (a, b) => (placements[b] ?? 0) - (placements[a] ?? 0)
  );
  const count = Math.min(losersCount, Math.max(0, groupPlayers.length - 1));
  return sorted.slice(0, count);
}

function validatePlacements(groupPlayers, placements) {
  const places = groupPlayers.map((name) => placements[name]);
  if (places.some((p) => p == null || !Number.isFinite(p))) return "missing";
  if (places.some((p) => p < 1 || p > groupPlayers.length || !Number.isInteger(p)))
    return "range";
  if (new Set(places).size !== places.length) return "dup";
  return null;
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const settings = {
  maxKratzer: 4,
  preferredGroupSize: 5,
  losersPerGroup: 2,
  autoShrinkBelow: 12,
};

const players30 = Array.from({ length: 30 }, (_, i) => `P${i + 1}`);
const groups30 = partitionIntoGroups(players30, 5);
assert(groups30.length === 6, "30 Spieler / 5er → 6 Gruppen");
assert(
  groups30.every((g) => g.length === 5),
  "alle Gruppen Größe 5"
);

const p11 = resolveRoundParams(11, settings);
assert(p11.losersPerGroup === 1 && p11.groupSize === 4, "unter 12 → Auto 4er / 1 Verlierer");

const p3 = resolveRoundParams(3, settings);
assert(p3.isFinale && p3.losersPerGroup === 1, "Finale bei 3 Spielern");

const scratched = getScratchRecipients(
  ["A", "B", "C", "D", "E"],
  { A: 1, B: 2, C: 3, D: 4, E: 5 },
  2
);
assert(
  scratched[0] === "E" && scratched[1] === "D",
  "unterste Plätze bekommen Kratzer"
);

assert(
  validatePlacements(["A", "B", "C"], { A: 1, B: 2, C: 3 }) === null,
  "gültige Plätze"
);
assert(
  validatePlacements(["A", "B", "C"], { A: 1, B: 1, C: 3 }) === "dup",
  "doppelte Plätze ungültig"
);

const shuffled = shuffleNames(["A", "B", "C", "D"], () => 0.1);
assert(shuffled.length === 4, "Shuffle behält Länge");

function getDisplayLifeTotal(maxKratzer) {
  return Math.max(1, maxKratzer - 1);
}
function getLifeDisplay(kratzer, maxKratzer) {
  const total = getDisplayLifeTotal(maxKratzer);
  if (kratzer >= maxKratzer) return { status: "eliminated", label: "Ausgeschieden" };
  if (kratzer === maxKratzer - 1) return { status: "swimming", label: "Schwimmt" };
  const remaining = Math.max(0, total - kratzer);
  if (remaining <= 1) return { status: "low", label: `${remaining}/${total}` };
  if (remaining >= total) return { status: "full", label: `${remaining}/${total}` };
  return { status: "ok", label: `${remaining}/${total}` };
}

assert(getLifeDisplay(0, 4).label === "3/3" && getLifeDisplay(0, 4).status === "full", "0 Kratzer → 3/3 grün");
assert(getLifeDisplay(1, 4).label === "2/3", "1 Kratzer → 2/3");
assert(getLifeDisplay(2, 4).label === "1/3" && getLifeDisplay(2, 4).status === "low", "2 Kratzer → 1/3 orange");
assert(getLifeDisplay(3, 4).label === "Schwimmt", "3 Kratzer → Schwimmt");
assert(getLifeDisplay(4, 4).label === "Ausgeschieden", "4 Kratzer → Ausgeschieden");
assert(getLifeDisplay(0, 5).label === "4/4", "Max 5 → Start 4/4");

if (failed > 0) {
  console.error(`\n${failed} Fehler`);
  process.exit(1);
}
console.log("\nAll kratzer smoke checks passed");
