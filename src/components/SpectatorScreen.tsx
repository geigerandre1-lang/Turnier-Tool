// src/components/SpectatorScreen.tsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import { Bracket } from "./Bracket";
import { Player, MatchNode, Automat } from "../types";

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

interface SpectatorScreenProps {
  matches: Record<string, MatchNode>;
  automats: Automat[];
  players: Player[];
  matchTimers: Record<string, any>;
  matchTimerMinutes: number;
  standings: StandingRow[];
  isDoubleKO: boolean;
  mode: "ko" | "league" | "groups";
  pointScheme?: { win: number; loss: number };
  groupPhaseMatches?: Record<string, MatchNode>;
  timersEnabled?: boolean;
  publicAnnouncement?: string;
  variant?: "full" | "bracket" | "standings" | "automats";
}

export const SpectatorScreen: React.FC<SpectatorScreenProps> = ({
  matches,
  automats,
  players,
  matchTimers,
  matchTimerMinutes,
  standings,
  isDoubleKO,
  mode,
  pointScheme,
  groupPhaseMatches,
  timersEnabled,
  publicAnnouncement,
  variant = "full",
}) => {
  const getPlayerName = (id: string | null) =>
    id ? players.find((p) => p.id === id)?.name || id : "-";

  const getMatchBorderColor = (match?: MatchNode | null) => {
    if (!match || !match.player1 || !match.player2) return "#555";
    if (match.winner) return "#4CAF50";
    if (match.isOnAutomat) return "#2196F3";
    if (match.isNextInAutomatQueue) return "#FFEB3B";
    if (match.player1 && match.player2) return "#FFA726";
    return "#555";
  };

  const bracketViewportRef = useRef<HTMLDivElement | null>(null);
  const bracketContentRef = useRef<HTMLDivElement | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    moved: false,
  });
  const [showStandings, setShowStandings] = useState<boolean>(() => variant === "standings");
  const [isNarrow, setIsNarrow] = useState(false);
  const hasAnnouncement = !!publicAnnouncement && publicAnnouncement.trim().length > 0;

  useEffect(() => {
    const updateScale = () => {
      const vp = bracketViewportRef.current;
      const content = bracketContentRef.current;
      if (!vp || !content) return;
      const vw = vp.clientWidth;
      const vh = vp.clientHeight;
      const cw = content.scrollWidth;
      const ch = content.scrollHeight;
      if (!cw || !ch) return;
      const s = Math.min(vw / cw, vh / ch, 1);
      setBaseScale(s);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [matches, isDoubleKO]);

  // Einfache Responsive-Logik: unter ca. 768px Breite gilt die Ansicht als "schmal" (z.B. Smartphone)
  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleBracketClick = () => {
    const state = dragStateRef.current;
    if (state.moved) {
      return;
    }
    setOffset({ x: 0, y: 0 });
    setZoomLevel((prev) => (prev > 1 ? 1 : 1.6));
  };

  const beginDrag = (clientX: number, clientY: number) => {
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
      moved: false,
    };
  };

  const updateDrag = (clientX: number, clientY: number) => {
    const state = dragStateRef.current;
    if (!state.dragging) return;
    const dx = clientX - state.startX;
    const dy = clientY - state.startY;
    if (!state.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      state.moved = true;
    }
    setOffset({ x: state.startOffsetX + dx, y: state.startOffsetY + dy });
  };

  const endDrag = () => {
    dragStateRef.current.dragging = false;
  };

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    beginDrag(e.clientX, e.clientY);
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    updateDrag(e.clientX, e.clientY);
  };

  const handleMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    endDrag();
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const t = e.touches[0];
    if (!t) return;
    beginDrag(t.clientX, t.clientY);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const t = e.touches[0];
    if (!t) return;
    updateDrag(t.clientX, t.clientY);
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    endDrag();
  };

  const groupStandings = useMemo(() => {
    const source = mode === "groups" ? matches : groupPhaseMatches;
    if (!source) return {} as Record<number, StandingRow[]>;

    const byGroup: Record<number, StandingRow[]> = {};

    Object.values(source).forEach((m) => {
      if (!m.player1 || !m.player2) return;
      if (typeof m.group !== "number") return;
      const g = m.group;
      if (!byGroup[g]) byGroup[g] = [];

      const ensureRow = (name: string) => {
        let row = byGroup[g].find((r) => r.name === name);
        if (!row) {
          row = {
            id: name,
            name,
            points: 0,
            wins: 0,
            losses: 0,
            legsFor: 0,
            legsAgainst: 0,
            legDiff: 0,
          };
          byGroup[g].push(row);
        }
        return row;
      };

      const row1 = ensureRow(m.player1);
      const row2 = ensureRow(m.player2);

      const l1 = m.legs1 ?? 0;
      const l2 = m.legs2 ?? 0;

      row1.legsFor = (row1.legsFor ?? 0) + l1;
      row1.legsAgainst = (row1.legsAgainst ?? 0) + l2;
      row2.legsFor = (row2.legsFor ?? 0) + l2;
      row2.legsAgainst = (row2.legsAgainst ?? 0) + l1;

      if (m.winner === m.player1) {
        row1.wins = (row1.wins ?? 0) + 1;
        row2.losses = (row2.losses ?? 0) + 1;
      } else if (m.winner === m.player2) {
        row2.wins = (row2.wins ?? 0) + 1;
        row1.losses = (row1.losses ?? 0) + 1;
      }
    });

    Object.values(byGroup).forEach((rows) => {
      rows.forEach((row) => {
        if (pointScheme) {
          row.points = (row.wins ?? 0) * pointScheme.win + (row.losses ?? 0) * pointScheme.loss;
        }
        row.legDiff = (row.legsFor ?? 0) - (row.legsAgainst ?? 0);
      });
      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.legDiff ?? 0;
        const diffB = b.legDiff ?? 0;
        if (diffB !== diffA) return diffB - diffA;
        return (b.legsFor ?? 0) - (a.legsFor ?? 0);
      });
    });

    return byGroup;
  }, [mode, matches, groupPhaseMatches, pointScheme]);

  // In der reinen Tabellenansicht soll die Tabelle immer ausgeklappt sein
  const effectiveShowStandings = variant === "standings" ? true : showStandings;

  return (
    <div
      style={{
        padding: "1rem",
        height: isNarrow ? "auto" : "100vh",
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        background: "#000",
      }}
    >
      {hasAnnouncement && (
        <div
          style={{
            marginBottom: 8,
            padding: "0.6rem 0.8rem",
            borderRadius: 8,
            background: "#263238",
            color: "#fff",
            border: "1px solid #4FC3F7",
            fontSize: 14,
            whiteSpace: "pre-wrap",
          }}
        >
          {publicAnnouncement}
        </div>
      )}

      {variant !== "automats" && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: isNarrow ? "column" : "row",
            gap: 16,
          }}
        >
          {variant !== "standings" && (
            <div
              ref={bracketViewportRef}
              style={{
                position: "relative",
                flex: variant === "bracket" ? 1 : 3,
                background: "#111",
                borderRadius: 8,
                overflow: "hidden",
                padding: "0.5rem",
              }}
              onClick={handleBracketClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                ref={bracketContentRef}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${baseScale * zoomLevel})`,
                  transformOrigin: "top left",
                  width: "max-content",
                  height: "max-content",
                }}
              >
                <Bracket
                  matches={matches}
                  isDoubleKO={isDoubleKO}
                  embedded
                  matchTimers={matchTimers}
                  matchTimerMinutes={matchTimerMinutes}
                  showTimers={false}
                  mode={mode}
                />
              </div>
            </div>
          )}

          {variant !== "bracket" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #444",
                  overflow: "hidden",
                  background: "#1e1e1e",
                  color: "#eee",
                }}
              >
                <div
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #333",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    {mode === "groups" || (mode === "ko" && groupPhaseMatches)
                      ? "Gruppen – Ranglisten"
                      : "Rangliste"}
                  </h3>
                  {variant !== "standings" && (
                    <button
                      onClick={() => setShowStandings((v) => !v)}
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: 999,
                        border: "1px solid #555",
                        background: "#111",
                        color: "#eee",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {effectiveShowStandings ? "▲ Verbergen" : "▼ Anzeigen"}
                    </button>
                  )}
                </div>
                {effectiveShowStandings && (
                  mode === "groups" || (mode === "ko" && groupPhaseMatches)
                    ? (() => {
                        const groupKeys = Object.keys(groupStandings)
                          .map((k) => Number(k))
                          .sort((a, b) => a - b);
                        if (groupKeys.length === 0) {
                          return (
                            <div style={{ padding: 8, fontSize: 13, color: "#aaa" }}>
                              Noch keine Gruppenergebnisse verfügbar.
                            </div>
                          );
                        }
                        return (
                          <>
                            {groupKeys.map((g) => {
                              const rows = groupStandings[g] || [];
                              return (
                                <div key={g} style={{ borderBottom: "1px solid #333" }}>
                                  <div
                                    style={{
                                      padding: 6,
                                      background: "#202020",
                                      borderBottom: "1px solid #333",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    Gruppe {g + 1}
                                  </div>
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                                      padding: 8,
                                      background: "#171717",
                                      color: "#aaa",
                                      fontWeight: "bold",
                                      fontSize: 12,
                                    }}
                                  >
                                    <div>Name</div>
                                    <div style={{ textAlign: "right" }}>Punkte</div>
                                    <div style={{ textAlign: "right" }}>Spiele</div>
                                    <div style={{ textAlign: "right" }}>Siege</div>
                                    <div style={{ textAlign: "right" }}>Niederl.</div>
                                    <div style={{ textAlign: "right" }}>Legs +/-</div>
                                    <div style={{ textAlign: "right" }}>Leg-Diff</div>
                                  </div>
                                  {rows.map((s, idx) => {
                                    const games = (s.wins ?? 0) + (s.losses ?? 0);
                                    const legsPlusMinus = `${s.legsFor ?? 0}:${
                                      s.legsAgainst ?? 0
                                    }`;
                                    return (
                                      <div
                                        key={s.id || s.name}
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns:
                                            "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                                          padding: 8,
                                          background:
                                            idx % 2 === 0 ? "#1a1a1a" : "#141414",
                                          fontSize: 12,
                                        }}
                                      >
                                        <div style={{ color: "#ff5252", fontWeight: 500 }}>{s.name}</div>
                                        <div style={{ textAlign: "right" }}>{s.points}</div>
                                        <div style={{ textAlign: "right" }}>{games}</div>
                                        <div style={{ textAlign: "right" }}>{s.wins ?? 0}</div>
                                        <div style={{ textAlign: "right" }}>{s.losses ?? 0}</div>
                                        <div style={{ textAlign: "right" }}>{legsPlusMinus}</div>
                                        <div style={{ textAlign: "right" }}>{s.legDiff ?? 0}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()
                    : mode === "league"
                    ? (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                            padding: 12,
                            background: "#171717",
                            color: "#aaa",
                            fontWeight: "bold",
                          }}
                        >
                          <div>Name</div>
                          <div style={{ textAlign: "right" }}>Punkte</div>
                          <div style={{ textAlign: "right" }}>Spiele</div>
                          <div style={{ textAlign: "right" }}>Siege</div>
                          <div style={{ textAlign: "right" }}>Niederl.</div>
                          <div style={{ textAlign: "right" }}>Legs +/-</div>
                          <div style={{ textAlign: "right" }}>Leg-Diff</div>
                        </div>
                        {standings.map((s, idx) => {
                          const games = (s.wins ?? 0) + (s.losses ?? 0);
                          const legsPlusMinus = `${s.legsFor ?? 0}:${
                            s.legsAgainst ?? 0
                          }`;
                          return (
                            <div
                              key={s.id || s.name}
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                                padding: 12,
                                background:
                                  idx % 2 === 0 ? "#1a1a1a" : "#141414",
                              }}
                            >
                              <div style={{ color: "#ff5252", fontWeight: 500 }}>{s.name}</div>
                              <div style={{ textAlign: "right" }}>{s.points}</div>
                              <div style={{ textAlign: "right" }}>{games}</div>
                              <div style={{ textAlign: "right" }}>{s.wins ?? 0}</div>
                              <div style={{ textAlign: "right" }}>{s.losses ?? 0}</div>
                              <div style={{ textAlign: "right" }}>{legsPlusMinus}</div>
                              <div style={{ textAlign: "right" }}>{s.legDiff ?? 0}</div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            padding: 12,
                            background: "#171717",
                            color: "#aaa",
                            fontWeight: "bold",
                          }}
                        >
                          <div>Name</div>
                          <div style={{ textAlign: "right" }}>Punkte</div>
                        </div>
                        {standings.map((s, idx) => (
                          <div
                            key={s.id || s.name}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              padding: 12,
                              background:
                                idx % 2 === 0 ? "#1a1a1a" : "#141414",
                            }}
                          >
                            <div style={{ color: "#ff5252", fontWeight: 500 }}>{s.name}</div>
                            <div style={{ textAlign: "right" }}>{s.points}</div>
                          </div>
                        ))}
                      </>
                    )
                )}
              </div>

              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #444",
                  overflow: "hidden",
                  background: "#1e1e1e",
                  color: "#eee",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div style={{ padding: 8, borderBottom: "1px solid #333" }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Nächste Spiele</h3>
                </div>
                <div
                  style={{
                    maxHeight: "100%",
                    overflowY: "auto",
                  }}
                >
                  {Object.values(matches)
                    .filter((m) => m.player1 && m.player2 && !m.winner && !m.isOnAutomat)
                    .sort((a, b) => {
                      const ra = a.round ?? 0;
                      const rb = b.round ?? 0;
                      if (ra !== rb) return ra - rb;
                      return a.id.localeCompare(b.id);
                    })
                    .slice(0, 10)
                    .map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #333",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                          {m.id}
                          {typeof m.round === "number" ? ` (R${m.round + 1})` : ""}
                        </div>
                        <div>
                          <span style={{ color: "#ff5252", fontWeight: 500 }}>{getPlayerName(m.player1)}</span>
                          {" "}vs.{" "}
                          <span style={{ color: "#ff5252", fontWeight: 500 }}>{getPlayerName(m.player2)}</span>
                        </div>
                      </div>
                    ))}
                  {Object.values(matches).filter((m) => m.player1 && m.player2 && !m.winner && !m.isOnAutomat).length ===
                    0 && (
                    <div style={{ padding: 8, fontSize: 13, color: "#aaa" }}>
                      Keine offenen Spiele in der Warteschlange.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(variant === "full" || variant === "automats") && (
        <div
          style={{
            display: "flex",
            gap: 16,
            height:
              variant === "automats"
                ? "100%"
                : isNarrow
                ? "50vh"
                : "35vh",
            minHeight: 200,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: isNarrow
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(4, minmax(0, 1fr))",
              gap: 12,
              alignContent: "flex-start",
              overflow: "hidden",
            }}
          >
            {automats
              .filter((a) => a.active)
              .map((a) => {
              const match = a.currentMatch ? matches[a.currentMatch] : null;
              const timer = a.currentMatch ? matchTimers[a.currentMatch] : null;
              const timerSeconds = timer ? timer.secondsLeft : matchTimerMinutes * 60;
              const timerExpired = timerSeconds <= 0;
              return (
                <div
                  key={a.id}
                  style={{
                    background: timerExpired ? "#c62828" : "#222",
                    color: "#fff",
                    borderRadius: 10,
                    padding: 12,
                    boxShadow: "0 0 8px rgba(0,0,0,0.2)",
                    border: `2px solid ${getMatchBorderColor(match)}`,
                  }}
                >
                  <div style={{ fontWeight: "bold", fontSize: 20, marginBottom: 4 }}>
                    Automat {a.id}
                  </div>
                  {match ? (
                    <>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>Match: {match.id}</div>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>
                        <span style={{ color: "#ff5252", fontWeight: 600 }}>{getPlayerName(match.player1)}</span>
                        {" "}vs.{" "}
                        <span style={{ color: "#ff5252", fontWeight: 600 }}>{getPlayerName(match.player2)}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          color: timerExpired ? "#ff5252" : "#fff",
                          fontWeight: "bold",
                        }}
                      >
                        {Math.floor(timerSeconds / 60)}:
                        {(timerSeconds % 60).toString().padStart(2, "0")}
                      </div>
                      {timer && !match.winner && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "0.2rem 0.5rem",
                            borderRadius: 6,
                            border: "1px solid #555",
                            background: "#111",
                            color: "#fff",
                            fontSize: 12,
                            display: "inline-block",
                          }}
                        >
                          {timer.phase === "playing" ? "Spiel läuft" : "Warte auf Spieler"}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 14 }}>Kein Match zugewiesen</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
