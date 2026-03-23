import { MatchNode } from "../types";
import { BYE } from "../constants";
import { generateSeedOrder } from "./seeding";

export function buildSingleElimination(players: string[]): Record<string, MatchNode> {
  const matches: Record<string, MatchNode> = {};

  // Nächste Potenz von 2
  const size = 2 ** Math.ceil(Math.log2(players.length));

  // Seeds berechnen
  const seeds = generateSeedOrder(size);

  // Spieler nach Seed platzieren (null/Bye, falls Spieler fehlen)
  const seededPlayers: (string | typeof BYE)[] = [];
  for (let i = 0; i < size; i++) {
    const player = players[seeds[i] - 1] || BYE;
    seededPlayers.push(player);
  }

  // ------------------------
  // Runde 0 erstellen
  // ------------------------
  const firstRoundMatches: MatchNode[] = [];
  for (let i = 0; i < seededPlayers.length; i += 2) {
    const matchId = `r0-${i / 2}`;
    const match: MatchNode = {
      id: matchId,
      round: 0,
      player1: seededPlayers[i],
      player2: seededPlayers[i + 1],
      winner: null,
    };
    firstRoundMatches.push(match);
    matches[matchId] = match;
  }

  let prevRound = firstRoundMatches;
  let roundNumber = 1;

  // ------------------------
  // Folgerunden erstellen
  // ------------------------
  while (prevRound.length > 1) {
    const currentRound: MatchNode[] = [];

    for (let i = 0; i < prevRound.length; i += 2) {
      const matchId = `r${roundNumber}-${i / 2}`;
      const match: MatchNode = {
        id: matchId,
        round: roundNumber,
        player1: null,
        player2: null,
        winner: null,
        player1From: { matchId: prevRound[i].id },
        player2From: prevRound[i + 1] ? { matchId: prevRound[i + 1].id } : undefined,
      };

      // winnerTo für Kinder setzen
      prevRound[i].winnerTo = { matchId, slot: 1 };
      if (prevRound[i + 1]) prevRound[i + 1].winnerTo = { matchId, slot: 2 };

      currentRound.push(match);
      matches[matchId] = match;
    }

    prevRound = currentRound;
    roundNumber++;
  }

  return matches;
}