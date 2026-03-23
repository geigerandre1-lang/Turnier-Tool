// src/components/DebugPanel.tsx
import { useState } from "react";
import { MatchNode } from "../types";

interface Standing {
  id: string;
  name: string;
  points: number;
}

interface PointScheme {
  win: number;
  loss: number;
}

interface DebugPanelProps {
  matches: Record<string, MatchNode>;
  standings: Standing[];
  pointScheme: PointScheme;
}

export function DebugPanel({ matches, standings, pointScheme }: DebugPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const matchArray = Object.values(matches);

  return (
    <div style={{ maxWidth: 1800, margin: "2rem auto" }}>
      <h3
        style={{
          color: "#ccc",
          textAlign: "center",
          marginBottom: "1rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        Debug Panel {collapsed ? "▶" : "▼"}
      </h3>
      {!collapsed && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>Punkteschlüssel</div>
              <div style={{ color: "#bbb" }}>
                Sieg: {pointScheme.win} Punkte · Niederlage: {pointScheme.loss} Punkte
              </div>
            </div>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>Standings</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {standings.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#eee" }}>{s.name}</span>
                    <span style={{ color: "#ccc" }}>{s.points}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 12,
            }}
          >
            {matchArray.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: m.winner ? "#2e7d32" : "#1e1e1e",
                  color: "#eee",
                  boxShadow: "0 0 8px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: "bold" }}>Match: {m.id}</div>
                <div>Player 1: {m.player1 || "-"}</div>
                <div>Player 2: {m.player2 || "-"}</div>
                <div>
                  Winner: {m.winner ? m.winner : <span style={{ color: "#bbb" }}>pending</span>}
                </div>
                <div>Status: {m.winner ? "Completed" : "Open"}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}