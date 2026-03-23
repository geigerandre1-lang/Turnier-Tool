import React from "react";
import { Bracket } from "./Bracket";
import { MatchNode } from "../types";

interface StandingRow {
  id: string;
  name: string;
  points: number;
  wins?: number;
  losses?: number;
  legsFor?: number;
  legsAgainst?: number;
  legDiff?: number;
}

interface PrintViewProps {
  matches: Record<string, MatchNode>;
  isDoubleKO: boolean;
  standings: StandingRow[];
  matchTimers: Record<string, any>;
  matchTimerMinutes: number;
  mode: "ko" | "league" | "groups";
}

export const PrintView: React.FC<PrintViewProps> = ({
  matches,
  isDoubleKO,
  standings,
  matchTimers,
  matchTimerMinutes,
  mode,
}) => {
  return (
    <div className="print-root" style={{ padding: "1rem", background: "#fff", color: "#000" }}>
      <div
        className="print-no-print"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
      >
        <h2 style={{ margin: 0 }}>Turnierübersicht</h2>
        <button
          onClick={() => window.print()}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 6,
            border: "1px solid #444",
            background: "#f0f0f0",
            cursor: "pointer",
          }}
        >
          Drucken / Export als PDF
        </button>
      </div>

      <div className="print-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Bracket für Ausdruck */}
        <div
          className="print-bracket-wrapper"
          style={{
            background: "#f9f9f9",
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        >
          <Bracket
            matches={matches}
            isDoubleKO={isDoubleKO}
            matchTimers={matchTimers}
            matchTimerMinutes={matchTimerMinutes}
            showTimers={false}
            mode={mode}
          />
        </div>

        {/* Rangliste für Ausdruck */}
        <div
          style={{
            background: "#f9f9f9",
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Rangliste</h3>
          {mode === "league" || mode === "groups" ? (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Platz</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Name</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Pkte</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Spiele</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Siege</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Niederl.</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Legs +/-</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ccc" }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => {
                  const games = (s.wins ?? 0) + (s.losses ?? 0);
                  const legsPlusMinus = `${s.legsFor ?? 0}:${s.legsAgainst ?? 0}`;
                  return (
                    <tr key={s.id || s.name}>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid #eee" }}>{idx + 1}</td>
                      <td style={{ padding: "3px 6px", borderBottom: "1px solid #eee" }}>{s.name}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #eee" }}>{s.points}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #eee" }}>{games}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #eee" }}>{s.wins ?? 0}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #eee" }}>{s.losses ?? 0}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #eee" }}>{legsPlusMinus}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: "1px solid #eee" }}>{s.legDiff ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #ccc" }}>Platz</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #ccc" }}>Name</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", borderBottom: "1px solid #ccc" }}>Punkte</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => (
                  <tr key={s.id || s.name}>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>{idx + 1}</td>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>{s.name}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderBottom: "1px solid #eee" }}>{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
