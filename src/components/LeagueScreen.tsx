import React from "react";
import { Player, MatchNode } from "../types";

interface LeagueScreenProps {
  players: Player[];
  matches: Record<string, MatchNode>;
  onSetWinner: (matchId: string, winner: string | null) => void;
}

// Momentan ungenutzte Übersicht für Liga-Matches (kann später eingebunden werden)
export const LeagueScreen: React.FC<LeagueScreenProps> = ({ players, matches, onSetWinner }) => {
  const matchList = React.useMemo(
    () => Object.values(matches).filter(m => m.player1 && m.player2).sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id)),
    [matches]
  );

  const handleClick = (m: MatchNode, player: string) => {
    if (m.winner === player) {
      onSetWinner(m.id, null);
    } else {
      onSetWinner(m.id, player);
    }
  };

  const standings = React.useMemo(() => {
    const wins: Record<string, number> = {};
    players.forEach(p => { wins[p.name] = 0; });
    matchList.forEach(m => {
      if (m.winner) {
        wins[m.winner] = (wins[m.winner] ?? 0) + 1;
      }
    });
    return [...players].sort((a, b) => (wins[b.name] ?? 0) - (wins[a.name] ?? 0));
  }, [players, matchList]);

  return (
    <div style={{ display: "flex", gap: 32 }}>
      <div style={{ flex: 2 }}>
        <h2>Ligaspiele</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 4 }}>Match</th>
              <th style={{ textAlign: "left", padding: 4 }}>Spieler 1</th>
              <th style={{ textAlign: "left", padding: 4 }}>Spieler 2</th>
              <th style={{ textAlign: "left", padding: 4 }}>Sieger</th>
            </tr>
          </thead>
          <tbody>
            {matchList.map(m => (
              <tr key={m.id}>
                <td style={{ padding: 4 }}>{m.id} (R{(m.round ?? 0) + 1})</td>
                <td
                  style={{
                    padding: 4,
                    cursor: "pointer",
                    background: m.winner === m.player1 ? "#2e7d32" : "#1e1e1e",
                    color: "#fff",
                  }}
                  onClick={() => handleClick(m, m.player1 as string)}
                >
                  {m.player1}
                </td>
                <td
                  style={{
                    padding: 4,
                    cursor: "pointer",
                    background: m.winner === m.player2 ? "#2e7d32" : "#1e1e1e",
                    color: "#fff",
                  }}
                  onClick={() => handleClick(m, m.player2 as string)}
                >
                  {m.player2}
                </td>
                <td style={{ padding: 4 }}>{m.winner ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ flex: 1 }}>
        <h2>Ligatabelle</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 4 }}>Platz</th>
              <th style={{ textAlign: "left", padding: 4 }}>Name</th>
              <th style={{ textAlign: "right", padding: 4 }}>Siege</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((p, idx) => (
              <tr key={p.id}>
                <td style={{ padding: 4 }}>{idx + 1}</td>
                <td style={{ padding: 4 }}>{p.name}</td>
                <td style={{ padding: 4, textAlign: "right" }}>
                  {matchList.filter(m => m.winner === p.name).length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
