import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { Player, MatchNode, Automat } from "../types";
import type { MatchTimerState } from "../core/matchTimer";

interface AutomatenScreenProps {
  matches: Record<string, MatchNode>;
  setMatches: React.Dispatch<React.SetStateAction<Record<string, MatchNode>>>;
  players: Player[];
  setWinner: (matchId: string, playerId: string) => void;
  automats: Automat[];
  setAutomats: React.Dispatch<React.SetStateAction<Automat[]>>;
  matchTimers: Record<string, MatchTimerState>;
  setMatchTimers: React.Dispatch<React.SetStateAction<Record<string, MatchTimerState>>>;
  timersEnabled: boolean;
  waitTimerMinutes: number;
  setWaitTimerMinutes: React.Dispatch<React.SetStateAction<number>>;
  matchTimerMinutes?: number;
  setMatchTimerMinutes: React.Dispatch<React.SetStateAction<number>>;
  onOpenResultModal?: (matchId: string) => void;
  mode?: "ko" | "league" | "groups";
}

export function AutomatenScreen({
  matches,
  setMatches,
  players,
  setWinner,
  automats,
  setAutomats,
  matchTimers,
  setMatchTimers,
  timersEnabled,
  waitTimerMinutes,
  setWaitTimerMinutes,
  matchTimerMinutes = 5,
  setMatchTimerMinutes,
  onOpenResultModal,
  mode,
}: AutomatenScreenProps) {
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);

  // Timer-Operationen auf zentralen State
  const handlePause = (matchId: string) => {
    if (!timersEnabled) return;
    setMatchTimers(prev => ({ ...prev, [matchId]: { ...prev[matchId], running: false } }));
  };
  const handleStart = (matchId: string) => {
    if (!timersEnabled) return;
    setMatchTimers(prev => {
      const existing = prev[matchId];
      const isPlaying = existing?.phase === "playing";
      const baseSeconds = isPlaying ? matchTimerMinutes * 60 : waitTimerMinutes * 60;
      const secondsLeft = existing?.secondsLeft ?? baseSeconds;
      const next: MatchTimerState = {
        ...(existing || { matchId, secondsLeft, running: true }),
        matchId,
        secondsLeft,
        running: true,
        startedAt: Date.now(),
      };
      return {
        ...prev,
        [matchId]: next,
      };
    });
  };
  const handleReset = (matchId: string) => {
    if (!timersEnabled) return;
    setMatchTimers(prev => {
      const existing = prev[matchId];
      const isPlaying = existing?.phase === "playing";
      const baseSeconds = isPlaying ? matchTimerMinutes * 60 : waitTimerMinutes * 60;
      const next: MatchTimerState = {
        ...(existing || { matchId, secondsLeft: baseSeconds, running: true }),
        matchId,
        secondsLeft: baseSeconds,
        running: true,
        startedAt: Date.now(),
      };
      return {
        ...prev,
        [matchId]: next,
      };
    });
  };

  const getPlayerName = (id: string | null) =>
    id ? players.find((p) => p.id === id)?.name || id : "-";

  const isPlayableMatch = (m: MatchNode) => m.player1 && m.player2 && !m.winner;

  // Vorschau: Welche Matches würden als nächstes auf freie Automaten geladen?
  const computeNextAssignments = () => {
    const matchesCopy: Record<string, MatchNode> = { ...matches };

    // aktueller Automat-Stand (nur lesend)
    const autosSnapshot = automats.map((a) => ({ ...a }));

    // Spieler, die aktuell schon auf einem Automaten spielen
    const busyPlayers = new Set<string>();
    autosSnapshot.forEach((a) => {
      if (!a.currentMatch) return;
      const m = matchesCopy[a.currentMatch];
      if (!m) return;
      if (m.player1) busyPlayers.add(m.player1);
      if (m.player2) busyPlayers.add(m.player2);
    });

    let pending = Object.values(matchesCopy).filter(
      (m) =>
        isPlayableMatch(m) &&
        !m.isOnAutomat &&
        !autosSnapshot.some((a) => a.currentMatch === m.id)
    );

    if (mode === "groups") {
      const queued = pending.filter((m) => m.isNextInAutomatQueue);
      const normal = pending.filter((m) => !m.isNextInAutomatQueue);

      const byGroup: Record<number, MatchNode[]> = {};
      const withoutGroup: MatchNode[] = [];
      normal.forEach((m) => {
        if (typeof m.group === "number") {
          const g = m.group;
          if (!byGroup[g]) byGroup[g] = [];
          byGroup[g].push(m);
        } else {
          withoutGroup.push(m);
        }
      });

      Object.values(byGroup).forEach((arr) =>
        arr.sort(
          (a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id)
        )
      );

      const groupKeys = Object.keys(byGroup)
        .map((k) => Number(k))
        .sort((a, b) => a - b);

      const rotated: MatchNode[] = [];
      let added = true;
      while (added) {
        added = false;
        groupKeys.forEach((g) => {
          const bucket = byGroup[g];
          if (bucket && bucket.length > 0) {
            rotated.push(bucket.shift() as MatchNode);
            added = true;
          }
        });
      }

      withoutGroup.sort((a, b) => a.id.localeCompare(b.id));
      pending = [...queued, ...rotated, ...withoutGroup];
    } else {
      pending = pending.sort((a, b) => {
        if (a.isNextInAutomatQueue && !b.isNextInAutomatQueue) return -1;
        if (!a.isNextInAutomatQueue && b.isNextInAutomatQueue) return 1;
        return a.id.localeCompare(b.id);
      });
    }

    const preview: Record<number, string> = {};

    // Im Gruppenmodus zuerst: pro Automat das "Next"-Match derselben Gruppe zuordnen,
    // auch wenn die Spieler aktuell noch auf diesem Automaten spielen.
    if (mode === "groups") {
      const nextByGroup: Record<number, MatchNode> = {};
      pending.forEach((m) => {
        if (m.isNextInAutomatQueue && typeof m.group === "number") {
          const g = m.group;
          if (!nextByGroup[g]) {
            nextByGroup[g] = m;
          }
        }
      });

      const usedMatchIds = new Set<string>();

      autosSnapshot.forEach((a) => {
        if (!a.active || a.paused || !a.currentMatch) return;
        const cur = matchesCopy[a.currentMatch];
        if (!cur || typeof cur.group !== "number") return;
        const g = cur.group;
        const next = nextByGroup[g];
        if (next && !usedMatchIds.has(next.id)) {
          preview[a.id] = next.id;
          usedMatchIds.add(next.id);
        }
      });

      if (usedMatchIds.size > 0) {
        pending = pending.filter((m) => !usedMatchIds.has(m.id));
      }
    }

    // Danach: verbleibende Matches wie bisher auf alle aktiven, nicht pausierten Automaten verteilen
    const targets = autosSnapshot.filter((a) => a.active && !a.paused && !preview[a.id]);

    const targetCount = targets.length;
    for (let i = 0; i < targetCount; i++) {
      const a = targets[i];
      if (!a) continue;

      const idx = pending.findIndex((m) => {
        const p1 = m.player1 ?? undefined;
        const p2 = m.player2 ?? undefined;
        if (!p1 || !p2) return false;
        if (busyPlayers.has(p1) || busyPlayers.has(p2)) return false;
        return true;
      });

      if (idx === -1) break;

      const m = pending[idx];
      pending.splice(idx, 1);
      preview[a.id] = m.id;

      if (m.player1) busyPlayers.add(m.player1);
      if (m.player2) busyPlayers.add(m.player2);
    }

    return preview;
  };

  const nextAssignments = computeNextAssignments();
  const nextMatchIds = new Set(Object.values(nextAssignments));

  // *************************
  // automatische Verteilung
  // *************************
  useEffect(() => {
    setAutomats((prevAutos) => {
      // wir klonen die Match‑Objekte nur bei Bedarf
      const matchesCopy: Record<string, MatchNode> = { ...matches };
      let matchChanged = false;
      let automatChanged = false;
      const newlyAssignedMatchIds: string[] = [];

      // Merken, aus welcher Gruppe ein Automat gerade freigeworden ist (nur im Gruppenmodus relevant)
      const freedFromGroup: Record<number, number | undefined> = {};

      const updatedAutos = prevAutos.map((a) => {
        if (!a.currentMatch) return a;

        const match = matchesCopy[a.currentMatch];

        // Automats freigeben, sobald das Match nicht mehr spielbar ist
        if (
          !match ||
          !match.player1 ||
          !match.player2 ||
          !!match.winner ||
          !match.isOnAutomat
        ) {
          if (match && match.isOnAutomat) {
            matchesCopy[a.currentMatch] = {
              ...match,
              isOnAutomat: false,
              automatNumber: undefined,
              automatName: undefined,
            };
            matchChanged = true;
          }

          if (mode === "groups" && match && typeof match.group === "number") {
            freedFromGroup[a.id] = match.group;
          }

          automatChanged = true;
          return { ...a, currentMatch: undefined };
        }

        return a;
      });

      const free = updatedAutos.filter(
        (a) => a.active && !a.paused && !a.currentMatch
      );
      // Spieler, die aktuell schon auf einem Automaten spielen
      const busyPlayers = new Set<string>();
      updatedAutos.forEach((a) => {
        if (!a.currentMatch) return;
        const m = matchesCopy[a.currentMatch];
        if (!m) return;
        if (m.player1) busyPlayers.add(m.player1);
        if (m.player2) busyPlayers.add(m.player2);
      });

      let pending = Object.values(matchesCopy).filter(
        (m) =>
          isPlayableMatch(m) &&
          !m.isOnAutomat &&
          !updatedAutos.some((a) => a.currentMatch === m.id)
      );

      // Sortierung / Verteilung je nach Modus
      if (mode === "groups") {
        // Manuell gesetzte Queue-Einträge herausziehen
        const queued = pending.filter((m) => m.isNextInAutomatQueue);
        const normal = pending.filter((m) => !m.isNextInAutomatQueue);

        // Nach Gruppen bündeln
        const byGroup: Record<number, MatchNode[]> = {};
        const withoutGroup: MatchNode[] = [];
        normal.forEach((m) => {
          if (typeof m.group === "number") {
            const g = m.group;
            if (!byGroup[g]) byGroup[g] = [];
            byGroup[g].push(m);
          } else {
            withoutGroup.push(m);
          }
        });

        // innerhalb der Gruppe nach Runde/ID sortieren
        Object.values(byGroup).forEach((arr) =>
          arr.sort(
            (a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id)
          )
        );

        const groupKeys = Object.keys(byGroup)
          .map((k) => Number(k))
          .sort((a, b) => a - b);

        const rotated: MatchNode[] = [];
        let added = true;
        while (added) {
          added = false;
          groupKeys.forEach((g) => {
            const bucket = byGroup[g];
            if (bucket && bucket.length > 0) {
              rotated.push(bucket.shift() as MatchNode);
              added = true;
            }
          });
        }

        // Matches ohne Gruppe hinten anhängen
        withoutGroup.sort((a, b) => a.id.localeCompare(b.id));
        pending = [...queued, ...rotated, ...withoutGroup];
      } else {
        pending = pending.sort((a, b) => {
          if (a.isNextInAutomatQueue && !b.isNextInAutomatQueue) return -1;
          if (!a.isNextInAutomatQueue && b.isNextInAutomatQueue) return 1;
          return a.id.localeCompare(b.id);
        });
      }

      // freie Automaten mit Rücksicht auf Spieler-Doppelbelegung füllen
      const freeCount = free.length;
      for (let i = 0; i < freeCount; i++) {
        const a = free[i];
        if (!a) continue;

        const preferredGroup = mode === "groups" ? freedFromGroup[a.id] : undefined;

        // erstes Pending-Match finden, dessen Spieler nicht bereits spielen
        let idx = -1;

        // 1) Im Gruppenmodus zuerst nach einem Match derselben Gruppe suchen
        if (typeof preferredGroup === "number") {
          idx = pending.findIndex((m) => {
            const p1 = m.player1 ?? undefined;
            const p2 = m.player2 ?? undefined;
            if (!p1 || !p2) return false;
            if (busyPlayers.has(p1) || busyPlayers.has(p2)) return false;
            if (typeof m.group !== "number" || m.group !== preferredGroup) return false;
            return true;
          });
        }

        // 2) Falls nichts Passendes in derselben Gruppe: globales Fallback wie bisher
        if (idx === -1) {
          idx = pending.findIndex((m) => {
            const p1 = m.player1 ?? undefined;
            const p2 = m.player2 ?? undefined;
            if (!p1 || !p2) return false;
            if (busyPlayers.has(p1) || busyPlayers.has(p2)) return false;
            return true;
          });
        }

        if (idx === -1) break;

        const m = pending[idx];
        pending.splice(idx, 1);

        updatedAutos.forEach((x, idx) => {
          if (x.id === a.id) {
            updatedAutos[idx] = { ...x, currentMatch: m.id };
            automatChanged = true;
          }
        });
        matchesCopy[m.id] = {
          ...matchesCopy[m.id],
          isOnAutomat: true,
          automatNumber: a.id,
          automatName: a.name,
          isNextInAutomatQueue: false,
        };
        matchChanged = true;
        newlyAssignedMatchIds.push(m.id);

        // Spieler als "busy" markieren, damit sie nicht parallel noch ein Match bekommen
        if (m.player1) busyPlayers.add(m.player1);
        if (m.player2) busyPlayers.add(m.player2);
      }

      // queue‑Flags aktualisieren
      // 1) Alle nicht mehr spielbaren oder bereits auf einem Automaten liegenden Matches verlieren ihr Queue-Flag
      Object.values(matchesCopy).forEach((m) => {
        const playable = isPlayableMatch(m);
        if ((!playable || m.isOnAutomat) && m.isNextInAutomatQueue) {
          matchesCopy[m.id] = { ...m, isNextInAutomatQueue: false };
          matchChanged = true;
        }
      });

      // 2) Je nach Modus gewünschte Queue-Matches bestimmen
      const desiredNextIds = new Set<string>();

      if (mode === "groups") {
        // Im Gruppenmodus: pro Gruppe ein "Nächster" markieren, plus optional eins ohne Gruppe
        const waiting = Object.values(matchesCopy).filter(
          (m) => isPlayableMatch(m) && !m.isOnAutomat
        );
        const byGroup: Record<number, MatchNode[]> = {};
        const withoutGroup: MatchNode[] = [];
        waiting.forEach((m) => {
          if (typeof m.group === "number") {
            const g = m.group;
            if (!byGroup[g]) byGroup[g] = [];
            byGroup[g].push(m);
          } else {
            withoutGroup.push(m);
          }
        });

        Object.values(byGroup).forEach((arr) => {
          arr.sort(
            (a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id)
          );
          const first = arr[0];
          if (first) {
            desiredNextIds.add(first.id);
          }
        });

        if (withoutGroup.length > 0) {
          withoutGroup.sort((a, b) => a.id.localeCompare(b.id));
          desiredNextIds.add(withoutGroup[0].id);
        }
      } else {
        // Standard: genau ein globales "Nächster"-Match
        const waiting = Object.values(matchesCopy).filter(
          (m) => isPlayableMatch(m) && !m.isOnAutomat
        );
        if (waiting.length > 0) {
          const nextMatch = waiting.sort((a, b) => a.id.localeCompare(b.id))[0];
          desiredNextIds.add(nextMatch.id);
        }
      }

      // 3) Flags nur dann setzen/entfernen, wenn sich der Status ändert
      Object.values(matchesCopy).forEach((m) => {
        const shouldBeNext = desiredNextIds.has(m.id);
        const isNext = !!m.isNextInAutomatQueue;
        if (isNext !== shouldBeNext) {
          matchesCopy[m.id] = { ...m, isNextInAutomatQueue: shouldBeNext };
          matchChanged = true;
        }
      });

      if (matchChanged) {
        setMatches(matchesCopy);
      }

      // Für alle neu auf einen Automaten gesetzten Matches den Timer
      // neu mit der eingestellten Matchzeit starten.
      if (timersEnabled && newlyAssignedMatchIds.length > 0) {
        setMatchTimers((prev) => {
          const updatedTimers: Record<string, MatchTimerState> = { ...prev };
          newlyAssignedMatchIds.forEach((id) => {
            const existing = updatedTimers[id];
            updatedTimers[id] = {
              ...(existing || {}),
              matchId: id,
              secondsLeft: waitTimerMinutes * 60,
              running: true,
              startedAt: Date.now(),
              phase: "waiting",
            };
          });
          return updatedTimers;
        });
      }
      return automatChanged ? updatedAutos : prevAutos;
    });
  }, [matches, automats, mode]);

  const toggleActive = (id: number) =>
    setAutomats((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, active: !a.active, currentMatch: undefined } : a
      )
    );

  const togglePause = (id: number) =>
    setAutomats((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, paused: !a.paused, currentMatch: undefined } : a
      )
    );

  const handleSetWinner = (automat: Automat, playerId: string) => {
    if (!automat.currentMatch) return;
    const matchId = automat.currentMatch;

    setWinner(matchId, playerId);

    setAutomats((prev) =>
      prev.map((a) =>
        a.id === automat.id ? { ...a, currentMatch: undefined } : a
      )
    );
  };

  const handlePlayersAtAutomat = (automat: Automat) => {
    if (!automat.currentMatch) return;
    if (!timersEnabled) return;
    const matchId = automat.currentMatch;

    setMatchTimers((prev) => {
      const existing = prev[matchId] as MatchTimerState | undefined;
      return {
        ...prev,
        [matchId]: {
          ...(existing || {}),
          matchId,
          secondsLeft: matchTimerMinutes * 60,
          running: true,
          startedAt: Date.now(),
          phase: "playing",
        },
      };
    });
  };

  const kachelHeight = 180; // Höhe der Kachel

  // ----------------------------
  // Match-Rahmenfarbe bestimmen
  // ----------------------------
  const getMatchBorderColor = (match?: MatchNode) => {
    if (!match || !match.player1 || !match.player2) return "#555";       // Grau: nicht spielbar
    if (match.winner) return "#4CAF50";                                  // Grün: abgeschlossen
    if (match.isOnAutomat) return "#2196F3";                             // Blau: aktuell auf Automat
    if (match.isNextInAutomatQueue || nextMatchIds.has(match.id)) return "#FFEB3B"; // Gelb: explizit next in Queue oder per Vorschau als nächstes
    if (match.player1 && match.player2) return "#FFA726";                // Orange: spielbar, wartet
    return "#555";                                                        // Standard dunkel
  };

  const baseButtonStyle: CSSProperties = {
    padding: "0.4rem 0.8rem",
    borderRadius: 999,
    border: "none",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    background: "#333",
    color: "#fff",
    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
    transition: "background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease",
  };

  const primaryButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: "#1976d2",
  };

  const dangerButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: "#d32f2f",
  };

  const accentButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: "#388e3c",
  };

  const PlayerButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: "#1f2ac2",
  };

  const neutralButtonStyle: CSSProperties = {
    ...baseButtonStyle,
    background: "#424242",
  };

  return (
    <div
      style={{
        maxWidth: 2400,
        margin: "2rem auto",
        padding: "2rem",
        borderRadius: 12,
        background: "#1e1e1e",
        color: "#eee",
        boxShadow: "0 0 20px rgba(0,0,0,0.5)",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ marginBottom: "1.5rem", textAlign: "center", fontSize: 28 }}>
        Automatenansicht
      </h2>

      {/* Live-Anpassung der Warte- und Spielzeit */}
      <div style={{ marginBottom: "1.5rem", textAlign: "center", display: "flex", justifyContent: "center", gap: 24 }}>
        <div>
          <label style={{ marginRight: 8 }}>Wartezeit (Min):</label>
          <input
            type="number"
            min={1}
            value={waitTimerMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) {
                setWaitTimerMinutes(val);
              }
            }}
            style={{
              width: 70,
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              border: "1px solid #555",
              background: "#1e1e1e",
              color: "#fff",
            }}
          />
        </div>
        <div>
          <label style={{ marginRight: 8 }}>Spielzeit (Min):</label>
          <input
            type="number"
            min={1}
            value={matchTimerMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) {
                setMatchTimerMinutes(val);
              }
            }}
            style={{
              width: 70,
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              border: "1px solid #555",
              background: "#1e1e1e",
              color: "#fff",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", gap: 100, alignItems: "flex-start" }}>
          {/* Grid-Kacheln */}
          <div
            style={{
              alignSelf: "start",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              width: 1400,
            }}
          >
            {automats.map((a, idx) => {
              const match = a.currentMatch ? matches[a.currentMatch] : null;
              const timer = a.currentMatch ? matchTimers[a.currentMatch] : null;
              const timerSeconds = timer ? timer.secondsLeft : matchTimerMinutes * 60;
              const timerExpired = timerSeconds <= 0;
              const timerPaused = !!timer && !timer.running && timer.secondsLeft > 0;
              const previewMatchId = nextAssignments[a.id];
              const previewMatch = previewMatchId ? matches[previewMatchId] : undefined;
              return (
                <div
                  key={a.id}
                  style={{
                    background: timerExpired ? '#c62828' : '#222',
                    color: '#fff',
                    borderRadius: 10,
                    marginBottom: 16,
                    padding: 16,
                    boxShadow: '0 0 8px rgba(0,0,0,0.2)',
                    position: 'relative',
                    border: `2px solid ${getMatchBorderColor(match || undefined)}`,
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 18 }}>Automat {a.id}</div>
                  {match && (
                    <div style={{ marginTop: 8 }}>
                      <div>Match: {match.id}</div>
                      <div style={{ marginTop: 4, fontSize: 14 }}>
                        {getPlayerName(match.player1)} vs. {getPlayerName(match.player2)}
                      </div>
                      {timersEnabled && (
                        <>
                          <div
                            style={{
                              fontSize: 24,
                              color: timerExpired ? '#ff5252' : timerPaused ? '#FFEB3B' : '#fff',
                              fontWeight: 'bold',
                            }}
                          >
                            {timerPaused
                              ? '|| Paused'
                              : `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60)
                                  .toString()
                                  .padStart(2, '0')}`}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <button
                              onClick={() => handleStart(match.id)}
                              style={{ ...primaryButtonStyle, marginRight: 8 }}
                            >
                              ▶ Start
                            </button>
                            <button
                              onClick={() => handlePause(match.id)}
                              style={{ ...neutralButtonStyle, marginRight: 8 }}
                            >
                              ⏸ Pause
                            </button>
                            <button
                              onClick={() => handleReset(match.id)}
                              style={dangerButtonStyle}
                            >
                              Reset
                            </button>
                            {onOpenResultModal && (
                              <button
                                onClick={() => onOpenResultModal(match.id)}
                                style={{ ...accentButtonStyle, marginLeft: 8 }}
                              >
                                Ergebnis
                              </button>
                            )}
                          </div>
                          {/* Status-Label für Timer-Phase */}
                          {timer && !match.winner && (
                            <div
                              style={{
                                marginTop: 8,
                                padding: "0.2rem 0.5rem",
                                borderRadius: 6,
                                border: "1px solid #555",
                                background: "#111",
                                fontSize: 12,
                                display: "inline-block",
                              }}
                            >
                              Status: {timer.phase === "playing" ? "Spiel läuft" : "Warte auf Spieler"}
                            </div>
                          )}
                          {/* Button, wenn Spieler am Automat angekommen sind */}
                          {match && !match.winner && (
                            <div style={{ marginTop: 8 }}>
                              <button
                                onClick={() => handlePlayersAtAutomat(a)}
                                style={accentButtonStyle}
                              >
                                Spieler am Automat
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {/* Im KO-Modus ohne Legs: Sieger direkt am Automaten setzen */}
                      {mode === "ko" && !onOpenResultModal && match.player1 && match.player2 && !match.winner && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleSetWinner(a, match.player1!)}
                            style={{ ...PlayerButtonStyle, flex: 1 }}
                          >
                            {getPlayerName(match.player1)} gewinnt
                          </button>
                          <button
                            onClick={() => handleSetWinner(a, match.player2!)}
                            style={{ ...PlayerButtonStyle, flex: 1 }}
                          >
                            {getPlayerName(match.player2)} gewinnt
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!match && previewMatch && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#ccc' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Als nächstes:</div>
                      <div>Match: {previewMatch.id}</div>
                      <div>
                        {getPlayerName(previewMatch.player1)} vs. {getPlayerName(previewMatch.player2)}
                        {typeof previewMatch.group === 'number'
                          ? ` (Gruppe ${previewMatch.group + 1})`
                          : ''}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Match-Status (2er Liste) */}
          <div style={{ minWidth: 860 }}>
            <h3 style={{ marginBottom: 12, fontSize: 20 }}>Match-Status</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 12,
              }}
            >
              {Object.values(matches)
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((m) => {
                  const nextAutomatIdEntry = Object.entries(nextAssignments).find(
                    ([, mid]) => mid === m.id
                  );
                  const nextAutomatId = nextAutomatIdEntry
                    ? parseInt(nextAutomatIdEntry[0], 10)
                    : undefined;
                  let status: string;
                  if (m.winner) {
                    status = "Abgeschlossen";
                  } else if (m.isOnAutomat) {
                    status = `Automat ${m.automatNumber ?? "?"}`;
                  } else if (m.isNextInAutomatQueue && nextAutomatId !== undefined) {
                    status = `Next - Automat ${nextAutomatId}`;
                  } else if (m.isNextInAutomatQueue) {
                    status = "Next";
                  } else if (nextAutomatId !== undefined) {
                    status = `Geplant für Automat ${nextAutomatId}`;
                  } else if (m.player1 && m.player2) {
                    status = "Wartet";
                  } else {
                    status = "Nicht spielbar";
                  }

                  let statusColor = "#bbb";
                  if (m.winner) statusColor = "#4CAF50";
                  else if (m.isOnAutomat) statusColor = "#2196F3";
                  else if (m.isNextInAutomatQueue || nextAutomatId !== undefined)
                    statusColor = "#FFEB3B";

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (isPlayableMatch(m) && !m.isOnAutomat) {
                          setMatches((prev) => {
                            const copy = { ...prev };
                            Object.keys(copy).forEach((id) => {
                              if (copy[id].isNextInAutomatQueue) {
                                copy[id] = { ...copy[id], isNextInAutomatQueue: false };
                              }
                            });
                            copy[m.id] = { ...copy[m.id], isNextInAutomatQueue: true };
                            return copy;
                          });
                        }
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "#1a1a1a",
                        border: `2px solid ${getMatchBorderColor(m)}`,
                        cursor: isPlayableMatch(m) && !m.isOnAutomat ? "pointer" : "default",
                      }}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: 4 }}>{m.id}</div>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>
                        {getPlayerName(m.player1)} vs. {getPlayerName(m.player2)}
                      </div>
                      <div style={{ color: statusColor }}>{status}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Automaten-Liste */}
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
          onClick={() => setSettingsCollapsed(!settingsCollapsed)}
        >
          Automaten-Settings {settingsCollapsed ? "▶" : "▼"}
        </h3>
        {!settingsCollapsed && (
          <div style={{ minWidth: 180 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 28,
                alignItems: "start",
              }}
            >
              {automats.map(a => (
                <div
                  key={a.id}
                  onClick={() => toggleActive(a.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    borderRadius: 6,
                    padding: 12,
                    background: "#2a2a2a",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 20 }}>
                    <input
                      type="checkbox"
                      checked={a.active}
                      readOnly
                      style={{ transform: "scale(2)" }}
                    />
                    <span>{`Automat ${a.id} - ${a.active ? "Aktiv" : "Inaktiv"}`}</span>
                    {a.active && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          togglePause(a.id);
                        }}
                        style={{
                          ...baseButtonStyle,
                          marginLeft: "auto",
                          padding: "0.6rem 1rem",
                          fontSize: 16,
                          background: a.paused ? "#d32f2f" : "#388e3c",
                        }}
                      >
                        {a.paused ? "Pausiert" : "Läuft"}
                      </button>
                    )}
                  </div>
                  <input
                    value={a.name}
                    onClick={e => e.stopPropagation()}
                    onChange={e =>
                      setAutomats(prev =>
                        prev.map(x => (x.id === a.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                    style={{
                      marginTop: 6,
                      padding: "0.5rem",
                      borderRadius: 6,
                      border: "1px solid #444",
                      backgroundColor: "#1e1e1e",
                      color: "#eee",
                      fontSize: 16,
                      width: "100%",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}