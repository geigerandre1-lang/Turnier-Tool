// src/components/ManagementScreen.tsx
import React, { useState, useMemo } from "react";
import { MatchNode } from "../types";

interface Standing {
  id: string;
  name: string;
  points: number;
  wins?: number;
  losses?: number;
  legsFor?: number;
  legsAgainst?: number;
  legDiff?: number;
}

interface ManagementScreenProps {
  standings: Standing[];
  pointScheme: { win: number; loss: number };
  exportTournament: () => void;
  importTournament: (data: any) => void;
  onClose: () => void;
  mode?: "ko" | "league" | "groups";
  matches?: Record<string, MatchNode>;
  bestOf?: number;
  onOpenResultModal?: (matchId: string) => void;
  onStartKOFromGroups?: (qualifiers: string[], isDoubleKO: boolean) => void;
  groupPhaseMatches?: Record<string, MatchNode>;
  onReturnToGroups?: () => void;
  canReturnToGroups?: boolean;
  publicAnnouncement: string;
  setPublicAnnouncement: (value: string) => void;
  spectatorUrl?: string;
  onSendAnnouncementNotification?: () => void;
}

export const ManagementScreen: React.FC<ManagementScreenProps> = ({
  standings,
  pointScheme,
  exportTournament,
  importTournament,
  onClose,
  mode,
  matches,
  bestOf,
  onOpenResultModal,
  onStartKOFromGroups,
  groupPhaseMatches,
  onReturnToGroups,
  canReturnToGroups,
  publicAnnouncement,
  setPublicAnnouncement,
  spectatorUrl,
  onSendAnnouncementNotification,
}) => {
  const [importError, setImportError] = useState<string | null>(null);
  const [koSetupOpen, setKoSetupOpen] = useState(false);
  const [selectedQualifiers, setSelectedQualifiers] = useState<Set<string>>(new Set());
  const [koDouble, setKoDouble] = useState(false);
  const [copiedSpectator, setCopiedSpectator] = useState(false);

  const isLeague = mode === "league" && matches;
  const isGroups = mode === "groups" && matches;

  const leagueMatches = useMemo(
    () => {
      if (!isLeague || !matches) return [] as MatchNode[];
      return Object.values(matches)
        .filter((m) => m.player1 && m.player2)
        .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id));
    },
    [isLeague, matches]
  );

  const groupMatches = useMemo(
    () => {
      if (!isGroups || !matches) return [] as MatchNode[];
      return Object.values(matches)
        .filter((m) => m.player1 && m.player2 && typeof m.group === "number")
        .sort((a, b) => {
          const ga = (a.group ?? 0) - (b.group ?? 0);
          if (ga !== 0) return ga;
          const ra = (a.round ?? 0) - (b.round ?? 0);
          if (ra !== 0) return ra;
          return a.id.localeCompare(b.id);
        });
    },
    [isGroups, matches]
  );

  // Matches der Gruppenphase, auch wenn wir bereits in der KO-Phase sind
  const groupMatchesForDisplay = useMemo(
    () => {
      const source = isGroups && matches ? matches : groupPhaseMatches;
      if (!source) return [] as MatchNode[];
      return Object.values(source)
        .filter((m) => m.player1 && m.player2 && typeof m.group === "number")
        .sort((a, b) => {
          const ga = (a.group ?? 0) - (b.group ?? 0);
          if (ga !== 0) return ga;
          const ra = (a.round ?? 0) - (b.round ?? 0);
          if (ra !== 0) return ra;
          return a.id.localeCompare(b.id);
        });
    },
    [isGroups, matches, groupPhaseMatches]
  );

  const groupStandingsForKO = useMemo(() => {
    if (!isGroups || !matches) return {} as Record<number, Standing[]>;
    const byGroup: Record<number, Standing[]> = {};

    Object.values(matches).forEach((m) => {
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
        row.points = (row.wins ?? 0) * pointScheme.win + (row.losses ?? 0) * pointScheme.loss;
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
  }, [isGroups, matches, pointScheme]);

  const allGroupMatchesFinished = isGroups && groupMatches.length > 0 && groupMatches.every(
    (m) => !m.player1 || !m.player2 || !!m.winner
  );

  const openKOSetup = () => {
    if (!isGroups || !matches) return;
    const initial = new Set<string>();
    Object.values(groupStandingsForKO).forEach((rows) => {
      rows.slice(0, 2).forEach((row) => initial.add(row.name));
    });
    setSelectedQualifiers(initial);
    setKoDouble(false);
    setKoSetupOpen(true);
  };

  const toggleQualifier = (name: string) => {
    setSelectedQualifiers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startKO = () => {
    if (!onStartKOFromGroups) return;
    if (selectedQualifiers.size < 2) return;

    // Seeding: Gruppensieger gegen Gruppenzweite anderer Gruppen
    const groupKeys = Object.keys(groupStandingsForKO)
      .map((k) => Number(k))
      .sort((a, b) => a - b);

    const winnersPerGroup: Record<number, string | undefined> = {};
    const runnersPerGroup: Record<number, string | undefined> = {};
    const others: string[] = [];

    groupKeys.forEach((g) => {
      const rows = groupStandingsForKO[g] || [];
      rows.forEach((row, idx) => {
        if (!selectedQualifiers.has(row.name)) return;
        if (idx === 0) {
          winnersPerGroup[g] = row.name;
        } else if (idx === 1) {
          runnersPerGroup[g] = row.name;
        } else {
          others.push(row.name);
        }
      });
    });

    const ordered: string[] = [];

    // Gruppen, in denen sowohl Platz 1 als auch Platz 2 qualifiziert sind
    const pairedGroups = groupKeys.filter(
      (g) => winnersPerGroup[g] && runnersPerGroup[g]
    );

    if (pairedGroups.length >= 2) {
      const k = pairedGroups.length;
      for (let i = 0; i < k; i++) {
        const g = pairedGroups[i];
        const h = pairedGroups[(i + 1) % k];
        const wName = winnersPerGroup[g]!;
        const rName = runnersPerGroup[h]!;
        ordered.push(wName, rName);
      }
    } else if (pairedGroups.length === 1) {
      const g = pairedGroups[0];
      const wName = winnersPerGroup[g]!;
      const rName = runnersPerGroup[g]!;
      ordered.push(wName, rName);
    }

    const used = new Set(ordered);

    // uebrige Gruppensieger und -zweite anhängen
    groupKeys.forEach((g) => {
      const w = winnersPerGroup[g];
      if (w && !used.has(w)) {
        ordered.push(w);
        used.add(w);
      }
      const r = runnersPerGroup[g];
      if (r && !used.has(r)) {
        ordered.push(r);
        used.add(r);
      }
    });

    // weitere Qualifikanten (z.B. Drittplatzierte) hinten anstellen
    others.forEach((name) => {
      if (!used.has(name)) {
        ordered.push(name);
        used.add(name);
      }
    });

    // Sicherheitsnetz: alle selektierten Spieler müssen im Array landen
    selectedQualifiers.forEach((name) => {
      if (!used.has(name)) {
        ordered.push(name);
      }
    });

    if (ordered.length < 2) return;

    onStartKOFromGroups(ordered, koDouble);
    setKoSetupOpen(false);
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "2rem auto",
        padding: "2rem",
        borderRadius: 12,
        background: "#1e1e1e",
        color: "#eee",
        boxShadow: "0 0 20px rgba(0,0,0,0.5)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Turnierleitung</h2>
        <button
          onClick={onClose}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "#444",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Zurück
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 10px" }}>Live-Hinweis für Publikum</h3>
        <div style={{ fontSize: 14, color: "#ccc", marginBottom: 8 }}>
          Dieser Text wird oben in der Zuschaueransicht eingeblendet. Leer lassen,
          wenn kein Hinweis angezeigt werden soll.
        </div>
        <textarea
          value={publicAnnouncement}
          onChange={(e) => setPublicAnnouncement(e.target.value)}
          placeholder="z.B. Finale gleich auf Automat 1, bitte Ruhe im Saal."
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #444",
            background: "#111",
            color: "#eee",
            resize: "vertical",
            fontFamily: "inherit",
            fontSize: 14,
            marginBottom: 8,
          }}
        />
        {onSendAnnouncementNotification && (
          <button
            onClick={() => {
              if (!publicAnnouncement.trim()) return;
              onSendAnnouncementNotification();
            }}
            disabled={!publicAnnouncement.trim()}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 6,
              border: "none",
              background: publicAnnouncement.trim() ? "#4CAF50" : "#555",
              color: "#fff",
              cursor: publicAnnouncement.trim() ? "pointer" : "not-allowed",
              fontSize: 13,
            }}
          >
            Als Benachrichtigung senden
          </button>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 10px" }}>Remote-Zuschauerlink</h3>
        <div style={{ fontSize: 14, color: "#ccc", marginBottom: 8 }}>
          Diesen Link kannst du z.B. als QR-Code teilen, damit externe Zuschauer
          nur die Zuschaueransicht sehen.
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            type="text"
            readOnly
            value={spectatorUrl || "Nicht verfügbar"}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "0.4rem 0.6rem",
              borderRadius: 6,
              border: "1px solid #444",
              background: "#111",
              color: "#eee",
              fontSize: 13,
            }}
          />
          <button
            onClick={async () => {
              if (!spectatorUrl) return;
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(spectatorUrl);
                  setCopiedSpectator(true);
                  setTimeout(() => setCopiedSpectator(false), 2000);
                }
              } catch {
                // Ignoriere Clipboard-Fehler
              }
            }}
            disabled={!spectatorUrl}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 6,
              border: "none",
              background: spectatorUrl ? "#2196F3" : "#555",
              color: "#fff",
              cursor: spectatorUrl ? "pointer" : "not-allowed",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            In Zwischenablage
          </button>
        </div>
        {copiedSpectator && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#8BC34A" }}>
            Link kopiert.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 10px" }}>Punkteschlüssel</h3>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, color: "#bbb" }}>Sieg</div>
            <div style={{ fontSize: 18, fontWeight: "bold" }}>{pointScheme.win}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: "#bbb" }}>Niederlage</div>
            <div style={{ fontSize: 18, fontWeight: "bold" }}>{pointScheme.loss}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 10px" }}>Rangliste</h3>
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #444",
            overflow: "hidden",
          }}
        >
          {(isGroups && matches) || groupPhaseMatches ? (
            (() => {
              // Gruppenweise Ranglisten auf Basis der Matches berechnen
              const byGroup: Record<number, Standing[]> = {};

              const source = isGroups && matches ? matches : groupPhaseMatches!;

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

              const groupKeys = Object.keys(byGroup)
                .map((k) => Number(k))
                .sort((a, b) => a - b);

              return (
                <>
                  {groupKeys.map((g) => {
                    const rows = byGroup[g];
                    rows.forEach((row) => {
                      row.legDiff = (row.legsFor ?? 0) - (row.legsAgainst ?? 0);
                      row.points =
                        (row.wins ?? 0) * pointScheme.win +
                        (row.losses ?? 0) * pointScheme.loss;
                    });
                    rows.sort((a, b) => {
                      if (b.points !== a.points) return b.points - a.points;
                      const diffA = a.legDiff ?? 0;
                      const diffB = b.legDiff ?? 0;
                      if (diffB !== diffA) return diffB - diffA;
                      return (b.legsFor ?? 0) - (a.legsFor ?? 0);
                    });

                    return (
                      <div key={g} style={{ borderBottom: "1px solid #333" }}>
                        <div
                          style={{
                            padding: 8,
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
                            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
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
                        {rows.map((s, idx) => {
                          const games = (s.wins ?? 0) + (s.losses ?? 0);
                          const legsPlusMinus = `${s.legsFor ?? 0}:${s.legsAgainst ?? 0}`;
                          return (
                            <div
                              key={s.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                                padding: 12,
                                background:
                                  idx % 2 === 0 ? "#1a1a1a" : "#141414",
                              }}
                            >
                              <div>{s.name}</div>
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
          ) : isLeague ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
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
                const legsPlusMinus = `${s.legsFor ?? 0}:${s.legsAgainst ?? 0}`;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                      padding: 12,
                      background: idx % 2 === 0 ? "#1a1a1a" : "#141414",
                    }}
                  >
                    <div>{s.name}</div>
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
                  key={s.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    padding: 12,
                    background: idx % 2 === 0 ? "#1a1a1a" : "#141414",
                  }}
                >
                  <div>{s.name}</div>
                  <div style={{ textAlign: "right" }}>{s.points}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {(isLeague || groupMatchesForDisplay.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 10px" }}>
            {isGroups ? "Gruppenspiele / Live-Status" : "Ligaspiele / Live-Status"}
          </h3>
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #444",
              overflow: "hidden",
            }}
          >
            {(() => {
              if (groupMatchesForDisplay.length > 0) {
                const byGroup: Record<number, MatchNode[]> = {};
                groupMatchesForDisplay.forEach((m) => {
                  const g = m.group ?? 0;
                  if (!byGroup[g]) byGroup[g] = [];
                  byGroup[g].push(m);
                });
                const groupKeys = Object.keys(byGroup)
                  .map((k) => Number(k))
                  .sort((a, b) => a - b);

                return groupKeys.map((g) => {
                  const grouped: Record<number, MatchNode[]> = {};
                  byGroup[g].forEach((m) => {
                    const r = m.round ?? 0;
                    if (!grouped[r]) grouped[r] = [];
                    grouped[r].push(m);
                  });
                  const roundKeys = Object.keys(grouped)
                    .map((k) => Number(k))
                    .sort((a, b) => a - b);

                  return (
                    <div key={g}>
                      <div
                        style={{
                          padding: 8,
                          background: "#202020",
                          borderBottom: "1px solid #333",
                          fontWeight: "bold",
                        }}
                      >
                        Gruppe {g + 1}
                      </div>
                      {roundKeys.map((round) => (
                        <div key={round}>
                          <div
                            style={{
                              padding: 8,
                              background: "#262626",
                              borderBottom: "1px solid #333",
                              fontWeight: "bold",
                            }}
                          >
                            Runde {round + 1}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "0.8fr 1.2fr 1.2fr 0.8fr 1.2fr",
                              padding: 12,
                              background: "#171717",
                              color: "#aaa",
                              fontWeight: "bold",
                            }}
                          >
                            <div>Match</div>
                            <div>Spieler 1</div>
                            <div>Spieler 2</div>
                            <div>Ergebnis</div>
                            <div>Status</div>
                          </div>
                          {grouped[round].map((m, idx) => {
                            const status = m.winner
                              ? "Beendet"
                              : m.isOnAutomat
                              ? `Läuft auf Automat ${
                                  m.automatNumber ?? ""
                                }`
                              : m.player1 && m.player2
                              ? "Offen"
                              : "Unvollständig";
                            const legsText =
                              m.legs1 != null && m.legs2 != null
                                ? `${m.legs1}:${m.legs2}`
                                : "-";
                            const canOpen =
                              !!onOpenResultModal && m.player1 && m.player2;
                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  if (canOpen && onOpenResultModal) {
                                    onOpenResultModal(m.id);
                                  }
                                }}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "0.8fr 1.2fr 1.2fr 0.8fr 1.2fr",
                                  padding: 12,
                                  background:
                                    idx % 2 === 0 ? "#1a1a1a" : "#141414",
                                  alignItems: "center",
                                  gap: 8,
                                  cursor: canOpen ? "pointer" : "default",
                                  opacity: canOpen ? 1 : 0.7,
                                }}
                              >
                                <div>{m.id}</div>
                                <div>{m.player1 ?? "-"}</div>
                                <div>{m.player2 ?? "-"}</div>
                                <div>{legsText}</div>
                                <div>{status}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                });
              }

              // Standard-Ligaansicht (ohne Gruppen)
              const grouped: Record<number, MatchNode[]> = {};
              leagueMatches.forEach((m) => {
                const r = m.round ?? 0;
                if (!grouped[r]) grouped[r] = [];
                grouped[r].push(m);
              });
              const roundKeys = Object.keys(grouped)
                .map((k) => Number(k))
                .sort((a, b) => a - b);

              return roundKeys.map((round) => (
                <div key={round}>
                  <div
                    style={{
                      padding: 8,
                      background: "#202020",
                      borderBottom: "1px solid #333",
                      fontWeight: "bold",
                    }}
                  >
                    Runde {round + 1}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "0.8fr 1.2fr 1.2fr 0.8fr 1.2fr",
                      padding: 12,
                      background: "#171717",
                      color: "#aaa",
                      fontWeight: "bold",
                    }}
                  >
                    <div>Match</div>
                    <div>Spieler 1</div>
                    <div>Spieler 2</div>
                    <div>Ergebnis</div>
                    <div>Status</div>
                  </div>
                  {grouped[round].map((m, idx) => {
                    const status = m.winner
                      ? "Beendet"
                      : m.isOnAutomat
                      ? `Läuft auf Automat ${m.automatNumber ?? ""}`
                      : m.player1 && m.player2
                      ? "Offen"
                      : "Unvollständig";
                    const legsText =
                      m.legs1 != null && m.legs2 != null
                        ? `${m.legs1}:${m.legs2}`
                        : "-";
                    const canOpen =
                      !!onOpenResultModal && m.player1 && m.player2;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (canOpen && onOpenResultModal) {
                            onOpenResultModal(m.id);
                          }
                        }}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "0.8fr 1.2fr 1.2fr 0.8fr 1.2fr",
                          padding: 12,
                          background:
                            idx % 2 === 0 ? "#1a1a1a" : "#141414",
                          alignItems: "center",
                          gap: 8,
                          cursor: canOpen ? "pointer" : "default",
                          opacity: canOpen ? 1 : 0.7,
                        }}
                      >
                        <div>{m.id}</div>
                        <div>{m.player1 ?? "-"}</div>
                        <div>{m.player2 ?? "-"}</div>
                        <div>{legsText}</div>
                        <div>{status}</div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {mode === "ko" && groupPhaseMatches && onReturnToGroups && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 10px" }}>Gruppenphase</h3>
          <div style={{ fontSize: 14, color: "#ccc", marginBottom: 8 }}>
            Die obigen Tabellen und Gruppenspiele stammen aus der abgeschlossenen
            Gruppenphase.
          </div>
          <button
            onClick={onReturnToGroups}
            disabled={!canReturnToGroups}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 8,
              border: "none",
              background: canReturnToGroups ? "#FF9800" : "#555",
              color: "#fff",
              cursor: canReturnToGroups ? "pointer" : "not-allowed",
              fontWeight: "bold",
              marginBottom: 4,
            }}
          >
            Zurück zur Gruppenphase
          </button>
          {!canReturnToGroups && (
            <div style={{ fontSize: 12, color: "#ffb74d" }}>
              Rückkehr ist nicht mehr möglich: Es wurde bereits ein KO‑Match
              gespielt.
            </div>
          )}
        </div>
      )}

      {isGroups && groupMatches.length > 0 && onStartKOFromGroups && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 10px" }}>KO-Phase</h3>
          {!koSetupOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 14, color: "#ccc" }}>
                Nach Abschluss aller Gruppenspiele kannst du hier die Qualifikanten
                für die KO-Phase auswählen. Standardmäßig werden die Top&nbsp;2 jeder
                Gruppe vorausgewählt.
              </div>
              <button
                disabled={!allGroupMatchesFinished}
                onClick={openKOSetup}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: "none",
                  background: allGroupMatchesFinished ? "#4CAF50" : "#555",
                  color: "#fff",
                  cursor: allGroupMatchesFinished ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                }}
              >
                KO-Phase vorbereiten
              </button>
              {!allGroupMatchesFinished && (
                <div style={{ fontSize: 12, color: "#ffb74d" }}>
                  Es sind noch nicht alle Gruppenspiele abgeschlossen.
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #444",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ fontSize: 14, color: "#ccc" }}>
                Wähle pro Gruppe die Qualifikanten aus (voreingestellt sind die
                ersten beiden). Anschließend kannst du zwischen Einfach‑KO und
                Doppel‑KO wählen.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.keys(groupStandingsForKO)
                  .map((k) => Number(k))
                  .sort((a, b) => a - b)
                  .map((g) => {
                    const rows = groupStandingsForKO[g] || [];
                    return (
                      <div key={g}
                        style={{
                          borderRadius: 8,
                          border: "1px solid #333",
                          padding: 8,
                          background: "#151515",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: 6,
                            color: "#eee",
                          }}
                        >
                          Gruppe {g + 1}
                        </div>
                        {rows.map((s, idx) => {
                          const checked = selectedQualifiers.has(s.name);
                          return (
                            <label
                              key={s.name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 14,
                                padding: "4px 0",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleQualifier(s.name)}
                              />
                              <span>
                                Platz {idx + 1}: {s.name} – Punkte {s.points}, Leg-Diff {s.legDiff ?? 0}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ fontSize: 14, color: "#ccc" }}>Modus:</div>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
                  <input
                    type="radio"
                    checked={!koDouble}
                    onChange={() => setKoDouble(false)}
                  />
                  Einfach‑KO
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
                  <input
                    type="radio"
                    checked={koDouble}
                    onChange={() => setKoDouble(true)}
                  />
                  Doppel‑KO
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => setKoSetupOpen(false)}
                  style={{
                    padding: "0.5rem 0.9rem",
                    borderRadius: 6,
                    border: "none",
                    background: "#555",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  disabled={selectedQualifiers.size < 2}
                  onClick={startKO}
                  style={{
                    padding: "0.5rem 0.9rem",
                    borderRadius: 6,
                    border: "none",
                    background:
                      selectedQualifiers.size >= 2 ? "#4CAF50" : "#2e7d32",
                    opacity: selectedQualifiers.size >= 2 ? 1 : 0.6,
                    color: "#fff",
                    cursor:
                      selectedQualifiers.size >= 2 ? "pointer" : "not-allowed",
                  }}
                >
                  KO-Phase starten
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={exportTournament}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "#2196F3",
            color: "#fff",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Turnier exportieren
        </button>

        <button
          onClick={() => (window as any).exportXLSX && (window as any).exportXLSX()}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "#2196F3",
            color: "#fff",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Exportiere Punktetabelle & Matches als XLSX
        </button>

        <label
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "#FF9800",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Turnier importieren
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const json = JSON.parse(reader.result as string);
                  importTournament(json);
                  setImportError(null);
                } catch (err) {
                  setImportError("Ungültige Datei");
                }
              };
              reader.readAsText(file);
            }}
          />
        </label>
      </div>

      {importError && (
        <div style={{ marginTop: 12, color: "#ff5252" }}>{importError}</div>
      )}
    </div>
  );
};
