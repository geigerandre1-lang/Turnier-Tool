// src/core/buildTournament.ts
import { MatchNode } from "../types";
import { BYE } from "../constants";
import { generateSeedOrder } from "./seeding";

export function buildTournament(
  players: string[],
  isDoubleKO: boolean
): Record<string, MatchNode> {
  const matches: Record<string, MatchNode> = {};
  const size = 2 ** Math.ceil(Math.log2(players.length));
  const seeds = generateSeedOrder(size);

  // Spieler initial setzen (mit BYEs auffüllen)
  const seededPlayers: (string | typeof BYE)[] = [];
  for (let i = 0; i < size; i++) {
    seededPlayers.push(players[seeds[i] - 1] || BYE);
  }

  // ------------------------
  // Winner-Bracket Runde 0
  // ------------------------
  let prevRound: MatchNode[] = [];
  for (let i = 0; i < seededPlayers.length; i += 2) {
    const id = `w0-${i / 2}`;
    const match: MatchNode = {
      id,
      round: 0,
      player1: seededPlayers[i],
      player2: seededPlayers[i + 1],
      winner: null,
      isLoser: false,
    };
    matches[id] = match;
    prevRound.push(match);
  }

  const winnerRounds: MatchNode[][] = [prevRound];
  let roundNumber = 1;

  // ------------------------
  // Winner-Bracket Folgerunden
  // ------------------------
  while (prevRound.length > 1) {
    const currentRound: MatchNode[] = [];
    for (let i = 0; i < prevRound.length; i += 2) {
      const id = `w${roundNumber}-${i / 2}`;
      const match: MatchNode = {
        id,
        round: roundNumber,
        player1: null,
        player2: null,
        winner: null,
        isLoser: false,
        player1From: { matchId: prevRound[i].id },
        player2From: prevRound[i + 1] ? { matchId: prevRound[i + 1].id } : null,
      };
      prevRound[i].winnerTo = { matchId: id, slot: 1 };
      if (prevRound[i + 1]) prevRound[i + 1].winnerTo = { matchId: id, slot: 2 };
      matches[id] = match;
      currentRound.push(match);
    }
    prevRound = currentRound;
    winnerRounds.push(currentRound);
    roundNumber++;
  }

  if (!isDoubleKO) return matches;

  // ------------------------
  // Loser-Bracket aufbauen
  // ------------------------
  const loserRounds: MatchNode[][] = [];

  // --- L0 aus Verlierern der WB-R0 ---
  const L0: MatchNode[] = [];
  for (let i = 0; i < winnerRounds[0].length; i += 2) {
    const id = `l0-${i / 2}`;
    const match: MatchNode = {
      id,
      round: 0,
      player1: null,
      player2: null,
      winner: null,
      isLoser: true,
    };
    winnerRounds[0][i].loserTo = { matchId: id, slot: 1 };
    if (winnerRounds[0][i + 1]) winnerRounds[0][i + 1].loserTo = { matchId: id, slot: 2 };
    matches[id] = match;
    L0.push(match);
  }
  loserRounds.push(L0);

  // --- Weitere LB-Runden dynamisch aufbauen ---
  let prevLoserRound = L0;
  let loserRoundNumber = 1;

  while (true) {
    const currentLoserRound: MatchNode[] = [];
    let hasNext = false;
    const isEvenRound = loserRoundNumber % 2 === 0;

    if (isEvenRound) {
      // beide Slots aus vorheriger LB-Runde
      for (let i = 0; i < Math.floor(prevLoserRound.length / 2); i++) {
        const id = `l${loserRoundNumber}-${i}`;
        const match: MatchNode = {
          id,
          round: loserRoundNumber,
          player1: null,
          player2: null,
          player1From: { matchId: prevLoserRound[i * 2].id },
          player2From: { matchId: prevLoserRound[i * 2 + 1].id },
          winner: null,
          isLoser: true,
        };
        prevLoserRound[i * 2].winnerTo = { matchId: id, slot: 1 };
        prevLoserRound[i * 2 + 1].winnerTo = { matchId: id, slot: 2 };
        matches[id] = match;
        currentLoserRound.push(match);
      }
      hasNext = currentLoserRound.length > 0;
    } else {
      // Slot1 aus vorheriger LB-Runde, Slot2 aus WB-Runde (Bottom-Up)
      const wbRoundIndex = Math.floor((loserRoundNumber + 1) / 2);
      const wbMatches = winnerRounds[wbRoundIndex] || [];
      const len = prevLoserRound.length;

      for (let i = 0; i < prevLoserRound.length; i++) {
        const lbMatch = prevLoserRound[i];
        const wbMatch = wbMatches[wbMatches.length - 1 - i]; // Bottom-Up

        const id = `l${loserRoundNumber}-${i}`;
        const match: MatchNode = {
          id,
          round: loserRoundNumber,
          player1: null,
          player2: null,
          player1From: { matchId: lbMatch.id },
          player2From: wbMatch ? { matchId: wbMatch.id } : null,
          winner: null,
          isLoser: true,
        };

        lbMatch.winnerTo = { matchId: id, slot: 1 };
        if (wbMatch) wbMatch.loserTo = { matchId: id, slot: 2 };

        matches[id] = match;
        currentLoserRound.push(match);
      }
      hasNext = currentLoserRound.length > 0;
    }

    if (!hasNext) break;
    prevLoserRound = currentLoserRound;
    loserRounds.push(currentLoserRound);
    loserRoundNumber++;
  }

  // ------------------------
  // Grand Finale vorbereiten
  // ------------------------
  const winnerFinal = winnerRounds[winnerRounds.length - 1][0];
  const loserFinal = prevLoserRound[0];

  const grandFinal: MatchNode = {
    id: "grandfinal",
    round: Math.max(winnerFinal.round ?? 0, loserFinal.round ?? 0) + 1,
    player1: null,
    player2: null,
    winner: null,
    isLoser: false,
    player1From: { matchId: winnerFinal.id },
    player2From: { matchId: loserFinal.id },
  };

  winnerFinal.winnerTo = { matchId: grandFinal.id, slot: 1 };
  loserFinal.winnerTo = { matchId: grandFinal.id, slot: 2 };
  matches[grandFinal.id] = grandFinal;

  return matches;
}