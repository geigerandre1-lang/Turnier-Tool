// core/buildDoubleElimination.ts
import { MatchNode } from "../types";
import { BYE } from "../constants";
import { generateSeedOrder } from "./seeding";

/**
 * Baut ein Double-KO-Turnier auf.
 * @param players Liste der Spielernamen
 */
export function buildDoubleElimination(players: string[]): Record<string, MatchNode> {
  const matches: Record<string, MatchNode> = {};

  // nächste Potenz von 2
  const size = 2 ** Math.ceil(Math.log2(players.length));

  // Seeds berechnen
  const seeds = generateSeedOrder(size);

  // Spieler nach Seed platzieren
  const seededPlayers: (string | typeof BYE)[] = [];
  for (let i = 0; i < size; i++) {
    const player = players[seeds[i] - 1] || BYE;
    seededPlayers.push(player);
  }

  // ------------------------
  // Winner-Bracket Runde 0
  // ------------------------
  const winnerR0: MatchNode[] = [];
  for (let i = 0; i < seededPlayers.length; i += 2) {
    const matchId = `w0-${i / 2}`;
    const match: MatchNode = {
      id: matchId,
      round: 0,
      player1: seededPlayers[i],
      player2: seededPlayers[i + 1],
      winner: null,
    };
    winnerR0.push(match);
    matches[matchId] = match;
  }

  // ------------------------
  // Folgerunden Winner-Bracket
  // ------------------------
  let prevRound = winnerR0;
  let roundNumber = 1;
  while (prevRound.length > 1) {
    const currentRound: MatchNode[] = [];
    for (let i = 0; i < prevRound.length; i += 2) {
      const matchId = `w${roundNumber}-${i / 2}`;
      const match: MatchNode = {
        id: matchId,
        round: roundNumber,
        player1: null,
        player2: null,
        winner: null,
        player1From: { matchId: prevRound[i].id },
        player2From: prevRound[i + 1] ? { matchId: prevRound[i + 1].id } : undefined,
      };

      prevRound[i].winnerTo = { matchId, slot: 1 };
      if (prevRound[i + 1]) prevRound[i + 1].winnerTo = { matchId, slot: 2 };

      currentRound.push(match);
      matches[matchId] = match;
    }
    prevRound = currentRound;
    roundNumber++;
  }

  // ------------------------
  // Loser-Bracket vorbereiten
  // ------------------------
  // einfache Initialisierung der ersten Loser-Runde
  const loserMatches: MatchNode[] = [];
  prevRound = winnerR0;
  let lRoundNumber = 0;

  for (let i = 0; i < prevRound.length; i += 2) {
    const matchId = `l${lRoundNumber}-${i / 2}`;
    const match: MatchNode = {
      id: matchId,
      round: lRoundNumber,
      player1: null, // wird vom Verlierer der Winner-Runde gesetzt
      player2: null,
      winner: null,
    };
    loserMatches.push(match);
    matches[matchId] = match;
  }

  // Winner -> Loser-Verbindungen setzen
  // (eigentlich wird dies dynamisch in matchEngine oder beim autoAdvanceByes genutzt)
  // Wir setzen nur die Struktur vor, Spieler kommen erst nach Matchverlust

  return matches;
}