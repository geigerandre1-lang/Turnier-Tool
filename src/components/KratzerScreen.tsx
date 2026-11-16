import React, { useMemo } from "react";
import { MatchNode, Player } from "../types";
import {
  getActivePlayers,
  getLifeDisplay,
  type KratzerLives,
  type KratzerSettings,
} from "../core/kratzer";

interface KratzerScreenProps {
  players: Player[];
  matches: Record<string, MatchNode>;
  lives: KratzerLives;
  settings: KratzerSettings;
  currentRound: number;
  tournamentWinner: string | null;
  onOpenResultModal: (matchId: string) => void;
  onAdvanceRound: () => void;
}

export const KratzerScreen: React.FC<KratzerScreenProps> = ({
  players,
  matches,
  lives,
  settings,
  currentRound,
  tournamentWinner,
  onOpenResultModal,
  onAdvanceRound,
}) => {
  const active = useMemo(
    () => getActivePlayers(lives, settings.maxKratzer),
    [lives, settings.maxKratzer]
  );

  const standings = useMemo(() => {
    return [...players]
      .map((p) => {
        const k = lives[p.name] ?? 0;
        const display = getLifeDisplay(k, settings.maxKratzer);
        return {
          name: p.name,
          kratzer: k,
          display,
          startKratzer: p.startKratzer ?? 0,
        };
      })
      .sort((a, b) => {
        const aOut = a.display.status === "eliminated";
        const bOut = b.display.status === "eliminated";
        if (aOut !== bOut) return aOut ? 1 : -1;
        if (a.kratzer !== b.kratzer) return a.kratzer - b.kratzer;
        return a.name.localeCompare(b.name);
      });
  }, [players, lives, settings.maxKratzer]);

  const roundMatches = useMemo(
    () =>
      Object.values(matches)
        .filter((m) => (m.round ?? 0) === currentRound)
        .sort((a, b) => (a.group ?? 0) - (b.group ?? 0) || a.id.localeCompare(b.id)),
    [matches, currentRound]
  );

  const roundDone =
    roundMatches.length > 0 && roundMatches.every((m) => !!m.winner);
  const canAdvance = roundDone && !tournamentWinner && active.length > 1;

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "1rem",
        color: "#eee",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Kratzerturnier – Runde {currentRound}</h2>
      <div style={{ color: "#bbb", marginBottom: 16, fontSize: 14 }}>
        Max {settings.maxKratzer} Kratzer · Zielgruppengröße {settings.preferredGroupSize} ·{" "}
        {settings.losersPerGroup} Verlierer/Gruppe (vor Auto-Anpassung) ·{" "}
        {active.length} aktiv
      </div>

      {tournamentWinner && (
        <div
          style={{
            marginBottom: 16,
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "#1b5e20",
            border: "1px solid #4CAF50",
            fontWeight: "bold",
          }}
        >
          Turniersieger: {tournamentWinner}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 320px) 1fr",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#1e1e1e",
            borderRadius: 10,
            padding: 12,
            border: "1px solid #333",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Leben</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {standings.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.4rem 0.55rem",
                  borderRadius: 6,
                  background:
                    s.display.status === "eliminated"
                      ? "#3a1a1a"
                      : s.display.status === "swimming"
                      ? "#10253a"
                      : s.display.status === "low"
                      ? "#3a2a10"
                      : "#2a2a2a",
                  opacity: s.display.status === "eliminated" ? 0.7 : 1,
                  fontSize: 13,
                }}
              >
                <span>{s.name}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: s.display.color,
                  }}
                >
                  {s.display.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#1e1e1e",
            borderRadius: 10,
            padding: 12,
            border: "1px solid #333",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>Gruppen dieser Runde</h3>
            {canAdvance && (
              <button
                onClick={onAdvanceRound}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#4CAF50",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Nächste Runde auslosen
              </button>
            )}
            {roundDone && !tournamentWinner && active.length <= 1 && (
              <span style={{ color: "#81c784", fontSize: 13 }}>Turnier beendet</span>
            )}
            {!roundDone && roundMatches.length > 0 && (
              <span style={{ color: "#ffcc80", fontSize: 13 }}>
                Ergebnisse eintragen, danach nächste Runde
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {roundMatches.map((m) => {
              const group = m.groupPlayers ?? [];
              const losers = m.losersCount ?? 1;
              return (
                <div
                  key={m.id}
                  style={{
                    border: "1px solid #444",
                    borderRadius: 8,
                    padding: 12,
                    background: m.winner ? "#1a2a1a" : "#222",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      Gruppe {(m.group ?? 0) + 1}{" "}
                      <span style={{ color: "#888", fontWeight: 400 }}>({m.id})</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#bbb" }}>
                      {m.isOnAutomat
                        ? `Automat ${m.automatNumber ?? "?"}`
                        : m.winner
                        ? "Abgeschlossen"
                        : "Wartet / Queue"}{" "}
                      · {losers} Verlierer
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      marginBottom: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {group.map((name) => {
                      const d = getLifeDisplay(lives[name] ?? 0, settings.maxKratzer);
                      return (
                        <span key={name}>
                          {name}{" "}
                          <span style={{ color: d.color, fontWeight: 600 }}>({d.label})</span>
                        </span>
                      );
                    })}
                  </div>
                  {m.winner && m.placements && (
                    <div style={{ fontSize: 13, color: "#ccc", marginBottom: 8 }}>
                      Platzierung:{" "}
                      {group
                        .slice()
                        .sort(
                          (a, b) =>
                            (m.placements?.[a] ?? 99) - (m.placements?.[b] ?? 99)
                        )
                        .map((name) => `${m.placements?.[name]}. ${name}`)
                        .join(", ")}
                    </div>
                  )}
                  {!m.winner && (
                    <button
                      onClick={() => onOpenResultModal(m.id)}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: 8,
                        border: "none",
                        background: "#2196F3",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Plätze eintragen
                    </button>
                  )}
                </div>
              );
            })}
            {roundMatches.length === 0 && (
              <div style={{ color: "#999" }}>Noch keine Gruppen in dieser Runde.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
