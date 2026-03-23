import { Player, MatchNode } from "../types";

// Einfacher Jeder-gegen-Jeden-Spielplan (Round-Robin, rundenweise gruppiert)
export function buildLeague(players: Player[]): Record<string, MatchNode> {
  const matches: Record<string, MatchNode> = {};
  if (players.length < 2) return matches;

  // Round-Robin nach "Circle Method"
  const names = players.map((p) => p.name);
  const list = [...names];

  // Bei ungerader Spielerzahl ein Freilos einfügen
  if (list.length % 2 === 1) {
    list.push("__BYE__");
  }

  const n = list.length;
  const rounds = n - 1;
  let idCounter = 1;

  let rotation = [...list];

  for (let round = 0; round < rounds; round++) {
    const half = n / 2;
    for (let i = 0; i < half; i++) {
      const p1 = rotation[i];
      const p2 = rotation[n - 1 - i];

      // Paarungen mit Freilos nicht als Match anlegen
      if (p1 === "__BYE__" || p2 === "__BYE__") continue;

      const id = `L${round + 1}-${idCounter++}`;
      matches[id] = {
        id,
        player1: p1,
        player2: p2,
        winner: null,
        round,
        isLoser: false,
      };
    }

    // Rotation für nächste Runde (ersten Spieler fix lassen)
    const [first, ...rest] = rotation;
    rotation = [first, rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }

  return matches;
}
