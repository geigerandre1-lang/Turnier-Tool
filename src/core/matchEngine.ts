import { MatchNode } from "../types";

function clearAutomatInfo(m: MatchNode) {
  m.isOnAutomat = false;
  m.isNextInAutomatQueue = false;
  m.automatNumber = undefined;
  m.automatName = undefined;
}

export function setWinner(
  matches: Record<string, MatchNode>,
  matchId: string,
  winner: string
) {
  const match = matches[matchId];
  if (!match) return;

   // Vorherigen Zustand merken, um Änderungen korrekt propagieren zu können
   const prevWinner = match.winner;
   const prevLoser = prevWinner
     ? prevWinner === match.player1
       ? match.player2
       : match.player1
     : null;

   const newWinner = winner;
   const newLoser = match.player1 === newWinner ? match.player2 : match.player1;

  // **automatische Aufräumarbeiten**
  clearAutomatInfo(match);
  match.winner = newWinner;

  // Winner‑Bracket weiterleiten
  if (match.winnerTo) {
    const next = matches[match.winnerTo.matchId];
    if (next) {
      if (match.winnerTo.slot === 1) next.player1 = newWinner;
      else next.player2 = newWinner;
    }
  }

  // Loser‑Bracket
  if (match.loserTo) {
    const next = matches[match.loserTo.matchId];
    if (next) {
      const slotKey = match.loserTo.slot === 1 ? "player1" : "player2";

      // Falls der alte Verlierer bereits in diesem Slot stand und sich der Sieger ändert,
      // nachgelagerte Struktur bereinigen, bevor wir den neuen Verlierer eintragen.
      if (prevLoser && (next as any)[slotKey] === prevLoser) {
        clearMatch(matches, next.id);
      }

      // neuen Verlierer setzen (falls vorhanden)
      if (newLoser) {
        (next as any)[slotKey] = newLoser;
      }
    }
  }
}

export function clearMatch(
  matches: Record<string, MatchNode>,
  matchId: string
) {
  const match = matches[matchId];
  if (!match) return;

  clearAutomatInfo(match);

  const playersToClear: (string | null)[] = [
    match.player1,
    match.player2,
  ].filter(Boolean) as string[];

  match.winner = null;
  match.player1 = match.player1From ? null : match.player1;
  match.player2 = match.player2From ? null : match.player2;

  if (match.winnerTo) {
    const next = matches[match.winnerTo.matchId];
    if (next) {
      if (playersToClear.includes(next.player1 as string))
        next.player1 = null;
      if (playersToClear.includes(next.player2 as string))
        next.player2 = null;
      if (playersToClear.includes(next.winner as string))
        next.winner = null;
      clearMatch(matches, next.id);
    }
  }
  if (match.loserTo) {
    const next = matches[match.loserTo.matchId];
    if (next) {
      if (playersToClear.includes(next.player1 as string))
        next.player1 = null;
      if (playersToClear.includes(next.player2 as string))
        next.player2 = null;
      if (playersToClear.includes(next.winner as string))
        next.winner = null;
      clearMatch(matches, next.id);
    }
  }
}