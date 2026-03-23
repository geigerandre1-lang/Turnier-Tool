// src/core/buildRoundRobinGroups.ts
import { Player, MatchNode } from "../types";

// Round-Robin-Gruppenphase: Spieler in Gruppen aufteilen und innerhalb jeder Gruppe
// einen rundenbasierten Jeder-gegen-Jeden-Spielplan erzeugen (ähnlich buildLeague).
export function buildRoundRobinGroups(players: Player[], groupSize: number): Record<string, MatchNode> {
  const size = Math.max(2, groupSize || 4);
  if (players.length < 2) return {};

  // Spieler zufällig mischen
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Anzahl Gruppen so wählen, dass sie möglichst gleich groß sind
  const groupCount = Math.ceil(shuffled.length / size);
  const groups: Player[][] = Array.from({ length: groupCount }, () => []);

  // Spieler im Snake-Verfahren auf Gruppen verteilen
  shuffled.forEach((p, index) => {
    const g = index % groupCount;
    groups[g].push(p);
  });

  const matches: Record<string, MatchNode> = {};
  let globalIdCounter = 1;

  groups.forEach((groupPlayers, groupIndex) => {
    const names = groupPlayers.map((p) => p.name);
    if (names.length < 1) return;

    // Gruppe mit Freilosen auf Wunsch-Gruppengröße auffüllen
    while (names.length < size) {
      names.push("__BYE__");
    }

    // Bei ungerader Gruppengröße noch ein weiteres Freilos hinzufügen,
    // damit die Circle-Methode funktioniert
    const list = [...names];
    if (list.length % 2 === 1) {
      list.push("__BYE__");
    }

    const n = list.length;
    const rounds = n - 1;
    let rotation = [...list];

    for (let round = 0; round < rounds; round++) {
      const half = n / 2;
      for (let i = 0; i < half; i++) {
        const p1 = rotation[i];
        const p2 = rotation[n - 1 - i];

        // Paarungen mit Freilos nicht als Match anlegen
        if (p1 === "__BYE__" || p2 === "__BYE__") continue;

        const id = `G${groupIndex + 1}-R${round + 1}-M${globalIdCounter++}`;
        matches[id] = {
          id,
          player1: p1,
          player2: p2,
          winner: null,
          round,
          group: groupIndex,
          isLoser: false,
        };
      }

      // Rotation für nächste Runde (ersten Spieler fix lassen)
      const [first, ...rest] = rotation;
      rotation = [first, rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
    }
  });

  return matches;
}
