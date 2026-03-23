import { MatchNode } from "../types";

export function groupMatchesByRound(
  matches: Record<string, MatchNode>
) {
  const rounds: Record<number, MatchNode[]> = {};

  Object.values(matches).forEach(match => {
    const round = parseInt(match.id.split("-")[0].slice(1));

    if (!rounds[round]) {
      rounds[round] = [];
    }

    rounds[round].push(match);
  });

  Object.values(rounds).forEach(roundMatches =>
    roundMatches.sort((a, b) => {
      const aIdx = parseInt(a.id.split("-")[1]);
      const bIdx = parseInt(b.id.split("-")[1]);
      return aIdx - bIdx;
    })
  );

  return rounds;
}