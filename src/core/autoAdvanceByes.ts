// autoAdvanceByes.ts
import { MatchNode } from "../types";
import { BYE } from "../constants";

export function autoAdvanceByes(matches: Record<string, MatchNode>){
  Object.values(matches).forEach(m=>{
    if(!m.winner){
      if(m.player1 === BYE && m.player2) m.winner = m.player2;
      else if(m.player2 === BYE && m.player1) m.winner = m.player1;
    }

    if(m.winner && m.winnerTo){
      const next = matches[m.winnerTo.matchId];
      if(!next) return;
      if(m.winnerTo.slot === 1 && !next.player1) next.player1 = m.winner;
      else if(m.winnerTo.slot === 2 && !next.player2) next.player2 = m.winner;
    }

    if(m.winner && m.loserTo){
      const next = matches[m.loserTo.matchId];
      if(!next) return;
      const loser = m.player1 === m.winner ? m.player2 : m.player1;
      if(m.loserTo.slot === 1 && !next.player1) next.player1 = loser;
      else if(m.loserTo.slot === 2 && !next.player2) next.player2 = loser;
    }
  });
}